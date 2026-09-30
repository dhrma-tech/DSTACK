// Response types for the DStack server API (packages/server). Kept in sync with the
// server's routes; server integration tests check the routes exist.
import type { ProjectHealth, ProjectStage, SkillPipelineStatus, SkillSuggestion } from '@dstack/shared';

export type SafetyModeName = 'NORMAL' | 'CAREFUL' | 'GUARD';
export type Verdict = 'PASS' | 'REVISE' | 'FAIL';

export interface ProjectState {
  name: string;
  branch: string | null;
  head: string | null;
  stage: ProjectStage;
  safetyMode: SafetyModeName;
  safetyReason: string | null;
  freezeState: boolean;
  freezeReason: string | null;
  providerMode: 'GEMINI' | 'FAKE';
  geminiConfigured: boolean;
  artifactCounts: { total: number; latest: number; stale: number };
}

export type HealthReport = ProjectHealth;

export interface SkillSummary {
  name: string;
  command: string;
  description: string;
  stage: string;
  model: string;
  maturity: 'complete' | 'partial' | 'experimental';
  /** False for skills that can only be started from the ds CLI. */
  available: boolean;
  cliOnly: boolean;
  hidden: boolean;
  status: SkillPipelineStatus;
  hasLatestArtifact: boolean;
  lastRunAt: string | null;
  lastVerdict: Verdict | null;
  isBlocked: boolean;
  /** Required artifacts that don't exist yet. */
  missing: string[];
  requiresArtifacts: string[];
  allowedTools: string[];
  nextSkill: string | null;
}

export interface SkillDetail extends SkillSummary {
  inputs: Array<{ name: string; type: string; required: boolean; description: string }>;
  recentRuns: RunSummary[];
}

export type RunStatus = 'running' | 'complete' | 'error' | 'interrupted';

/** One row of GET /runs: runs started from the web, plus CLI session logs. */
export interface RunSummary {
  id: string;
  skillName: string;
  status: RunStatus;
  startedAt: string;
  completedAt: string | null;
  verdict: Verdict | null;
  durationMs: number | null;
  provider: string;
  toolCallCount: number;
  source: 'web' | 'cli';
}

/** GET /runs/:id: a web run with its full event log. */
export interface RunRecord extends Omit<RunSummary, 'source'> {
  inputs: Record<string, string>;
  flags: { force?: boolean; dryRun?: boolean; provider?: 'gemini' | 'fake' };
  events: ShellEvent[];
  active: boolean;
}

export interface ArtifactMeta {
  skillName: string;
  timestamp: string;
  verdict: 'PASS' | 'REVISE' | 'FAIL' | null;
  path: string;
  content?: unknown;
}

export interface ArtifactVersion {
  id: string;
  timestamp: string;
  verdict: Verdict | null;
}

export interface Artifact {
  skillName: string;
  generatedAt: string;
  overallVerdict?: 'PASS' | 'REVISE' | 'FAIL';
  [key: string]: unknown;
}

export interface ArtifactDiff {
  v1: Artifact;
  v2: Artifact;
  v1Id: string;
  v2Id: string;
  semanticSummary?: string;
}

export interface WorkflowNode {
  id: string;
  skillName: string;
  label: string;
  phase: string;
  status: 'not_started' | 'ready' | 'running' | 'PASS' | 'REVISE' | 'FAIL' | 'BLOCKED' | 'STALE';
  verdict: Verdict | null;
  timestamp: string | null;
  isStale: boolean;
  missing: string[];
  staleBecause: string[];
}

export interface WorkflowEdge {
  from: string;
  to: string;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface DeployConfig {
  platform: string;
  environment: string;
  deployCommand: string;
  dryRunCommand: string;
  healthCheckUrl?: string;
}

export interface DeployState {
  frozen: boolean;
  reason?: string;
  frozenAt?: string;
  frozenUntil?: string;
}

export interface SafetyModeState {
  mode: SafetyModeName;
  reason: string | null;
}

export interface ScaffoldTemplate {
  id: string;
  name: string;
  description: string;
  tech: string;
  difficulty: string;
}

export interface MarketSkill {
  name: string;
  description: string;
  category: string;
  author: string;
  installs: string;
}

export interface LearningEntry {
  id: string;
  skillName: string;
  pattern: string;
  context: string;
  sourceRunId: string;
  appliesTo: string[];
  source: 'manual' | 'retro' | 'setup-memory';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface BenchmarkRun {
  id: string;
  suite: string;
  date: string;
  fakeMode: boolean;
  durationMs: number;
  results: Array<{
    model: string;
    status: 'complete' | 'failed' | 'skipped';
    estimatedCostUsd: number | null;
    quality: number;
    latencyMs: number;
    tokens: number;
    criteria: Record<string, number>;
  }>;
}

export interface ScreenshotAsset {
  filename: string;
  capturedAt: string;
  hasErrors: boolean;
  url: string;
}

export interface Settings {
  provider: 'gemini' | 'fake';
  /** A key that is present but hasn't been checked against Gemini is 'unverified'. */
  geminiApiKeyStatus: 'unverified' | 'missing';
  maskedKey: string;
  defaultModel: string;
  proModel: string;
  maxTokens: number;
  requestTimeoutMs: number;
  safetyMode: string;
}

export interface DeployRun {
  id: string;
  timestamp: string;
  environment: string;
  verdict: 'PASS' | 'FAIL';
  durationMs: number;
  gitHash: string;
  healthCheckVerdict: 'PASS' | 'FAIL' | null;
}

export interface HistoryEntry {
  id: string;
  command: string;
  skillName: string;
  inputs: Record<string, string>;
  flags: Record<string, boolean | string>;
  verdict: Verdict | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  provider: string;
  model: string;
}

export type WorkflowSuggestion = SkillSuggestion;

export interface Template {
  id: string;
  name: string;
  skillName: string;
  inputs: Record<string, string>;
  flags: Record<string, boolean | string>;
  createdAt: string;
}

// ── SSE Event types ──────────────────────────────────────────────────────────

export type ShellEvent =
  | { type: 'reasoning'; text: string }
  | { type: 'tool-call'; toolName: string; args: Record<string, unknown>; gateDecision: 'ALLOW' | 'REQUIRE_APPROVAL' | 'DENY' }
  | { type: 'tool-result'; toolName: string; output: string; durationMs: number; error?: string }
  | { type: 'approval-required'; runId: string; toolName: string; description: string; permissionLevel: 'READ' | 'WRITE' | 'EXECUTE' | 'DESTRUCTIVE'; args: Record<string, unknown> }
  | { type: 'artifact-saved'; skillName: string; verdict: string; path: string; timestamp: string }
  | { type: 'complete'; skillName: string; status: RunStatus; verdict: Verdict | null; durationMs: number }
  | { type: 'error'; message: string; code?: string };
