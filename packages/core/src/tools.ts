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
    this.gate = new PermissionGate({ interactive: options.interactive, dstackDir: options.config.dstackDir });
  }
  async dispatch(toolCall: ToolCall): Promise<ToolResult> {
    this.calls += 1;
    if (this.calls > this.options.config.maxToolCalls) throw new PermissionError("Tool call limit exceeded");
    const permission = await this.gate.check(toolCall);
    await this.options.logger?.event("info", "tool_permission", { tool: toolCall.name, permission });
    if (permission === "DENY") throw new PermissionError(`Tool call denied: ${toolCall.name}`);
    try {
      const result = await this.registry.get(toolCall.name).execute(toolCall.input, { projectRoot: this.options.projectRoot, config: this.options.config, logger: this.options.logger });
      return await sanitizeToolResult(result, toolCall.name, this.options.logger);
    } catch (error) {
      return { id: toolCall.id, name: toolCall.name, success: false, output: {}, error: error instanceof Error ? error.message : String(error) };
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
    if (entry.isDirectory()) files.push(...(await listFiles(projectRoot, path.relative(projectRoot, full))));
    else files.push(path.relative(projectRoot, full).replace(/\\/g, "/"));
  }
  return files;
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
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  const logs: JsonObject[] = [];
  const open = async (toolContext: ToolContext): Promise<Page> => {
    if (!context) {
      await ensureDir(path.join(toolContext.config.dstackDir, "browser", "session"));
      context = await chromium.launchPersistentContext(path.join(toolContext.config.dstackDir, "browser", "session"), { headless: toolContext.config.browserHeadless });
      page = context.pages()[0] ?? await context.newPage();
      page.on("console", (message) => logs.push({ type: message.type(), text: message.text() }));
      page.on("response", (response) => { if (response.status() >= 400) logs.push({ url: response.url(), status: response.status(), method: response.request().method() }); });
    }
    return page!;
  };
  return [
    tool("browser_open", "Open a URL.", "execute", {}, async (input, contextArg) => { const p = await open(contextArg); await p.goto(stringInput(input.url, "url"), { waitUntil: "networkidle" }); return { success: true, title: await p.title() }; }),
    tool("browser_snapshot", "Capture browser snapshot.", "read", {}, async (_input, contextArg) => { const p = await open(contextArg); const scan = scanDomContent(await p.locator("body").innerText().catch(() => "")); return { url: p.url(), title: await p.title(), text: scan.sanitized, ariaTree: "", timestamp: new Date().toISOString(), promptInjectionDetected: scan.detected, promptInjectionFragments: scan.fragments }; }),
    tool("browser_screenshot", "Save a screenshot.", "write", {}, async (input, contextArg) => { const p = await open(contextArg); const filePath = path.join(contextArg.config.dstackDir, "browser", "screenshots", `browser-${typeof input.label === "string" ? input.label : "snapshot"}-${fileSafeTimestamp()}.png`); await ensureDir(path.dirname(filePath)); await p.screenshot({ path: filePath, fullPage: true }); return { path: filePath }; }),
    tool("browser_click", "Click an element.", "execute", {}, async (input, contextArg) => { const p = await open(contextArg); await p.getByText(stringInput(input.ref, "ref")).first().click(); return { success: true, elementFound: true }; }),
    tool("browser_type", "Type into an element.", "execute", {}, async (input, contextArg) => { const p = await open(contextArg); await p.locator(stringInput(input.ref, "ref")).first().fill(stringInput(input.text, "text")); return { success: true }; }),
    tool("browser_get_logs", "Get browser logs.", "read", {}, async () => ({ consoleLogs: logs, networkLogs: logs })),
    tool("browser_close", "Close browser.", "execute", {}, async () => { await context?.close(); context = null; page = null; return { success: true }; })
  ];
}

function stringInput(value: unknown, name: string): string {
  if (typeof value !== "string") throw new ToolError(`Expected string input: ${name}`);
  return value;
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
