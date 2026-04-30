import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  ArtifactStore,
  ConfigManager,
  FakeProvider,
  GeminiProvider,
  SkillExecutor,
  SkillRegistry,
  StreamHandler,
  ToolExecutor,
  ToolRegistry,
  type ToolHandler
} from "@dstack/core";
import type { DStackConfig, JsonObject, ModelChunk, SkillInvocation } from "@dstack/shared";
import { tempWorkspace } from "../helpers/temp-workspace.js";

const baseFlags = { force: false, dryRun: false, noStream: false, model: null, provider: null, allowSecrets: false };
let server: Server | null = null;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => server?.close((error) => error ? reject(error) : resolve()));
    server = null;
  }
});

describe("Phase 1 runtime audit", () => {
  it("runs every Phase 1 skill end-to-end with FakeProvider and writes valid latest artifacts", async () => {
    const workspace = await tempWorkspace();
    try {
      const config = await ConfigManager.load({ projectRoot: workspace.root });
      const fake = new FakeProvider();
      for (const output of [
        officeHoursOutput(),
        autoplanOutput(),
        ceoReviewOutput("PASS"),
        engReviewOutput("PASS"),
        designConsultationOutput(),
        designReviewOutput("PASS"),
        reviewOutput("PASS"),
        qaOutput("PASS"),
        shipOutput(true),
        qaOnlyOutput("PASS"),
        investigateOutput(),
        browseOutput()
      ]) {
        fake.enqueue(JSON.stringify(output));
      }
      const executor = new SkillExecutor({ config, providerOverride: fake, interactive: false });
      for (const [skillName, inputs] of [
        ["/office-hours", { idea: "Build DStack" }],
        ["/autoplan", {}],
        ["/plan-ceo-review", {}],
        ["/plan-eng-review", {}],
        ["/design-consultation", {}],
        ["/design-review", {}],
        ["/review", {}],
        ["/qa", {}],
        ["/ship", {}],
        ["/context-save", { name: "audit" }],
        ["/context-restore", { name: "audit" }],
        ["/qa-only", {}],
        ["/investigate", { issue: "audit check" }],
        ["/browse", { url: "http://localhost:3000" }]
      ] as Array<[string, Record<string, string>]>) {
        const result = await executor.run(invocation(skillName, workspace.root, inputs));
        expect(result.status).toBe("complete");
        expect(result.artifactPath).toBeTruthy();
      }
      const artifacts = new ArtifactStore(config.dstackDir);
      for (const skillName of [
        "office-hours",
        "autoplan",
        "plan-ceo-review",
        "plan-eng-review",
        "design-consultation",
        "design-review",
        "review",
        "qa",
        "ship",
        "context-save",
        "context-restore",
        "qa-only",
        "investigate",
        "browse"
      ]) {
        const artifact = await artifacts.readLatest(skillName);
        expect(artifact, skillName).toBeTruthy();
        expect(Object.keys(artifact!.content).length, skillName).toBeGreaterThan(0);
      }
    } finally {
      await workspace.cleanup();
    }
  }, 30000);

  it("resolves every tool declared by Phase 1 skill manifests", async () => {
    const registry = new ToolRegistry();
    const skills = await new SkillRegistry().list();
    const declaredTools = new Set(skills.flatMap((skill) => skill.allowedTools));
    for (const toolName of declaredTools) {
      expect(() => registry.get(toolName), toolName).not.toThrow();
    }
  });

  it("applies PermissionGate before executing a denied tool handler", async () => {
    const workspace = await tempWorkspace();
    try {
      const config = await ConfigManager.load({ projectRoot: workspace.root });
      let executed = false;
      const handler: ToolHandler = {
        definition: { name: "run_command", description: "test", permissionLevel: "execute", parameters: { type: "object" } },
        async execute() {
          executed = true;
          return { id: "run_command", name: "run_command", success: true, output: { ok: true }, error: null };
        }
      };
      const executor = new ToolExecutor(new ToolRegistry([handler]), { projectRoot: workspace.root, config, logger: null, interactive: false });
      await expect(executor.dispatch({ id: "deny", name: "run_command", input: { command: "rm -rf ." } })).rejects.toThrow("denied");
      expect(executed).toBe(false);
    } finally {
      await workspace.cleanup();
    }
  });

  it("runs browser tools against localhost through ToolExecutor", async () => {
    const workspace = await tempWorkspace();
    try {
      const config = { ...(await ConfigManager.load({ projectRoot: workspace.root })), browserHeadless: true, requestTimeoutMs: 30000 } satisfies DStackConfig;
      const url = await startLocalhostServer();
      const executor = new ToolExecutor(new ToolRegistry(), { projectRoot: workspace.root, config, logger: null, interactive: false });
      const opened = await executor.dispatch({ id: "open", name: "browser_open", input: { url } });
      expect(opened.success).toBe(true);
      const snapshot = await executor.dispatch({ id: "snapshot", name: "browser_snapshot", input: {} });
      expect(snapshot.output.text).toContain("DStack Browser Audit");
      const screenshot = await executor.dispatch({ id: "screenshot", name: "browser_screenshot", input: { label: "audit" } });
      expect(String(screenshot.output.path)).toContain(".dstack");
      await executor.dispatch({ id: "logs", name: "browser_get_logs", input: {} });
      await executor.dispatch({ id: "close", name: "browser_close", input: {} });
    } finally {
      await workspace.cleanup();
    }
  }, 60000);

  it("refuses /ship when QA is missing", async () => {
    const workspace = await tempWorkspace();
    try {
      const config = await ConfigManager.load({ projectRoot: workspace.root });
      await new ArtifactStore(config.dstackDir).write("review", reviewOutput("PASS"));
      const executor = new SkillExecutor({ config, providerOverride: new FakeProvider(), interactive: false });
      await expect(executor.run(invocation("/ship", workspace.root))).rejects.toThrow("requires /qa");
    } finally {
      await workspace.cleanup();
    }
  });

  it("refuses /ship when QA is failing", async () => {
    const workspace = await tempWorkspace();
    try {
      const config = await ConfigManager.load({ projectRoot: workspace.root });
      const artifacts = new ArtifactStore(config.dstackDir);
      await artifacts.write("review", reviewOutput("PASS"));
      await artifacts.write("qa", qaOutput("FAIL"));
      const executor = new SkillExecutor({ config, providerOverride: new FakeProvider(), interactive: false });
      await expect(executor.run(invocation("/ship", workspace.root))).rejects.toThrow("blocked until /qa");
    } finally {
      await workspace.cleanup();
    }
  });
});

describe("Phase 2 integration", () => {
  it("runs the Phase 1 to Phase 2 workflow with FakeProvider", async () => {
    const workspace = await tempWorkspace();
    try {
      const config = await ConfigManager.load({ projectRoot: workspace.root });
      const executor = new SkillExecutor({ config, providerOverride: new FakeProvider(), interactive: false });
      const commands: Array<[string, Record<string, string | boolean | number>]> = [
        ["/office-hours", { idea: "Build a workflow product" }],
        ["/autoplan", {}],
        ["/plan-ceo-review", {}],
        ["/plan-eng-review", {}],
        ["/plan-devex-review", {}],
        ["/plan-tune", {}],
        ["/plan-design-review", {}],
        ["/design-consultation", {}],
        ["/design-shotgun", { screen: "Primary workflow" }],
        ["/design-html", { screen: "Primary workflow" }],
        ["/design-review", {}],
        ["/review", {}],
        ["/devex-review", {}],
        ["/qa", {}],
        ["/ship", {}],
        ["/setup-deploy", { command: "echo deploy" }],
        ["/canary", {}],
        ["/land-and-deploy", { env: "staging" }],
        ["/retro", {}],
        ["/setup-memory", { "import-retro": true }],
        ["/context-save", { name: "phase2" }],
        ["/health", {}]
      ];
      for (const [skillName, inputs] of commands) {
        const result = await executor.run(invocation(skillName, workspace.root, inputs));
        expect(result.status, skillName).toBe("complete");
        expect(result.artifactPath, skillName).toBeTruthy();
      }
      const artifacts = new ArtifactStore(config.dstackDir);
      for (const [skillName] of commands) {
        const name = skillName.replace(/^\//, "");
        const artifact = await artifacts.readLatest(name);
        expect(artifact?.content.generated_by, name).toBe("fake-provider");
      }
      const health = await artifacts.readLatest("health");
      expect(Number(health?.content.healthScore ?? 0)).toBeGreaterThan(80);
    } finally {
      await workspace.cleanup();
    }
  }, 60000);

  it("runs safety and deploy control skills", async () => {
    const workspace = await tempWorkspace();
    try {
      const config = await ConfigManager.load({ projectRoot: workspace.root });
      const executor = new SkillExecutor({ config, providerOverride: new FakeProvider(), interactive: false });
      await executor.run(invocation("/guard", workspace.root));
      await expect(new ToolExecutor(new ToolRegistry(), { projectRoot: workspace.root, config, logger: null, interactive: false }).dispatch({ id: "write", name: "write_file", input: { path: "x.txt", content: "x" } })).rejects.toThrow("denied");
      await executor.run(invocation("/careful", workspace.root));
      await expect(new ToolExecutor(new ToolRegistry(), { projectRoot: workspace.root, config, logger: null, interactive: false }).dispatch({ id: "test", name: "run_command", input: { command: "pnpm test" } })).rejects.toThrow("requires approval");
    } finally {
      await workspace.cleanup();
    }
  });

  it("blocks land-and-deploy while frozen", async () => {
    const workspace = await tempWorkspace();
    try {
      const config = await ConfigManager.load({ projectRoot: workspace.root });
      const executor = new SkillExecutor({ config, providerOverride: new FakeProvider(), interactive: false });
      const artifacts = new ArtifactStore(config.dstackDir);
      await artifacts.write("review", reviewOutput("PASS"));
      await artifacts.write("qa", qaOutput("PASS"));
      await artifacts.write("ship", shipOutput(true));
      await executor.run(invocation("/setup-deploy", workspace.root, { command: "echo deploy" }));
      await executor.run(invocation("/freeze", workspace.root, { reason: "test" }));
      const result = await executor.run(invocation("/land-and-deploy", workspace.root, { env: "staging" }));
      expect(result.output?.deployVerdict).toBe("FAIL");
      expect(String(result.output?.blockers)).toContain("freeze");
    } finally {
      await workspace.cleanup();
    }
  });
});

describe("GeminiProvider optional live dry run", () => {
  it.skipIf(!process.env.GEMINI_API_KEY)("performs one real dry run when GEMINI_API_KEY is present", async () => {
    const provider = new GeminiProvider(process.env.GEMINI_API_KEY ?? null);
    const chunks: ModelChunk[] = [];
    for await (const chunk of provider.generate({
      model: process.env.DSTACK_DEFAULT_MODEL ?? "gemini-2.0-flash-001",
      systemPrompt: "Return only valid JSON.",
      userMessage: "Return {\"ok\":true}.",
      tools: [],
      responseMimeType: "application/json",
      temperature: 0,
      maxOutputTokens: 128
    })) {
      chunks.push(chunk);
    }
    const response = await new StreamHandler().collect((async function* () {
      for (const chunk of chunks) yield chunk;
    })());
    expect(response.text).toContain("ok");
  }, 120000);
});

function invocation(skillName: string, projectRoot: string, inputs: Record<string, string | boolean | number> = {}): SkillInvocation {
  return { skillName, projectRoot, inputs, flags: { ...baseFlags } };
}

function officeHoursOutput(): JsonObject {
  return { projectName: "DStack", summary: "Workflow system", targetUsers: ["developers"], coreProblem: "shipping discipline", successMetrics: ["artifacts"], techStack: { backend: "TypeScript" }, constraints: [], outOfScope: [], openQuestions: [] };
}
function autoplanOutput(): JsonObject {
  return { planVersion: "1", generatedAt: "now", phases: [{ name: "Phase 1", goal: "ship", tasks: [] }], openDecisions: [], riskFlags: ["runtime"], assumptionsMade: [] };
}
function ceoReviewOutput(verdict: "PASS" | "REVISE" | "FAIL"): JsonObject {
  return { overallVerdict: verdict, phaseReviews: [], globalConcerns: [], mustFixBeforeProceeding: verdict === "PASS" ? [] : ["revise"], approvedAspects: ["scope"] };
}
function engReviewOutput(verdict: "PASS" | "REVISE" | "FAIL"): JsonObject {
  return { overallVerdict: verdict, taskReviews: [], architectureConcerns: [], missingInfrastructure: [], securityFlags: [], testingGaps: [], mustFixBeforeProceeding: verdict === "PASS" ? [] : ["revise"] };
}
function designConsultationOutput(): JsonObject {
  return { screens: [], userFlows: [], designPrinciples: ["clear"], responsiveStrategy: "desktop first", openDesignDecisions: [] };
}
function designReviewOutput(verdict: "PASS" | "REVISE" | "FAIL"): JsonObject {
  return { overallVerdict: verdict, screenReviews: [], uxAntiPatterns: [], accessibilityFailures: [], mustFixBeforeProceeding: verdict === "PASS" ? [] : ["fix"] };
}
function reviewOutput(verdict: "PASS" | "REVISE" | "FAIL"): JsonObject {
  return { reviewedFiles: [], fileReviews: [], overallVerdict: verdict, summary: "ok", criticalIssues: verdict === "FAIL" ? ["critical"] : [] };
}
function qaOutput(verdict: "PASS" | "FAIL"): JsonObject {
  return { passedChecks: [], failedChecks: [], testResults: { passed: 1, failed: verdict === "PASS" ? 0 : 1, skipped: 0, testCommand: "pnpm test" }, browserFindings: [], overallVerdict: verdict, blockers: verdict === "PASS" ? [] : ["failing"], recommendations: [] };
}
function qaOnlyOutput(verdict: "PASS" | "FAIL"): JsonObject {
  return { testCommand: "pnpm test", passed: 1, failed: verdict === "PASS" ? 0 : 1, skipped: 0, failures: [], overallVerdict: verdict };
}
function investigateOutput(): JsonObject {
  return { issue: "audit check", rootCause: "none", confidence: "low", relevantFiles: [], executionTrace: [], proposedFix: {}, alternativeHypotheses: [] };
}
function shipOutput(shippable: boolean): JsonObject {
  return { shippable, gateResults: [], blockers: shippable ? [] : ["blocked"], changelogEntry: "Initial", suggestedTag: "v0.1.0", deployCommand: "", deployedAt: null };
}
function browseOutput(): JsonObject {
  return { url: "http://localhost:3000", title: "Audit", summary: "ok", consoleErrors: [], networkErrors: [], accessibilityIssues: [], interactiveElements: [], screenshotPath: "", recommendations: [] };
}

async function startLocalhostServer(): Promise<string> {
  server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<!doctype html><title>Audit</title><main><h1>DStack Browser Audit</h1><button>Run</button></main>");
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}
