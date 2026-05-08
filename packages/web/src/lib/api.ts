import type { AgentEvent } from '@dstack/shared';


const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001') + '/api';

// ── Error type ──────────────────────────────────────────────────────────────

export class DStackAPIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'DStackAPIError';
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    let code: string | undefined;
    try {
      const body = await res.json() as { error?: string; code?: string };
      code = body.code;
      throw new DStackAPIError(body.error ?? res.statusText, res.status, code);
    } catch (e) {
      if (e instanceof DStackAPIError) throw e;
      throw new DStackAPIError(res.statusText, res.status);
    }
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ── Shared types ─────────────────────────────────────────────────────────────

export interface ProjectState {
  name: string;
  branch: string;
  head: string;
  stage: string;
  safetyMode: 'NORMAL' | 'CAREFUL' | 'GUARD';
  freezeState: boolean;
  providerMode: string;
}

export interface HealthReport {
  score: number;
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  recommendations: string[];
}

export interface SkillSummary {
  name: string;
  command: string;
  description: string;
  stage: string;
  model: string;
  maturity: 'complete' | 'partial' | 'experimental';
  available: boolean;
  hasLatestArtifact: boolean;
  lastRunAt: string | null;
  lastVerdict: 'PASS' | 'REVISE' | 'FAIL' | null;
  isBlocked: boolean;
  requiresArtifacts: string[];
  allowedTools: string[];
  nextSkill: string | null;
}

export interface SkillDetail extends SkillSummary {
  recentRuns: RunRecord[];
}

export interface RunRecord {
  id: string;
  skillName: string;
  startedAt: string;
  completedAt: string | null;
  verdict: 'PASS' | 'REVISE' | 'FAIL' | null;
  durationMs: number | null;
  provider: string;
  toolCallCount: number;
  events: ShellEvent[];
}

export interface ArtifactMeta {
  skillName: string;
  timestamp: string;
  verdict: 'PASS' | 'REVISE' | 'FAIL' | null;
  path: string;
  content?: unknown;
}

export interface ArtifactVersion {
  timestamp: string;
  verdict: 'PASS' | 'REVISE' | 'FAIL' | null;
  path: string;
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
  changes: Array<{ field: string; before: unknown; after: unknown }>;
}

export interface WorkflowNode {
  id: string;
  skillName: string;
  label: string;
  phase: string;
  status: 'not_started' | 'ready' | 'running' | 'PASS' | 'REVISE' | 'FAIL' | 'BLOCKED' | 'STALE';
  verdict: 'PASS' | 'REVISE' | 'FAIL' | null;
  timestamp: string | null;
  isStale: boolean;
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
  deployCommand: string;
  healthCheckUrl?: string;
}

export interface DeployState {
  frozen: boolean;
  reason?: string;
  frozenAt?: string;
}

export interface SafetyModeState {
  mode: 'NORMAL' | 'CAREFUL' | 'GUARD';
  reason: string | null;
}

export interface LearningEntry {
  id: string;
  topic: string;
  insight: string;
  appliesTo: string[];
  source: string;
  createdAt: string;
}

export interface BenchmarkRun {
  id: string;
  suite: string;
  date: string;
  fakeMode: boolean;
  results: Array<{
    model: string;
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
  geminiApiKeyStatus: 'valid' | 'invalid' | 'missing';
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

// ── SSE Event types ──────────────────────────────────────────────────────────

export type ShellEvent =
  | { type: 'reasoning'; text: string }
  | { type: 'tool-call'; toolName: string; args: Record<string, unknown>; gateDecision: 'ALLOW' | 'REQUIRE_APPROVAL' | 'DENY' }
  | { type: 'tool-result'; toolName: string; output: string; durationMs: number; error?: string }
  | { type: 'approval-required'; runId: string; toolName: string; description: string; permissionLevel: 'READ' | 'WRITE' | 'EXECUTE' | 'DESTRUCTIVE'; args: Record<string, unknown> }
  | { type: 'artifact-saved'; skillName: string; verdict: string; path: string; timestamp: string }
  | { type: 'complete'; skillName: string; verdict: string; durationMs: number }
  | { type: 'error'; message: string; code?: string };

// ── API functions ─────────────────────────────────────────────────────────────

export const api = {
  // Project
  getProject: () => apiFetch<ProjectState>('/project'),
  getProjectHealth: () => apiFetch<HealthReport>('/project/health'),

  // Skills
  getSkills: () => apiFetch<SkillSummary[]>('/skills'),
  getSkill: (name: string) => apiFetch<SkillDetail>(`/skills/${name}`),
  runSkill: (name: string, inputs: Record<string, string> = {}, flags?: { dryRun?: boolean; force?: boolean; provider?: string }) =>
    apiFetch<{ runId: string }>(`/skills/${name}/run`, {
      method: 'POST',
      body: JSON.stringify({ inputs, ...flags }),
    }),

  // Runs
  getRuns: (limit?: number) => apiFetch<RunRecord[]>(`/runs${limit ? `?limit=${limit}` : ''}`),
  getRun: (runId: string) => apiFetch<RunRecord>(`/runs/${runId}`),
  stopRun: (runId: string) => apiFetch<{ stopped: boolean }>(`/runs/${runId}/stop`, { method: 'POST' }),

  // Approvals
  respondToApproval: (runId: string, decision: 'approve' | 'deny') =>
    apiFetch<{ written: boolean }>(`/approvals/${runId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    }),

  // Artifacts
  getArtifacts: () => apiFetch<Record<string, ArtifactMeta>>('/artifacts'),
  getArtifactVersions: (skillName: string) => apiFetch<ArtifactVersion[]>(`/artifacts/${skillName}`),
  getLatestArtifact: (skillName: string) => apiFetch<Artifact>(`/artifacts/${skillName}/latest`),
  getArtifactDiff: (skillName: string, v1: string, v2: string) =>
    apiFetch<ArtifactDiff>(`/artifacts/${skillName}/diff?v1=${v1}&v2=${v2}`),

  // Workflow
  getWorkflowGraph: () => apiFetch<WorkflowGraph>('/workflow/graph'),
  startWorkflow: (prompt: string) =>
    apiFetch<{ runId: string }>('/workflows/runs', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }),
  streamWorkflow: (runId: string, onEvent: (event: AgentEvent) => void, onComplete: () => void) => {
    const es = new EventSource(`${API_BASE}/workflows/runs/${runId}/stream`);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as AgentEvent;
        onEvent(data);
        if (data.type === 'run_complete' || data.type === 'run_error') {
          es.close();
          onComplete();
        }
      } catch { /* ignore */ }
    };
    es.onerror = () => { es.close(); onComplete(); };
    return () => es.close();
  },
  respondToWorkflowApproval: (runId: string, decision: 'approve' | 'deny') =>
    apiFetch<{ ok: boolean }>(`/workflows/runs/${runId}/approvals`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    }),


  // Deploy
  getDeployConfig: () => apiFetch<DeployConfig | null>('/deploy/config'),
  getDeployState: () => apiFetch<DeployState>('/deploy/state'),
  freezeDeploy: (reason?: string) => apiFetch<{ frozen: boolean }>('/deploy/freeze', { method: 'POST', body: JSON.stringify({ reason }) }),
  unfreezeDeploy: () => apiFetch<{ frozen: boolean }>('/deploy/unfreeze', { method: 'POST' }),
  getDeployRuns: () => apiFetch<DeployRun[]>('/deploy/runs'),

  // Safety
  getSafetyMode: () => apiFetch<SafetyModeState>('/safety'),
  setSafetyMode: (mode: 'NORMAL' | 'CAREFUL' | 'GUARD') =>
    apiFetch<SafetyModeState>('/safety/mode', { method: 'POST', body: JSON.stringify({ mode }) }),

  // Learnings
  getLearnings: (query?: string) => apiFetch<LearningEntry[]>(`/learnings${query ? `?q=${encodeURIComponent(query)}` : ''}`),
  addLearning: (entry: Omit<LearningEntry, 'id' | 'createdAt'>) =>
    apiFetch<LearningEntry>('/learnings', { method: 'POST', body: JSON.stringify(entry) }),
  deleteLearning: (id: string) => apiFetch<{ deleted: boolean }>(`/learnings/${id}`, { method: 'DELETE' }),

  // Benchmarks
  getBenchmarks: () => apiFetch<BenchmarkRun[]>('/benchmarks'),
  getBenchmark: (runId: string) => apiFetch<BenchmarkRun>(`/benchmarks/${runId}`),

  // Browser
  getScreenshots: () => apiFetch<ScreenshotAsset[]>('/browser/screenshots'),

  // Settings
  getSettings: () => apiFetch<Settings>('/settings'),
  updateSettings: (settings: Partial<Settings>) =>
    apiFetch<Settings>('/settings', { method: 'PUT', body: JSON.stringify(settings) }),

  // Sandbox
  writeSandboxFiles: (files: Record<string, string>) =>
    apiFetch<Record<string, unknown>>('/sandbox/files', {
      method: 'POST',
      body: JSON.stringify({ files }),
    }),
  runSandboxCommand: (command: string) =>
    apiFetch<{ stdout: string; stderr: string; code: number }>('/sandbox/commands', {
      method: 'POST',
      body: JSON.stringify({ command }),
    }),
};

// Legacy compat — keep apiClient shape for existing code
export const apiClient = {
  getProject: api.getProject,
  getSkills: api.getSkills,
  getArtifacts: () => api.getArtifacts().then(r => Object.values(r)),
  getRuns: api.getRuns,
  runSkill: (skillName: string, args: Record<string, string> = {}) =>
    api.runSkill(skillName, args),
  streamRun: (runId: string, onEvent: (event: ShellEvent) => void, onComplete: () => void) => {
    const es = new EventSource(`${API_BASE}/runs/${runId}/stream`);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as ShellEvent;
        onEvent(data);
        if (data.type === 'complete') { es.close(); onComplete(); }
      } catch { /* ignore parse errors */ }
    };
    es.onerror = () => { es.close(); onComplete(); };
    return () => es.close();
  },
  respondToApproval: (runId: string, decision: 'approve' | 'deny') =>
    api.respondToApproval(runId, decision),
  updateProjectSettings: () => Promise.resolve({ success: true }),
};

export type RunEventType = 'reasoning' | 'tool-call' | 'tool-result' | 'approval-required' | 'artifact-saved' | 'complete' | 'error';
export type RunEvent = ShellEvent;
