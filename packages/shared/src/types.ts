export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };
export type Verdict = "PASS" | "REVISE" | "FAIL";
export type SkillRunStatus = "running" | "complete" | "error" | "interrupted";
export type PermissionDecision = "ALLOW" | "REQUIRE_APPROVAL" | "DENY";
export type PermissionLevel = "read" | "write" | "execute" | "destructive";
export type LogLevel = "debug" | "info" | "error";

export interface DStackConfig {
  projectRoot: string;
  dstackDir: string;
  geminiApiKey: string | null;
  defaultModel: string;
  proModel: string;
  maxTokens: number;
  requestTimeoutMs: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  maxToolCalls: number;
  logLevel: LogLevel;
  allowSecrets: boolean;
  browserHeadless: boolean;
  defaultBrowserUrl: string;
  requireApprovalForFileOverwrite: boolean;
  requireApprovalForGitCommit: boolean;
  requireApprovalForShellCommands: boolean;
  skillOverrides: Record<string, Partial<SkillModelConfig>>;
}

export interface SkillModelConfig {
  model: string;
  streaming: boolean;
  temperature: number;
}

export interface SkillInputDefinition {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface SkillManifest {
  name: string;
  description: string;
  triggerPhrases: string[];
  model: string;
  streaming: boolean;
  requiresArtifacts: string[];
  allowedTools: string[];
  inputs: SkillInputDefinition[];
  outputSchema: JsonObject;
  artifactPath: string;
  nextSkill: string | null;
  failureCases: string[];
  acceptanceCriteria: string[];
  systemPromptFile: string;
}

export interface SkillInvocation {
  skillName: string;
  inputs: Record<string, JsonValue>;
  flags: { force: boolean; dryRun: boolean; noStream: boolean; model: string | null; allowSecrets: boolean };
  projectRoot: string;
}

export interface SkillRunResult {
  skillName: string;
  status: SkillRunStatus;
  verdict: Verdict | null;
  artifactPath: string | null;
  output: JsonObject | null;
  nextSkill: string | null;
  warnings: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: JsonObject;
  permissionLevel: PermissionLevel;
}

export interface ToolCall {
  id: string;
  name: string;
  input: JsonObject;
}

export interface ToolResult {
  id: string;
  name: string;
  success: boolean;
  output: JsonObject;
  error: string | null;
}

export interface ModelRequest {
  model: string;
  systemPrompt: string;
  userMessage: string;
  tools: ToolDefinition[];
  responseMimeType: "application/json" | "text/plain";
  temperature: number;
  maxOutputTokens: number;
}

export interface ModelChunk {
  type: "text" | "tool-call" | "done";
  text?: string;
  toolCall?: ToolCall;
}

export interface ModelResponse {
  text: string;
  toolCalls: ToolCall[];
  inputTokens: number;
  outputTokens: number;
  stopReason: string | null;
}

export interface Provider {
  generate(request: ModelRequest): AsyncIterableIterator<ModelChunk>;
  countTokens(input: string, model: string): Promise<number>;
}

export interface Artifact {
  id: string;
  skillName: string;
  createdAt: string;
  filePath: string;
  isLatest: boolean;
  content: JsonObject;
  verdict: Verdict | null;
}

export interface ProjectMemory {
  version: "1";
  projectName: string;
  createdAt: string;
  updatedAt: string;
  techStack: { frontend: string; backend: string; database: string; infra: string; testing: string };
  goals: string[];
  constraints: string[];
  keyDecisions: Array<{ decision: string; rationale: string; date: string }>;
  domainTerms: Record<string, string>;
  openQuestions: string[];
}

export interface Checkpoint {
  name: string;
  savedAt: string;
  gitHead: string;
  branch: string;
  memorySnapshot: ProjectMemory | null;
  artifactPointers: Record<string, string>;
  summary: string;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  data: JsonObject;
}

export interface SessionLog {
  skillName: string;
  startedAt: string;
  completedAt: string | null;
  status: SkillRunStatus;
  entries: LogEntry[];
  error: JsonObject | null;
}
