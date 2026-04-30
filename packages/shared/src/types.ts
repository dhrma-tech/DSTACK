export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };
export type Verdict = "PASS" | "REVISE" | "FAIL";
export type SkillRunStatus = "running" | "complete" | "error" | "interrupted";
export type PermissionDecision = "ALLOW" | "REQUIRE_APPROVAL" | "DENY";
export type PermissionLevel = "read" | "write" | "execute" | "destructive";
export type LogLevel = "debug" | "info" | "error";
export type ProviderName = "gemini" | "fake";
export type WorkflowStage = "planning" | "design" | "build" | "qa" | "shipped" | "unknown";
export type OverallReadiness = "READY" | "NOT_READY" | "AT_RISK" | "BLOCKED" | "UNKNOWN";
export type StalenessSeverity = "CRITICAL" | "MAJOR" | "MINOR";
export type DeployRunType = "full" | "canary" | "dry-run";
export type DeployVerdict = "PASS" | "FAIL" | "IN_PROGRESS";
export type HealthCheckVerdict = "PASS" | "FAIL" | "SKIPPED" | "TIMEOUT";
export type LearningSource = "manual" | "retro" | "setup-memory";
export type BenchmarkRunType = "single-model" | "multi-model";
export type SkillDefinitionDraftStatus = "draft" | "installed" | "rejected";
export type SafetyModeName = "NORMAL" | "CAREFUL" | "GUARD";
export type UpgradeMigrationType = "SCHEMA_CHANGE" | "FILE_RENAME" | "CONFIG_UPDATE";
export type UpgradeVerification = "PASS" | "FAIL" | "SKIPPED";

export interface DStackConfig {
  projectRoot: string;
  dstackDir: string;
  geminiApiKey: string | null;
  provider: ProviderName;
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
  flags: { force: boolean; dryRun: boolean; noStream: boolean; model: string | null; provider: ProviderName | null; allowSecrets: boolean };
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

export interface ReviewDashboard {
  projectId: string;
  computedAt: string;
  workflowStage: WorkflowStage;
  overallReadiness: OverallReadiness;
  readinessScore: number;
  artifactStatuses: ReviewEntry[];
  staleArtifacts: ArtifactStalenessReport[];
  openGates: string[];
  completedGates: string[];
  neverRunSkills: string[];
  topBlockers: string[];
}

export interface ReviewEntry {
  skillName: string;
  hasArtifact: boolean;
  lastRunAt: string | null;
  verdict: Verdict | null;
  isStale: boolean;
  stalenessReason: string | null;
  isRequired: boolean;
  isOptional: boolean;
}

export interface ArtifactStalenessReport {
  skillName: string;
  artifactPath: string;
  artifactTimestamp: string;
  staleBecauseOf: string;
  staleSince: string;
  severity: StalenessSeverity;
  recommendation: string;
}

export interface DesignArtifact {
  id: string;
  skillName: "design-consultation" | "design-shotgun" | "design-html";
  subject: string;
  createdAt: string;
  variants: DesignVariant[];
  chosenVariant: string | null;
  htmlFilePath: string | null;
  screens: JsonObject[];
}

export interface DesignVariant {
  name: string;
  layoutParadigm: string;
  componentPhilosophy: string;
  interactionModel: string;
  visualDirection: string;
  components: string[];
  userFlows: string[];
  advantages: string[];
  disadvantages: string[];
  bestFor: string;
  htmlPrototypePath: string | null;
}

export interface DeployConfig {
  platform: string;
  environment: string;
  deployCommand: string;
  dryRunCommand: string;
  canaryCommand: string | null;
  healthCheckUrl: string | null;
  healthCheckIntervalSeconds: number;
  healthCheckTimeoutSeconds: number;
  rollbackCommand: string | null;
  requiredEnvVars: string[];
  configVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeployRun {
  id: string;
  projectId: string;
  environment: string;
  type: DeployRunType;
  startedAt: string;
  completedAt: string | null;
  deployCommand: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  verdict: DeployVerdict;
  healthCheckVerdict: HealthCheckVerdict;
  gitHead: string;
  gitBranch: string;
  deployedBy: "dstack";
  rollbackExecuted: boolean;
  frozen: boolean;
}

export interface LearningEntry {
  id: string;
  topic: string;
  insight: string;
  originalText: string;
  wasRephrased: boolean;
  appliesTo: string[];
  source: LearningSource;
  createdAt: string;
  projectId: string;
  usedInSkillRuns: string[];
}

export interface BenchmarkRun {
  id: string;
  projectId: string;
  suiteName: string;
  model: string | null;
  runAt: string;
  duration: number;
  results: BenchmarkPromptResult[];
  summary: BenchmarkSummary;
  type: BenchmarkRunType;
  modelsCompared: string[];
}

export interface BenchmarkPromptResult {
  promptId: string;
  model: string;
  prompt: string;
  response: string;
  qualityScore: number;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  criteriaScores: Array<{ criterion: string; passed: boolean; score: number }>;
  error: string | null;
}

export interface BenchmarkSummary {
  avgQualityScore: number;
  avgLatencyMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  passRate: number;
  recommendation: string;
  bestQualityModel: string | null;
  bestLatencyModel: string | null;
}

export interface SkillDefinitionDraft {
  id: string;
  skillName: string;
  generatedAt: string;
  manifestPath: string;
  handlerPath: string;
  schemaValid: boolean;
  schemaValidationErrors: string[];
  generatedModel: string;
  generatedTools: string[];
  status: SkillDefinitionDraftStatus;
  installInstructions: string;
  warnings: string[];
}

export interface SafetyMode {
  mode: SafetyModeName;
  activatedAt: string | null;
  activatedBySkill: "careful" | "guard" | null;
  reason: string | null;
  blockedOperations: string[];
  gatedOperations: string[];
}

export interface UpgradePlan {
  currentVersion: string;
  latestVersion: string;
  isUpToDate: boolean;
  changelogSummary: string;
  breakingChanges: string[];
  requiredMigrations: Array<{ description: string; type: UpgradeMigrationType; automated: boolean }>;
  backupCheckpointCreated: boolean;
  backupCheckpointPath: string | null;
  upgradeApproved: boolean;
  upgradeExecuted: boolean;
  postUpgradeVerification: UpgradeVerification;
}
