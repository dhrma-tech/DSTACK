import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { ModelError, type DStackConfig, type JsonObject, type ModelChunk, type ModelRequest, type ModelResponse, type Provider, type SkillManifest, type ToolCall } from "@dstack/shared";
import { defaultOutputs } from "./default-outputs.js";
import { shortHash } from "./utils.js";

export class FakeProvider implements Provider {
  private readonly responses: Array<{ text: string; toolCalls: ToolCall[] }> = [];
  enqueue(text: string, toolCalls: ToolCall[] = []): void {
    this.responses.push({ text, toolCalls });
  }
  hashFor(request: ModelRequest): string {
    return shortHash(`${request.systemPrompt}\n${request.userMessage}`, 16);
  }
  async *generate(request: ModelRequest): AsyncIterableIterator<ModelChunk> {
    const response = this.responses.shift() ?? { text: JSON.stringify(fakeOutputForRequest(request)), toolCalls: [] };
    for (const toolCall of response.toolCalls) yield { type: "tool-call", toolCall };
    if (response.text) yield { type: "text", text: markFakeProvider(response.text) };
    yield { type: "done" };
  }
  async countTokens(input: string): Promise<number> {
    return Math.ceil(input.length / 4);
  }
}

export class GeminiProvider implements Provider {
  private readonly client: GoogleGenerativeAI;
  constructor(apiKey: string | null) {
    if (!apiKey) throw new ModelError("GEMINI_API_KEY is required for live Gemini runs. Set GEMINI_API_KEY for Gemini, or run with --provider=fake / DSTACK_PROVIDER=fake for offline mode.");
    this.client = new GoogleGenerativeAI(apiKey);
  }
  async *generate(request: ModelRequest): AsyncIterableIterator<ModelChunk> {
    const model = this.client.getGenerativeModel({ model: request.model, systemInstruction: request.systemPrompt });
    try {
      const requestPayload = {
        contents: [{ role: "user", parts: [{ text: request.userMessage }] }],
        ...(request.tools.length > 0 ? { tools: [{ functionDeclarations: request.tools.map((tool) => ({ name: tool.name, description: tool.description, parameters: toGeminiSchema(tool.parameters) })) }] } : {}),
        generationConfig: { temperature: request.temperature, maxOutputTokens: request.maxOutputTokens, responseMimeType: request.responseMimeType }
      } as unknown as Parameters<typeof model.generateContentStream>[0];
      const stream = await model.generateContentStream(requestPayload);
      for await (const chunk of stream.stream) {
        const text = chunk.text();
        if (text) yield { type: "text", text };
        for (const call of chunk.functionCalls() ?? []) {
          yield { type: "tool-call", toolCall: { id: `${call.name}-${Date.now()}`, name: call.name, input: normalizeArgs(call.args) } };
        }
      }
      yield { type: "done" };
    } catch (error) {
      throw geminiError(error);
    }
  }
  async countTokens(input: string, modelName: string): Promise<number> {
    const model = this.client.getGenerativeModel({ model: modelName });
    return (await model.countTokens(input)).totalTokens;
  }
}

export class ModelRouter {
  constructor(private readonly config: DStackConfig, private readonly overrideProvider: Provider | null = null) {}
  resolve(skill: SkillManifest, cliModel: string | null): { provider: Provider; model: string } {
    const provider = this.overrideProvider ?? (this.config.provider === "fake" ? new FakeProvider() : new GeminiProvider(this.config.geminiApiKey));
    return { provider, model: cliModel ?? this.config.skillOverrides[skill.name]?.model ?? skill.model };
  }
}

export class StreamHandler {
  async collect(chunks: AsyncIterableIterator<ModelChunk>): Promise<ModelResponse> {
    let text = "";
    const toolCalls: ToolCall[] = [];
    for await (const chunk of chunks) {
      if (chunk.type === "text" && chunk.text) text += chunk.text;
      if (chunk.type === "tool-call" && chunk.toolCall) toolCalls.push(chunk.toolCall);
    }
    return { text, toolCalls, inputTokens: 0, outputTokens: Math.ceil(text.length / 4), stopReason: "stop" };
  }
}

function normalizeArgs(args: unknown): JsonObject {
  return typeof args === "object" && args !== null && !Array.isArray(args) ? args as JsonObject : {};
}
function toGeminiSchema(schema: JsonObject): JsonObject {
  return Object.keys(schema).length > 0 ? schema : { type: SchemaType.OBJECT, properties: {} };
}
function markFakeProvider(text: string): string {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return JSON.stringify({ ...parsed as JsonObject, generated_by: "fake-provider" });
    }
  } catch {
    return text;
  }
  return text;
}
function fakeOutputForRequest(request: ModelRequest): JsonObject {
  const skillName = extractSkillName(request.systemPrompt) ?? extractSkillName(request.userMessage) ?? "unknown";
  const output = structuredClone(defaultOutputs[skillName] ?? { summary: `Fake output for ${skillName}` }) as JsonObject;
  const context = fakeRequestContext(request);
  const now = new Date().toISOString();
  const projectName = fakeProjectName(context);
  const idea = fakeIdea(context);
  const reviewedFiles = fakeChangedFiles(context);
  const primaryTaskId = fakePrimaryTaskId(context);
  const common = { generated_by: "fake-provider", generatedAt: now };
  switch (skillName) {
    case "office-hours":
      return {
        ...output,
        ...common,
        projectName,
        summary: `Offline fake-provider brief for ${idea}.`,
        targetUsers: ["Primary users", "Project maintainers"],
        coreProblem: "The project needs a clear, auditable workflow before implementation continues.",
        successMetrics: ["Phase 1 artifacts are created", "Workflow gates can be exercised offline"],
        techStack: { frontend: "unspecified", backend: "unspecified", infra: "local development" },
        constraints: ["Offline fake-provider output", "No live model calls"],
        outOfScope: ["Production approval", "Provider-specific model evaluation"],
        openQuestions: ["Which implementation details should be refined with a live model later?"]
      };
    case "autoplan":
      return {
        ...output,
        ...common,
        planVersion: "fake-1",
        phases: [
          { name: "Phase 0", goal: "Clarify scope and baseline state", tasks: [{ id: "P0-T1", title: "Confirm project brief", estimateHours: 1, dependencies: [], riskLevel: "low", tags: ["planning"] }] },
          { name: "Phase 1", goal: "Implement the smallest useful workflow", tasks: [{ id: "P1-T1", title: "Build core path", estimateHours: 3, dependencies: ["P0-T1"], riskLevel: "medium", tags: ["implementation"] }] },
          { name: "Phase 2", goal: "Validate quality gates", tasks: [{ id: "P2-T1", title: "Run review and QA gates", estimateHours: 2, dependencies: ["P1-T1"], riskLevel: "medium", tags: ["validation"] }] }
        ],
        openDecisions: [],
        riskFlags: ["Fake output is deterministic and should not be treated as product approval."],
        assumptionsMade: [`Project context inferred from ${projectName}.`]
      };
    case "plan-ceo-review":
      return { ...output, ...common, overallVerdict: "PASS", phaseReviews: [{ phaseName: "Phase 1", verdict: "PASS", concerns: [], suggestions: ["Keep the first usable workflow small and measurable."] }], globalConcerns: [], mustFixBeforeProceeding: [], approvedAspects: ["The plan has a clear sequence and explicit validation step."] };
    case "plan-eng-review":
      return { ...output, ...common, overallVerdict: "PASS", taskReviews: [{ taskId: primaryTaskId, verdict: "PASS", technicalConcerns: [], requiredSpecification: [] }], architectureConcerns: ["Keep model/provider selection isolated from skill behavior."], missingInfrastructure: [], securityFlags: [], testingGaps: [], mustFixBeforeProceeding: [] };
    case "design-consultation":
      return { ...output, ...common, screens: [{ name: "Primary workflow", purpose: "Expose the main project path clearly.", userGoal: "Understand progress and next action.", components: ["status summary", "artifact link", "next command"], states: ["not started", "complete", "blocked"], accessibilityRequirements: ["clear headings", "plain text status"] }], userFlows: [{ name: "Complete a workflow step", steps: ["Run a skill", "Review concise status", "Open artifact when needed", "Continue to next command"], errorPaths: ["Missing prerequisites show recovery command"] }], designPrinciples: ["Readable by default", "Artifacts remain auditable"], responsiveStrategy: "Prefer terminal-friendly text and stable line lengths.", openDesignDecisions: [] };
    case "design-review":
      return { ...output, ...common, overallVerdict: "PASS", screenReviews: [{ screenName: "Primary workflow", verdict: "PASS", issues: [], suggestions: [] }], uxAntiPatterns: [], accessibilityFailures: [], mustFixBeforeProceeding: [] };
    case "review":
      return { ...output, ...common, reviewedFiles, fileReviews: reviewedFiles.map((file) => ({ file, verdict: "PASS", findings: [] })), overallVerdict: "PASS", summary: "Fake-provider review found no blocking issues in the available change context.", criticalIssues: [] };
    case "qa":
      return { ...output, ...common, passedChecks: ["Fake provider selected", "Artifacts writable", "Workflow gates evaluated"], failedChecks: [], testResults: { passed: 3, failed: 0, skipped: 0, testCommand: "offline fake-provider checks" }, browserFindings: [], overallVerdict: "PASS", blockers: [], recommendations: ["Run live provider QA when credentials and quota are available."] };
    case "qa-only":
      return { ...output, ...common, testCommand: "offline fake-provider checks", passed: 3, failed: 0, skipped: 0, failures: [], overallVerdict: "PASS" };
    case "investigate":
      return { ...output, ...common, issue: fakeInputString(context, "issue", "Offline fake investigation"), rootCause: "No real failure was supplied to the fake provider.", confidence: "low", relevantFiles: reviewedFiles, executionTrace: ["Fake provider produced a deterministic investigation placeholder."], proposedFix: { description: "No fix required for offline placeholder output.", affectedFiles: [], approach: "Continue workflow or rerun with a live provider." }, alternativeHypotheses: [] };
    case "ship":
      return { ...output, ...common, shippable: true, gateResults: [{ gate: "QA PASS", passed: true, detail: "Latest QA artifact passed." }, { gate: "Review clean", passed: true, detail: "No critical review issues were reported." }], blockers: [], changelogEntry: `Offline fake-provider ship report for ${projectName}.`, suggestedTag: "v0.1.0-offline", deployCommand: "", deployedAt: null };
    case "context-save":
      return { ...output, ...common, name: "fake-offline", savedAt: now, gitHead: "offline", branch: "main", artifactPointers: {}, summary: "Fake checkpoint summary for offline development." };
    case "context-restore":
      return { ...output, ...common, checkpointName: "fake-offline", restoredAt: now, artifactsRestored: [], gitHeadAtSave: "offline", note: "Fake restore summary for offline development. Git state was not modified." };
    case "browse":
      return { ...output, ...common, url: fakeInputString(context, "url", "http://localhost:3000"), title: "Fake browser report", summary: "Offline browser analysis placeholder.", consoleErrors: [], networkErrors: [], accessibilityIssues: [], interactiveElements: ["button: Primary action"], screenshotPath: ".dstack/browser/screenshots/fake-provider.png", recommendations: [] };
    default:
      return { ...output, ...common };
  }
}
interface FakeRequestContext {
  userInputs: JsonObject;
  artifacts: Record<string, JsonObject>;
  projectMemory: JsonObject | null;
  repoState: JsonObject;
}
function fakeRequestContext(request: ModelRequest): FakeRequestContext {
  try {
    const parsed = JSON.parse(request.userMessage) as unknown;
    if (isJsonObject(parsed)) {
      const artifacts = isJsonObject(parsed.artifacts) ? Object.fromEntries(Object.entries(parsed.artifacts).filter((entry): entry is [string, JsonObject] => isJsonObject(entry[1]))) : {};
      return {
        userInputs: isJsonObject(parsed.userInputs) ? parsed.userInputs : {},
        artifacts,
        projectMemory: isJsonObject(parsed.projectMemory) ? parsed.projectMemory : null,
        repoState: isJsonObject(parsed.repoState) ? parsed.repoState : {}
      };
    }
  } catch {
    return { userInputs: {}, artifacts: {}, projectMemory: null, repoState: {} };
  }
  return { userInputs: {}, artifacts: {}, projectMemory: null, repoState: {} };
}
function fakeProjectName(context: FakeRequestContext): string {
  const fromMemory = stringField(context.projectMemory, "projectName");
  const fromBrief = stringField(context.artifacts["office-hours"], "projectName");
  const fromIdea = titleFromText(fakeIdea(context));
  return fromMemory ?? fromBrief ?? fromIdea ?? "Offline Project";
}
function fakeIdea(context: FakeRequestContext): string {
  return fakeInputString(context, "idea", stringField(context.artifacts["office-hours"], "summary") ?? "this project");
}
function fakeInputString(context: FakeRequestContext, key: string, fallback: string): string {
  return stringField(context.userInputs, key) ?? fallback;
}
function fakePrimaryTaskId(context: FakeRequestContext): string {
  const plan = context.artifacts.autoplan;
  const phases = Array.isArray(plan?.phases) ? plan.phases : [];
  for (const phase of phases) {
    if (!isJsonObject(phase) || !Array.isArray(phase.tasks)) continue;
    const task = phase.tasks.find(isJsonObject);
    const id = isJsonObject(task) ? stringField(task, "id") : null;
    if (id) return id;
  }
  return "P0-T1";
}
function fakeChangedFiles(context: FakeRequestContext): string[] {
  const status = stringField(context.repoState, "status") ?? "";
  const files = status.split(/\r?\n/).map((line) => line.trim().replace(/^[A-Z?]+\s+/, "")).filter(Boolean);
  return files.length > 0 ? files.slice(0, 5) : [];
}
function titleFromText(text: string): string | null {
  const words = text.replace(/[^a-z0-9\s-]/gi, " ").trim().split(/\s+/).filter(Boolean).slice(0, 4);
  if (words.length === 0) return null;
  return words.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(" ");
}
function stringField(value: JsonObject | null | undefined, key: string): string | null {
  const field = value?.[key];
  return typeof field === "string" && field.trim() ? field : null;
}
function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function extractSkillName(text: string): string | null {
  const match = /DStack\s+\/([a-z0-9-]+)|Skill:\s*\/([a-z0-9-]+)/i.exec(text);
  return match?.[1] ?? match?.[2] ?? null;
}
function geminiError(error: unknown): ModelError {
  const message = error instanceof Error ? error.message : String(error);
  if (/\b429\b|quota|rate-limit|rate limit/i.test(message)) {
    return new ModelError("Gemini quota/rate limit reached. Use --provider=fake or DSTACK_PROVIDER=fake for offline development, or retry later with a project that has available Gemini quota.", { cause: message });
  }
  return new ModelError(`Gemini request failed: ${message}`);
}
