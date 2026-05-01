/**
 * Stable backend contracts for frontend integration
 * All date/time fields must be ISO-8601 UTC strings
 * All IDs must be stable strings
 */

import type { JsonValue } from "./types.js";

// API Response Envelope
export interface ApiEnvelope<T = unknown> {
  ok: boolean;
  data: T | null;
  warnings: Array<{
    code: string;
    message: string;
    severity: "info" | "warning" | "error";
  }>;
  error: null | {
    code: string;
    message: string;
    retryable: boolean;
    details?: object | null;
    fieldErrors?: Array<{
      field: string;
      message: string;
    }>;
    approvalRequired?: boolean;
    requiredHash?: string | null;
    requestId: string;
  };
  meta: {
    requestId: string;
    timestamp: string;
    apiVersion: "v1";
    command?: string;
    projectId?: string;
    runId?: string;
    exitCode?: number;
  };
}

// Core domain contracts
export interface Project {
  id: string;
  name: string;
  rootDisplayPath: string;
  rootAbsolutePath?: string;
  dstackDirRelative: string;
  workflowStage: string;
  createdAt?: string;
  updatedAt: string;
  provider: ProviderConfig;
  safetyMode: SafetyModeState;
  freezeState: FreezeState;
  artifactCounts: {
    total: number;
    latest: number;
    stale: number;
  };
  learningCount: number;
  tasteProfileUpdatedAt?: string | null;
}

export interface ProjectConfig {
  projectId: string;
  dstackVersion: string;
  providerName: "gemini" | "fake";
  defaultModel: string;
  proModel: string;
  maxTokens: number;
  requestTimeoutMs: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  maxToolCalls: number;
  browserHeadless: boolean;
  allowSecrets: boolean;
  requireApprovalForFileOverwrite: boolean;
  requireApprovalForGitCommit: boolean;
  requireApprovalForShellCommands: boolean;
  skillOverrides: Record<string, {
    model?: string;
    streaming?: boolean;
    temperature?: number;
  }>;
  deployConfig?: DeployConfig | null;
  apiServer: {
    host: string;
    port: number;
    tokenFileRelative: string;
    bindLocalOnly: boolean;
  };
}

export interface Skill {
  name: string;
  command: string;
  description: string;
  stage: string;
  maturity: "complete" | "partial" | "experimental";
  handlerType: "model" | "direct" | "fallback" | "central-shim";
  registered: boolean;
  available: boolean;
  hidden: boolean; // Hidden from normal API responses
  model: string;
  streaming: boolean;
  allowedTools: string[];
  requiresArtifacts: string[];
  artifactPath: string;
  nextSkill?: string | null;
  hasLatestArtifact: boolean;
  lastRunAt?: string | null;
}

export interface SkillManifestSummary {
  name: string;
  command: string;
  description: string;
  triggerPhrases: string[];
  model: string;
  streaming: boolean;
  allowedTools: string[];
  requiresArtifacts: string[];
  inputs: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  artifactPath: string;
  nextSkill?: string | null;
  outputSchemaVersion: string;
  maturity: "complete" | "partial" | "experimental";
  acceptanceCriteria: string[];
  failureCases: string[];
}

export type SkillRunStatus = "queued" | "running" | "complete" | "error" | "interrupted" | "blocked";

export interface SkillRunRequest {
  skillName: string;
  command: string;
  inputs: Record<string, JsonValue>;
  flags: {
    force: boolean;
    dryRun: boolean;
    noStream: boolean;
    allowSecrets: boolean;
  };
  providerOverride?: "gemini" | "fake" | null;
  modelOverride?: string | null;
  requestSource: "cli" | "api";
  actor: string;
}

export interface SkillRunResult {
  runId: string;
  skillName: string;
  status: SkillRunStatus;
  verdict?: "PASS" | "REVISE" | "FAIL" | null;
  artifact?: Artifact | null;
  output?: Record<string, JsonValue> | null;
  nextSkill?: string | null;
  warnings: string[];
  blockers: string[];
  runtimeStatus: {
    safetyMode: string;
    deployFrozen: boolean;
    deployFreezeReason?: string | null;
  };
  toolCalls: ToolCallLog[];
  provider: "gemini" | "fake";
  model: string;
  generatedBy?: string | null;
}

export interface SkillRun {
  id: string;
  projectId: string;
  skillName: string;
  command: string;
  status: SkillRunStatus;
  requestedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  request: SkillRunRequest;
  result?: SkillRunResult | null;
  provider: "gemini" | "fake";
  model: string;
  fakeMode: boolean;
  dryRun: boolean;
  interactive: boolean;
  warnings: string[];
  error?: {
    code: string;
    message: string;
    details?: Record<string, JsonValue> | null;
  } | null;
  logPathRelative?: string | null;
  artifactId?: string | null;
}

export interface WorkflowGraph {
  projectId: string;
  computedAt: string;
  currentStage: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  blockers: string[];
  staleArtifacts: string[];
  suggestedNextSkills: string[];
}

export interface WorkflowNode {
  id: string;
  nodeType: "skill" | "artifact" | "gate";
  label: string;
  stage: string;
  status: "not_run" | "ready" | "running" | "complete" | "error" | "blocked" | "stale";
  isRequired: boolean;
  isStale: boolean;
  skillName?: string;
  artifactId?: string;
  verdict?: "PASS" | "REVISE" | "FAIL" | null;
  latestRunId?: string | null;
  latestArtifactId?: string | null;
  nextSkillHint?: string | null;
}

export interface WorkflowEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType: "prerequisite" | "produces" | "recommends" | "gate";
  required: boolean;
  label?: string | null;
}

export interface Artifact {
  id: string;
  projectId: string;
  skillName: string;
  artifactType: string;
  schemaVersion: string;
  version: string;
  createdAt: string;
  isLatest: boolean;
  relativePath: string;
  absolutePath?: string;
  contentHash: string;
  verdict?: "PASS" | "REVISE" | "FAIL" | null;
  summary?: string | null;
  warnings: string[];
  content: Record<string, JsonValue>;
  sourceRunId?: string | null;
  promptInjectionDetected?: boolean;
}

export interface ArtifactVersion {
  artifactId: string;
  skillName: string;
  version: string;
  createdAt: string;
  relativePath: string;
  absolutePath?: string;
  contentHash: string;
  sizeBytes?: number | null;
  isLatest: boolean;
  schemaVersion: string;
  verdict?: "PASS" | "REVISE" | "FAIL" | null;
}

export interface ArtifactDiff {
  skillName: string;
  fromVersion: string;
  toVersion: string;
  changed: boolean;
  summary: string;
  addedKeys: string[];
  removedKeys: string[];
  modifiedKeys: string[];
  patchPreview?: Array<Record<string, JsonValue>>;
}

export interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  event: string;
  message?: string | null;
  data: Record<string, JsonValue>;
}

export interface ToolCallLog {
  id: string;
  runId: string;
  timestamp: string;
  toolName: string;
  permissionLevel: "read" | "write" | "execute" | "destructive";
  permissionDecision: "ALLOW" | "REQUIRE_APPROVAL" | "DENY";
  inputPreview: Record<string, JsonValue>;
  outputPreview?: Record<string, JsonValue> | null;
  success: boolean;
  durationMs?: number | null;
  error?: string | null;
  requiresApproval: boolean;
  approvedBy?: string | null;
}

export interface BrowserElementRef {
  ref: string;
  role: string;
  name: string;
  selectorHint: string;
  source: "role" | "testid" | "text" | "css";
  visible: boolean;
  clickable: boolean;
  fillable: boolean;
  tagName: string;
  attributes: Record<string, string>;
  order: number;
  stale?: boolean;
}

export interface BrowserSnapshot {
  id: string;
  projectId: string;
  session: string;
  createdAt: string;
  url: string;
  title: string;
  text: string;
  ariaTree: string;
  interactiveRefs: BrowserElementRef[];
  promptInjectionDetected: boolean;
  promptInjectionFragments: string[];
  scannerSummary: {
    detected: boolean;
    fragmentCount: number;
  };
  consoleLogsCount: number;
  networkLogsCount: number;
  latestScreenshotId?: string | null;
  relativeArtifactPath?: string | null;
}

export interface ScreenshotAsset {
  id: string;
  session: string;
  createdAt: string;
  relativePath: string;
  absolutePath?: string;
  mimeType: "image/png";
  label?: string | null;
  width?: number | null;
  height?: number | null;
  sizeBytes?: number | null;
}

export interface QAReport {
  id: string;
  projectId: string;
  skillRunId: string;
  createdAt: string;
  verdict: "PASS" | "REVISE" | "FAIL" | null;
  readinessScore: number;
  summary: string;
  blockers: string[];
  warnings: string[];
  testSummary: {
    passed: number;
    failed: number;
    skipped: number;
    frameworks: string[];
  };
  browserSummary: {
    snapshotId?: string | null;
    screenshotIds: string[];
    promptInjectionDetected: boolean;
    consoleErrors: number;
    networkErrors: number;
  };
  artifactIds: string[];
}

export interface ReviewReport {
  id: string;
  projectId: string;
  skillRunId: string;
  reviewType: string;
  createdAt: string;
  verdict: "PASS" | "REVISE" | "FAIL" | null;
  summary: string;
  strengths: string[];
  issues: string[];
  blockers: string[];
  recommendations: string[];
  nextSkill?: string | null;
}

export interface DeployConfig {
  schemaVersion: string;
  platform: string;
  environment: string;
  deployCommand: string;
  dryRunCommand: string;
  canaryCommand?: string | null;
  healthCheckUrl?: string | null;
  healthCheckIntervalSeconds: number;
  healthCheckTimeoutSeconds: number;
  rollbackCommand?: string | null;
  requiredEnvVars: string[];
  confirmationPolicy: "typed-hash";
  createdAt: string;
  updatedAt: string;
}

export interface DeployRun {
  id: string;
  projectId: string;
  environment: string;
  runType: "full" | "canary" | "dry-run";
  status: "pending" | "running" | "complete" | "failed" | "blocked";
  startedAt: string;
  completedAt?: string | null;
  deployCommand: string;
  commandHash: string;
  gitHead: string;
  gitBranch: string;
  approvalRequired: boolean;
  approvalGranted: boolean;
  blockers: string[];
  verdict: "PASS" | "FAIL" | "IN_PROGRESS";
  healthCheckVerdict: "PASS" | "FAIL" | "SKIPPED" | "TIMEOUT";
  healthChecks: Array<{
    url: string;
    attempt: number;
    startedAt: string;
    completedAt?: string | null;
    verdict: "PASS" | "FAIL" | "SKIPPED" | "TIMEOUT";
    statusCode?: number | null;
    responseTimeMs?: number | null;
    error?: string | null;
  }>;
  rollbackRequired: boolean;
  rollbackCommand?: string | null;
  rollbackExecuted: boolean;
  frozenState: FreezeState;
  stdout: string;
  stderr: string;
  dryRun: boolean;
  approvalHashProvided?: string | null;
  rollbackResult?: {
    exitCode: number | null;
    stdout: string;
    stderr: string;
  } | null;
}

export interface BenchmarkModelResult {
  model: string;
  status: "complete" | "failed" | "skipped";
  avgQualityScore?: number | null;
  avgLatencyMs?: number | null;
  passRate?: number | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokensUsed: number;
  estimatedCostUsd?: number | null;
  qualityEvaluation: "criteria_match" | "not_evaluated_offline" | "judge_model" | "error";
  promptResultsCount: number;
  pricingDisclaimer: string;
  warnings: string[];
  error?: string | null;
}

export interface BenchmarkRun {
  id: string;
  projectId: string;
  suiteName: string;
  runType: "single-model" | "multi-model";
  providerName: "gemini" | "fake";
  liveMode: boolean;
  dryRun: boolean;
  runAt: string;
  completedAt?: string | null;
  durationMs: number;
  promptCount: number;
  modelsCompared: string[];
  estimate: {
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    estimatedTokens: number;
    estimatedCostUsd?: number | null;
    pricingDisclaimer: string;
  };
  modelResults: BenchmarkModelResult[];
  summary: {
    bestQualityModel?: string | null;
    bestLatencyModel?: string | null;
    bestValueModel?: string | null;
    avgLatencyMs?: number | null;
    avgQualityScore?: number | null;
    warnings: string[];
  };
  warnings: string[];
}

export interface LearningEntry {
  id: string;
  projectId: string;
  createdAt: string;
  topic: string;
  insight: string;
  originalText: string;
  normalizedText: string;
  wasRephrased: boolean;
  appliesTo: string[];
  source: "manual" | "retro" | "setup-memory";
  usedInSkillRuns: string[];
  dedupeHash: string;
  confirmed: boolean;
  tags?: string[];
}

export interface TasteProfile {
  projectId: string;
  updatedAt: string;
  entries: Array<{
    variantName: string;
    verdict: "approved" | "rejected";
    reason: string;
    timestamp: string;
  }>;
  weights: Array<{
    variantName: string;
    weight: number;
  }>;
  topPreferences: Array<{
    variantName: string;
    weight: number;
  }>;
  decayAppliedAt?: string | null;
}

export interface SafetyModeState {
  mode: "NORMAL" | "CAREFUL" | "GUARD";
  activatedAt?: string | null;
  activatedBySkill?: "careful" | "guard" | null;
  reason?: string | null;
  blockedOperations: string[];
  gatedOperations: string[];
}

export interface FreezeState {
  frozen: boolean;
  scope: "deploy" | "production" | "all" | `path:${string}`;
  reason?: string | null;
  actor?: string | null;
  createdAt?: string | null;
  frozenUntil?: string | null;
  pathScope?: string | null; // Backward compatibility
}

export interface ProviderConfig {
  current: "gemini" | "fake";
  available: Array<"gemini" | "fake">;
  geminiConfigured: boolean;
  fakeAvailable: boolean;
  allowLive: boolean;
  defaultProvider: "gemini" | "fake";
}

export interface ModelConfig {
  defaultModel: string;
  proModel: string;
  maxTokens: number;
  requestTimeoutMs: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  maxToolCalls: number;
  skillOverrides: Record<string, {
    model?: string;
    streaming?: boolean;
    temperature?: number;
  }>;
}

export interface Settings {
  projectId: string;
  projectRootDisplayPath: string;
  projectRootAbsolutePath?: string;
  dstackDirRelative: string;
  allowAbsolutePaths: boolean;
  provider: ProviderConfig;
  model: ModelConfig;
  browserHeadless: boolean;
  allowSecrets: boolean;
  permissionDefaults: {
    requireApprovalForFileOverwrite: boolean;
    requireApprovalForGitCommit: boolean;
    requireApprovalForShellCommands: boolean;
  };
  safetyMode: SafetyModeState;
  freezeState: FreezeState;
  apiServer: {
    host: string;
    port: number;
    tokenFileRelative: string;
    bindLocalOnly: boolean;
  };
}

export interface ConfirmationToken {
  tokenId: string;
  actionType: string;
  payloadHash: string;
  expiresAt: string;
  singleUse: boolean;
  createdAt: string;
  message: string;
  instructions: string;
}

export interface DeployResult {
  deployId: string;
  environment: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  deployHash: string | null;
  deployedAt: string;
  artifacts: string[];
  warnings: string[];
  error: string | null;
}

export interface DeployApproval {
  approvalId: string;
  environment: string;
  deployHash: string;
  approvedAt: string;
  expiresAt: string;
  status: 'approved' | 'expired' | 'used';
}

export interface DeployStatus {
  deployId: string;
  environment: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  startedAt: string | null;
  completedAt: string | null;
  progress: number;
  artifacts: string[];
  warnings: string[];
  error: string | null;
}

export interface Asset {
  assetId: string;
  filename: string;
  size: number;
  createdAt: string;
  modifiedAt: string;
  contentType: string;
  path: string | null;
}

export interface AssetList {
  assets: Asset[];
  total: number;
  limit: number;
  includePaths: boolean;
}

export interface AssetMetadata {
  assetId: string;
  filename: string;
  size: number;
  createdAt: string;
  modifiedAt: string;
  contentType: string;
  path: string | null;
  fullPath: string | null;
}

// Re-export JsonValue from types
export type { JsonValue } from "./types.js";
