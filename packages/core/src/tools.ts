import { exec } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { chromium, type BrowserContext, type Page } from "playwright";
import { PermissionError, SkillError, ToolError, type DStackConfig, type JsonObject, type ToolCall, type ToolDefinition, type ToolResult } from "@dstack/shared";
import type { SessionLogger } from "./logger.js";
import { sanitize } from "./logger.js";
import { PermissionGate } from "./permissions.js";
import { atomicWrite, ensureDir, exists, fileSafeTimestamp, git, resolveInsideRoot } from "./utils.js";
import { scanDomContent } from "./browser/dom-scanner.js";
import { BrowserSessionManager } from "./browser/session-manager.js";
import { BrowserRefMapManager,  } from "./browser/ref-map.js";
import { generateBrowserSnapshot } from "./browser/snapshot.js";

const execAsync = promisify(exec);

export interface ToolContext { projectRoot: string; config: DStackConfig; logger: SessionLogger | null }
export interface ToolHandler { definition: ToolDefinition; execute(input: JsonObject, context: ToolContext): Promise<ToolResult> }

export class ToolRegistry {
  private readonly handlers = new Map<string, ToolHandler>();
  constructor(handlers = defaultTools()) {
    for (const handler of handlers) this.handlers.set(handler.definition.name, handler);
  }
  get(name: string): ToolHandler {
    const handler = this.handlers.get(name);
    if (!handler) throw new SkillError(`Unknown tool: ${name}`);
    return handler;
  }
  definitions(names: string[]): ToolDefinition[] {
    return names.map((name) => this.get(name).definition);
  }
  names(): string[] {
    return [...this.handlers.keys()].sort();
  }
}

export class ToolExecutor {
  private calls = 0;
  private readonly gate: PermissionGate;
  constructor(private readonly registry: ToolRegistry, private readonly options: { projectRoot: string; config: DStackConfig; logger: SessionLogger | null; interactive: boolean }) {
    this.gate = new PermissionGate({ interactive: options.interactive, dstackDir: options.config.dstackDir, logger: options.logger });
  }
  async dispatch(toolCall: ToolCall): Promise<ToolResult> {
    this.calls += 1;
    if (this.calls > this.options.config.maxToolCalls) throw new PermissionError("Tool call limit exceeded");
    const permission = await this.gate.check(toolCall);
    await this.options.logger?.event("info", "tool-call", { toolName: toolCall.name, args: toolCall.input, gateDecision: permission });
    if (permission === "DENY") throw new PermissionError(`Tool call denied: ${toolCall.name}`);
    try {
      const result = await this.registry.get(toolCall.name).execute(toolCall.input, { projectRoot: this.options.projectRoot, config: this.options.config, logger: this.options.logger });
      const sanitized = await sanitizeToolResult(result, toolCall.name, this.options.logger);
      await this.options.logger?.event("info", "tool-result", { toolName: toolCall.name, output: sanitized.output, success: sanitized.success, error: sanitized.error });
      return sanitized;
    } catch (error) {
      const result = { id: toolCall.id, name: toolCall.name, success: false, output: {}, error: error instanceof Error ? error.message : String(error) };
      await this.options.logger?.event("info", "tool-result", { toolName: toolCall.name, output: {}, success: false, error: result.error });
      return result;
    }
  }
}

function defaultTools(): ToolHandler[] {
  return [
    tool("read_file", "Read a text file.", "read", { path: { type: "string" } }, async (input, context) => {
      const filePath = resolveInsideRoot(context.projectRoot, stringInput(input.path, "path"));
      if (!context.config.allowSecrets && /(^|[\\/])\.env(\..*)?$/i.test(filePath)) throw new ToolError("Reading .env files is disabled");
      const content = await readFile(filePath, "utf8");
      const lines = content.split(/\r?\n/);
      return { content: lines.slice(0, 500).join("\n"), totalLines: lines.length, truncated: lines.length > 500 };
    }),
    tool("write_file", "Write a file atomically.", "write", { path: { type: "string" }, content: { type: "string" } }, async (input, context) => {
      const filePath = resolveInsideRoot(context.projectRoot, stringInput(input.path, "path"));
      await atomicWrite(filePath, stringInput(input.content, "content"));
      return { success: true, path: path.relative(context.projectRoot, filePath) };
    }),
    tool("edit_file", "Replace one exact string in a file.", "write", { path: { type: "string" }, oldStr: { type: "string" }, newStr: { type: "string" } }, async (input, context) => {
      const filePath = resolveInsideRoot(context.projectRoot, stringInput(input.path, "path"));
      const oldStr = stringInput(input.oldStr, "oldStr");
      const content = await readFile(filePath, "utf8");
      if (content.split(oldStr).length - 1 !== 1) throw new ToolError("oldStr must match exactly once");
      await atomicWrite(filePath, content.replace(oldStr, stringInput(input.newStr, "newStr")));
      return { success: true, linesChanged: Math.max(1, oldStr.split(/\r?\n/).length) };
    }),
    tool("list_files", "List files under a directory.", "read", {}, async (input, context) => ({ files: await listFiles(context.projectRoot, typeof input.dir === "string" ? input.dir : "."), dirs: [] })),
    tool("find_files", "Find files by filename substring.", "read", {}, async (input, context) => {
      const pattern = stringInput(input.pattern, "pattern").toLowerCase();
      return { files: (await listFiles(context.projectRoot, ".")).filter((file) => file.toLowerCase().includes(pattern)) };
    }),
    tool("search_files", "Search file contents.", "read", {}, async (input, context) => ({ matches: await searchFiles(context.projectRoot, stringInput(input.pattern, "pattern")) })),
    tool("find_symbol", "Find a symbol by search.", "read", {}, async (input, context) => ({ matches: await searchFiles(context.projectRoot, stringInput(input.symbol, "symbol")) })),
    tool("run_command", "Run a shell command.", "execute", {}, async (input, context) => {
      const out: { stdout?: string; stderr?: string; code?: number; message?: string } = await execAsync(stringInput(input.command, "command"), { cwd: context.projectRoot, timeout: typeof input.timeout === "number" ? input.timeout : 60000, windowsHide: true })
        .then((value) => ({ stdout: value.stdout, stderr: value.stderr, code: 0 }))
        .catch((error: unknown) => error as { stdout?: string; stderr?: string; code?: number; message?: string });
      return { stdout: sanitize(out.stdout ?? ""), stderr: sanitize(out.stderr ?? out.message ?? ""), exitCode: typeof out.code === "number" ? out.code : 0 };
    }),
    tool("git_status", "Get git status.", "read", {}, async (_input, context) => {
      const branch = (await git(["branch", "--show-current"], context.projectRoot)).stdout.trim();
      const lines = (await git(["status", "--porcelain"], context.projectRoot)).stdout.split(/\r?\n/).filter(Boolean);
      return { branch, staged: lines.filter((line) => line[0] !== " "), unstaged: lines.filter((line) => line[1] !== " "), untracked: lines.filter((line) => line.startsWith("??")) };
    }),
    tool("git_diff", "Get git diff.", "read", {}, async (input, context) => ({ diff: (await git(input.staged === true ? ["diff", "--staged"] : ["diff"], context.projectRoot)).stdout, filesChanged: [], insertions: 0, deletions: 0 })),
    tool("git_log", "Get recent git log.", "read", {}, async (input, context) => ({ commits: (await git(["log", `-${typeof input.n === "number" ? input.n : 10}`, "--pretty=format:%H%x09%an%x09%ad%x09%s", "--date=iso"], context.projectRoot)).stdout.split(/\r?\n/).filter(Boolean) })),
    tool("git_branch", "Get branch list.", "read", {}, async (_input, context) => ({ current: (await git(["branch", "--show-current"], context.projectRoot)).stdout.trim(), branches: (await git(["branch", "--format=%(refname:short)"], context.projectRoot)).stdout.split(/\r?\n/).filter(Boolean) })),
    tool("git_commit", "Commit explicit files.", "write", {}, async (input, context) => {
      if (!Array.isArray(input.files) || !input.files.every((file) => typeof file === "string") || input.files.length === 0) throw new ToolError("git_commit requires explicit files");
      if (input.files.some((file) => file === "." || file === "-A" || file.includes("*"))) throw new ToolError("git_commit rejects wildcards and bulk staging");
      await git(["add", "--", ...input.files], context.projectRoot);
      await git(["commit", "-m", stringInput(input.message, "message")], context.projectRoot);
      return { success: true, hash: (await git(["rev-parse", "HEAD"], context.projectRoot)).stdout.trim() };
    }),
    tool("git_create_branch", "Create a git branch.", "write", {}, async (input, context) => {
      const name = stringInput(input.name, "name");
      await git(["checkout", "-b", name], context.projectRoot);
      return { success: true, branch: name };
    }),
    ...browserTools()
  ];
}

function tool(name: string, description: string, permissionLevel: ToolDefinition["permissionLevel"], properties: JsonObject, execute: (input: JsonObject, context: ToolContext) => Promise<JsonObject>): ToolHandler {
  return { definition: { name, description, permissionLevel, parameters: { type: "object", properties } }, async execute(input, context) { return { id: `${name}-${Date.now()}`, name, success: true, output: await execute(input, context), error: null }; } };
}

async function listFiles(projectRoot: string, dir: string): Promise<string[]> {
  const root = resolveInsideRoot(projectRoot, dir);
  if (!(await exists(root))) return [];
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || ["node_modules", "dist", "coverage"].includes(entry.name)) continue;
    const full = path.join(root, entry.name);
    if (isBrowserSessionPath(projectRoot, full)) continue;
    if (entry.isDirectory()) files.push(...(await listFiles(projectRoot, path.relative(projectRoot, full))));
    else files.push(path.relative(projectRoot, full).replace(/\\/g, "/"));
  }
  return files;
}

function isBrowserSessionPath(projectRoot: string, fullPath: string): boolean {
  const relative = path.relative(projectRoot, fullPath).replace(/\\/g, "/");
  return relative === ".dstack/browser/sessions" || relative.startsWith(".dstack/browser/sessions/");
}

async function searchFiles(projectRoot: string, pattern: string): Promise<Array<{ file: string; line: number; content: string }>> {
  const matches: Array<{ file: string; line: number; content: string }> = [];
  for (const file of await listFiles(projectRoot, ".")) {
    const content = await readFile(path.join(projectRoot, file), "utf8").catch(() => "");
    content.split(/\r?\n/).forEach((line, index) => { if (line.includes(pattern)) matches.push({ file, line: index + 1, content: line }); });
  }
  return matches;
}

function browserTools(): ToolHandler[] {
  const contexts = new Map<string, BrowserContext>();
  const pages = new Map<string, Page>();
  const sessionByDir = new Map<string, string>();
  let activeSession = "default";
  const logs: JsonObject[] = [];
  const refMapManager = new BrowserRefMapManager();
  const open = async (toolContext: ToolContext, sessionName = activeSession): Promise<Page> => {
    activeSession = sessionName;
    const manager = new BrowserSessionManager({ projectRoot: toolContext.projectRoot, dstackDir: toolContext.config.dstackDir });
    const sessionDir = manager.sessionDir(sessionName);
    if (!contexts.has(sessionDir)) {
      await ensureDir(sessionDir);
      const browserContext = await chromium.launchPersistentContext(sessionDir, { headless: toolContext.config.browserHeadless });
      const cookies = (await manager.loadCookies(sessionName)).filter(hasCookieValue);
      if (cookies.length > 0) await browserContext.addCookies(cookies as unknown as Parameters<BrowserContext["addCookies"]>[0]).catch(() => undefined);
      const browserPage = browserContext.pages()[0] ?? await browserContext.newPage();
      browserPage.on("console", (message) => logs.push({ session: sessionName, type: message.type(), text: message.text() }));
      browserPage.on("response", (response) => { if (response.status() >= 400) logs.push({ session: sessionName, url: response.url(), status: response.status(), method: response.request().method() }); });
      contexts.set(sessionDir, browserContext);
      sessionByDir.set(sessionDir, sessionName);
      pages.set(sessionDir, browserPage);
    }
    return pages.get(sessionDir)!;
  };
  return [
    tool("browser_open", "Open a URL.", "execute", {}, async (input, contextArg) => {
      const url = stringInput(input.url, "url");
      const sessionName = typeof input.session === "string" ? input.session : activeSession;
      const manager = new BrowserSessionManager({ projectRoot: contextArg.projectRoot, dstackDir: contextArg.config.dstackDir });
      const p = await open(contextArg, sessionName);
      try {
        await p.goto(url, { waitUntil: "networkidle" });
        manager.recordNavigationSuccess(url);
        return { success: true, title: await p.title(), session: activeSession, authWallPauseRequired: false };
      } catch (error) {
        if (manager.recordNavigationFailure(url)) {
          return {
            success: false,
            title: await p.title().catch(() => ""),
            session: activeSession,
            authWallPauseRequired: true,
            authWallInstructions: "Navigation failed 3 consecutive times for this origin. Open the same URL in a visible browser, complete auth/CAPTCHA/MFA if needed, then retry the DStack browser action.",
            error: error instanceof Error ? error.message : String(error)
          };
        }
        throw error;
      }
    }),
    tool("browser_snapshot", "Capture browser snapshot.", "read", {}, async (input, contextArg) => { 
  const sessionName = typeof input.session === "string" ? input.session : activeSession;
  const p = await open(contextArg, sessionName); 
  const refMap = await generateBrowserSnapshot(p, sessionName);
  refMapManager.setRefMap(sessionName, refMap);
  return refMap as JsonObject; 
}),
    tool("browser_screenshot", "Save a screenshot.", "write", {}, async (input, contextArg) => { const p = await open(contextArg, typeof input.session === "string" ? input.session : activeSession); const filePath = path.join(contextArg.config.dstackDir, "browser", "screenshots", `browser-${typeof input.label === "string" ? input.label : "snapshot"}-${fileSafeTimestamp()}.png`); await ensureDir(path.dirname(filePath)); await p.screenshot({ path: filePath, fullPage: true }); return { path: filePath, session: activeSession }; }),
    tool("browser_click", "Click an element.", "execute", {}, async (input, contextArg) => { 
  const sessionName = typeof input.session === "string" ? input.session : activeSession;
  const p = await open(contextArg, sessionName); 
  const ref = stringInput(input.ref, "ref");
  
  // Resolve ref using ref map
  const resolvedRef = refMapManager.resolveRef(sessionName, ref);
  if (!resolvedRef) {
    if (ref.startsWith("@e")) {
      throw new ToolError(`Ref ${ref} is stale. Run browser_snapshot again.`);
    }
    // Fallback to original behavior for non-@e refs
    await p.getByText(ref).first().click();
    return { success: true, elementFound: true, session: activeSession };
  }
  
  // Use resolved ref - ensure it's clickable
  if (!resolvedRef.clickable) {
    throw new ToolError(`Ref ${ref} (${resolvedRef.role}) is not a clickable element`);
  }
  
  let element;
  if (resolvedRef.source === "testid") {
    element = p.locator(resolvedRef.selectorHint);
  } else if (resolvedRef.source === "role") {
    element = p.locator(resolvedRef.selectorHint).filter({ hasText: resolvedRef.name });
  } else if (resolvedRef.source === "text") {
    element = p.getByText(resolvedRef.name);
  } else {
    element = p.locator(resolvedRef.selectorHint);
  }
  
  await element.first().click();
  return { success: true, elementFound: true, session: activeSession, clickedRef: resolvedRef.ref }; 
}),
    tool("browser_type", "Type into an element.", "execute", {}, async (input, contextArg) => { 
  const sessionName = typeof input.session === "string" ? input.session : activeSession;
  const p = await open(contextArg, sessionName); 
  const ref = stringInput(input.ref, "ref");
  const text = stringInput(input.text, "text");
  
  // Resolve ref using ref map
  const resolvedRef = refMapManager.resolveRef(sessionName, ref);
  if (!resolvedRef) {
    if (ref.startsWith("@e")) {
      throw new ToolError(`Ref ${ref} is stale. Run browser_snapshot again.`);
    }
    // Fallback to original behavior for non-@e refs
    await p.locator(ref).first().fill(text);
    return { success: true, session: activeSession };
  }
  
  // Use resolved ref - ensure it's fillable
  if (!resolvedRef.fillable) {
    throw new ToolError(`Ref ${ref} (${resolvedRef.role}) is not a fillable element`);
  }
  
  let element;
  if (resolvedRef.source === "testid") {
    element = p.locator(resolvedRef.selectorHint);
  } else if (resolvedRef.source === "role") {
    element = p.locator(resolvedRef.selectorHint).filter({ hasText: resolvedRef.name });
  } else if (resolvedRef.source === "text") {
    element = p.getByText(resolvedRef.name);
  } else {
    element = p.locator(resolvedRef.selectorHint);
  }
  
  await element.first().fill(text);
  return { success: true, session: activeSession, typedRef: resolvedRef.ref }; 
}),
    tool("browser_get_logs", "Get browser logs.", "read", {}, async () => ({ consoleLogs: logs, networkLogs: logs })),
    tool("browser_close", "Close browser.", "execute", {}, async (_input, contextArg) => {
      const manager = new BrowserSessionManager({ projectRoot: contextArg.projectRoot, dstackDir: contextArg.config.dstackDir });
      for (const [sessionDir, browserContext] of contexts.entries()) {
        const sessionName = sessionByDir.get(sessionDir) ?? "default";
        const cookies = await browserContext.cookies().catch(() => []);
        await manager.saveCookies(sessionName, cookies as unknown as JsonObject[]).catch(() => undefined);
        await manager.saveStorageState(sessionName, await browserContext.storageState() as unknown as JsonObject).catch(() => undefined);
        await browserContext.close();
      }
      contexts.clear();
      pages.clear();
      sessionByDir.clear();
      activeSession = "default";
      return { success: true };
    })
  ];
}

function stringInput(value: unknown, name: string): string {
  if (typeof value !== "string") throw new ToolError(`Expected string input: ${name}`);
  return value;
}

function hasCookieValue(cookie: JsonObject): boolean {
  return typeof cookie.name === "string" && typeof cookie.value === "string" && (typeof cookie.url === "string" || typeof cookie.domain === "string");
}

async function sanitizeToolResult(result: ToolResult, toolName: string, logger: SessionLogger | null): Promise<ToolResult> {
  const output = sanitizeJsonObject(result.output, toolName, logger);
  return { ...result, output, error: result.error ? sanitize(result.error) : null };
}

function sanitizeJsonObject(value: JsonObject, toolName: string, logger: SessionLogger | null): JsonObject {
  return sanitizeJsonValue(value, toolName, logger) as JsonObject;
}

function sanitizeJsonValue(value: unknown, toolName: string, logger: SessionLogger | null): unknown {
  if (typeof value === "string") {
    const sanitizedSecret = sanitize(value);
    if (!toolName.startsWith("browser_")) return sanitizedSecret;
    const scan = scanDomContent(sanitizedSecret);
    if (scan.detected) {
      void logger?.event("error", "browser_prompt_injection_redacted", { tool: toolName, fragments: scan.fragments });
    }
    return scan.sanitized;
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeJsonValue(item, toolName, logger));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeJsonValue(item, toolName, logger)]));
  }
  return value;
}
