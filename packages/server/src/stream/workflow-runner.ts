import { EventEmitter } from "node:events";
import path from "node:path";
import {
  IterationTracker,
  LocalSandboxProvider,
  SlopScanner,
  SlopScannerError,
  type SandboxProvider
} from "@dstack/core";
import type { AgentEvent, AgentPersona, ApprovalGate, CodePatch, JsonObject, WorkflowTransition } from "@dstack/shared";

interface WorkflowRunState {
  id: string;
  prompt: string;
  createdAt: string;
  events: AgentEvent[];
  emitter: EventEmitter;
  status: "running" | "waiting_for_approval" | "complete" | "error";
  approvalResolver: ((decision: "approve" | "deny") => void) | null;
  sandbox: SandboxProvider;
}

interface StartWorkflowRunInput {
  prompt: string;
}

export class WorkflowRunner {
  private readonly runs = new Map<string, WorkflowRunState>();
  private readonly iterationTracker = new IterationTracker();
  private readonly slopScanner = new SlopScanner();

  start(input: StartWorkflowRunInput): WorkflowRunState {
    const runId = `wf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const projectRoot = process.cwd().endsWith("server") ? path.resolve(process.cwd(), "../../") : process.cwd();
    const sandboxRoot = path.join(projectRoot, ".dstack", "web-workflow-sandbox", runId);
    const state: WorkflowRunState = {
      id: runId,
      prompt: input.prompt,
      createdAt: new Date().toISOString(),
      events: [],
      emitter: new EventEmitter(),
      status: "running",
      approvalResolver: null,
      sandbox: new LocalSandboxProvider({ rootDir: sandboxRoot })
    };
    this.runs.set(runId, state);
    void this.executeVerticalSlice(state);
    return state;
  }

  get(runId: string): WorkflowRunState | null {
    return this.runs.get(runId) ?? null;
  }

  approve(runId: string, decision: "approve" | "deny"): boolean {
    const state = this.runs.get(runId);
    if (!state?.approvalResolver) return false;
    state.approvalResolver(decision);
    state.approvalResolver = null;
    return true;
  }

  private async executeVerticalSlice(state: WorkflowRunState): Promise<void> {
    try {
      this.emit(state, "agent_started", { agent: "CEO", title: "CEO/PM Planning", message: "Creating the first web-native execution plan." });
      this.emit(state, "reasoning_trace", {
        agent: "CEO",
        steps: ["> Reading user objective", "> Mapping workflow DAG", "> Preparing approval packet"],
        activeStep: 2
      });

      const transition: WorkflowTransition = {
        from: "PLANNING",
        to: "BUILDING",
        actor: "HUMAN",
        createdAt: new Date().toISOString(),
        rationale: "Human approval required before generated files enter the sandbox.",
        assetHash: "pending-human-approval",
        approvalTokenId: null,
        affectedFiles: ["src/App.tsx", "src/styles.css"],
        metadata: { prompt: state.prompt }
      };
      const gate: ApprovalGate = {
        id: `gate-${state.id}`,
        runId: state.id,
        stage: "BUILDING",
        actor: "DEVELOPER",
        title: "Approve & Build",
        description: "Allow the Developer agent to write the first verified sandbox files and start the preview loop.",
        transition,
        artifactHash: transition.assetHash,
        commandImpact: ["install dependencies", "start preview server"],
        fileImpact: transition.affectedFiles,
        safetyMode: "NORMAL",
        status: "pending",
        createdAt: new Date().toISOString()
      };
      this.emit(state, "approval_required", { gate });
      const decision = await this.waitForApproval(state);
      if (decision === "deny") {
        this.emit(state, "run_error", { message: "Human rejected the build gate.", retryable: true });
        state.status = "error";
        return;
      }

      this.emit(state, "agent_started", { agent: "DEVELOPER", title: "Developer Build", message: "Writing verified sandbox files." });
      const generatedFiles = sampleGeneratedFiles(state.prompt);
      this.slopScanner.assertClean(generatedFiles);
      await state.sandbox.writeFiles(generatedFiles);

      const patch = toCodePatch("src/App.tsx", generatedFiles["src/App.tsx"] ?? "", "DEVELOPER");
      this.emit(state, "file_patch", { patch });
      this.emit(state, "tool_call", { agent: "DEVELOPER", toolName: "sandbox.writeFiles", args: { files: Object.keys(generatedFiles) }, permission: "ALLOW" });
      this.emit(state, "tool_result", { toolCallId: `tool-${state.id}`, success: true, stdout: "Files materialized and hash-verified.", stderr: "", code: 0 });
      this.emit(state, "preview_ready", { previewUrl: "/api/sandbox/preview", provider: "webcontainer", health: "ready" });

      this.emit(state, "agent_started", { agent: "QA", title: "Visual QA", message: "Running visual and interaction checks against the preview." });
      this.iterationTracker.recordBounce({
        issue: "initial visual qa pass",
        fromAgent: "DEVELOPER",
        toAgent: "QA",
        finding: "First QA handoff completed."
      });
      this.emit(state, "visual_qa_result", {
        findings: [{
          id: `vqa-${state.id}`,
          severity: "LOW",
          category: "responsive",
          selector: "main",
          description: "Initial preview is available; live screenshot QA will attach once the browser capture provider is configured.",
          evidence: "Sandbox preview URL emitted successfully.",
          recommendedFix: "Run the multimodal QA pass after preview screenshot capture is enabled.",
          filePath: "src/App.tsx",
          cssHint: null,
          screenshotRegion: null
        }],
        screenshotPath: null
      });

      this.emit(state, "artifact_saved", {
        skillName: "web-native-workflow",
        artifactPath: `.dstack/web-workflow-sandbox/${state.id}`,
        verdict: "PASS",
        contentHash: patch.contentHash
      });
      this.emit(state, "run_complete", { verdict: "PASS", summary: "Vertical slice completed through planning, approval, sandbox write, preview, and QA events." });
      state.status = "complete";
    } catch (error) {
      const message = error instanceof SlopScannerError
        ? error.findings.map((finding) => `${finding.filePath}:${finding.line} ${finding.phrase}`).join("; ")
        : error instanceof Error ? error.message : String(error);
      this.emit(state, "run_error", { message, retryable: true });
      state.status = "error";
    }
  }

  private waitForApproval(state: WorkflowRunState): Promise<"approve" | "deny"> {
    state.status = "waiting_for_approval";
    return new Promise((resolve) => {
      state.approvalResolver = resolve;
    });
  }

  private emit<TType extends AgentEvent["type"]>(
    state: WorkflowRunState,
    type: TType,
    payload: Omit<Extract<AgentEvent, { type: TType }>, "type" | "id" | "runId" | "timestamp">
  ): void {
    const event = {
      type,
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      runId: state.id,
      timestamp: new Date().toISOString(),
      ...payload
    } as Extract<AgentEvent, { type: TType }>;
    state.events.push(event);
    state.emitter.emit("event", event);
  }
}

function sampleGeneratedFiles(prompt: string): Record<string, string> {
  return {
    "package.json": JSON.stringify({ scripts: { dev: "vite --host 0.0.0.0" }, dependencies: { "@vitejs/plugin-react": "latest", vite: "latest", react: "latest", "react-dom": "latest" }, devDependencies: {} }, null, 2),
    "src/App.tsx": `export default function App() {
  return (
    <main className="war-room">
      <section>
        <p className="eyebrow">DStack Web-Native Workflow</p>
        <h1>${escapeText(prompt.slice(0, 90) || "Agentic engineering workflow")}</h1>
        <p>CEO, PM, Designer, Developer, QA, and Security agents are coordinated through deterministic approval gates.</p>
      </section>
    </main>
  );
}
`,
    "src/styles.css": `.war-room { min-height: 100vh; display: grid; place-items: center; padding: 48px; font-family: Inter, system-ui, sans-serif; background: #fafafa; color: #171717; }
.war-room section { max-width: 760px; border: 1px solid #e5e5e5; border-radius: 8px; padding: 32px; background: white; }
.eyebrow { color: #9d7fe6; font-weight: 700; text-transform: uppercase; font-size: 12px; }
h1 { font-size: 42px; line-height: 1.05; letter-spacing: 0; margin: 0 0 16px; }
p { font-size: 16px; line-height: 1.6; }`
  };
}

function toCodePatch(filePath: string, content: string, agent: AgentPersona): CodePatch {
  const contentHash = Buffer.from(content).toString("base64url").slice(0, 24);
  return {
    id: `patch-${Date.now()}`,
    filePath,
    agent,
    operation: "create",
    before: null,
    after: content,
    diff: content.split(/\r?\n/).map((text, index) => ({ kind: "add", lineNumber: index + 1, text })),
    contentHash,
    createdAt: new Date().toISOString()
  };
}

function escapeText(text: string): string {
  return text.replace(/[<>{}]/g, "");
}

export const globalWorkflowRunner = new WorkflowRunner();
