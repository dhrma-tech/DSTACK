// Shapes the pages render, derived from server responses in app-context.tsx.
import type { ProjectStage } from '@dstack/shared';
import type { ArtifactMeta, ProjectState, RunSummary, SafetyModeName, Verdict } from './api-types';

export interface ProjectView {
  name: string;
  branch: string | null;
  workflowStage: ProjectStage;
  provider: { current: 'gemini' | 'fake'; geminiConfigured: boolean };
  safetyMode: { mode: SafetyModeName; reason: string | null };
  freezeState: { frozen: boolean; reason: string | null };
  artifactCounts: { total: number; latest: number; stale: number };
}

/** Shown until the server answers. Pages check `isLoading`/`loadError` before trusting it. */
export const EMPTY_PROJECT: ProjectView = {
  name: '',
  branch: null,
  workflowStage: 'planning',
  provider: { current: 'gemini', geminiConfigured: false },
  safetyMode: { mode: 'NORMAL', reason: null },
  freezeState: { frozen: false, reason: null },
  artifactCounts: { total: 0, latest: 0, stale: 0 }
};

export function toProjectView(state: ProjectState): ProjectView {
  return {
    name: state.name,
    branch: state.branch,
    workflowStage: state.stage,
    provider: { current: state.providerMode === 'FAKE' ? 'fake' : 'gemini', geminiConfigured: state.geminiConfigured },
    safetyMode: { mode: state.safetyMode, reason: state.safetyReason },
    freezeState: { frozen: state.freezeState, reason: state.freezeReason },
    artifactCounts: state.artifactCounts
  };
}

export interface RunView extends RunSummary {
  /** Human-readable duration, e.g. "42s" or "running". */
  duration: string;
  fakeMode: boolean;
}

export function formatDuration(durationMs: number | null, status: RunSummary['status']): string {
  if (durationMs === null) return status === 'running' ? 'running' : '—';
  const seconds = Math.round(durationMs / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function toRunView(run: RunSummary): RunView {
  return { ...run, duration: formatDuration(run.durationMs, run.status), fakeMode: run.provider === 'fake' };
}

export interface ArtifactView {
  /** The skill name; /artifacts/[id] shows a skill's latest artifact. */
  id: string;
  skillName: string;
  verdict: Verdict | null;
  createdAt: string;
  /** The artifact list only holds each skill's latest output. */
  isLatest: true;
  relativePath: string;
  summary: string;
  content: unknown;
}

export function toArtifactView(meta: ArtifactMeta): ArtifactView {
  return {
    id: meta.skillName,
    skillName: meta.skillName,
    verdict: meta.verdict,
    createdAt: meta.timestamp,
    isLatest: true,
    relativePath: meta.path,
    summary: meta.verdict ? `${meta.verdict} result from /${meta.skillName}` : `Output of /${meta.skillName}`,
    content: meta.content ?? null
  };
}
