import type { ArtifactStalenessReport, OverallReadiness, ReviewDashboard as ReviewDashboardState, ReviewEntry, Verdict, WorkflowStage } from "@dstack/shared";
import { ArtifactStore } from "../memory.js";
import { StalenessDetector } from "./staleness.js";

export interface ReviewDashboardOptions {
  projectRoot: string;
  dstackDir: string;
  requiredSkills?: string[];
  knownSkills?: string[];
}

export type ReviewDashboardResult = ReviewDashboardState;

export const phase1Skills = [
  "office-hours",
  "autoplan",
  "plan-ceo-review",
  "plan-eng-review",
  "design-consultation",
  "design-review",
  "review",
  "qa",
  "qa-only",
  "investigate",
  "ship",
  "context-save",
  "context-restore",
  "browse"
] as const;

export const phase2Skills = [
  "plan-design-review",
  "plan-devex-review",
  "devex-review",
  "plan-tune",
  "retro",
  "health",
  "cso",
  "design-shotgun",
  "design-html",
  "landing-report",
  "setup-deploy",
  "land-and-deploy",
  "canary",
  "freeze",
  "unfreeze",
  "dstack-upgrade",
  "setup-browser-cookies",
  "scrape",
  "pair-agent",
  "setup-memory",
  "learn",
  "skillify",
  "benchmark",
  "benchmark-models",
  "guard",
  "careful",
  "make-pdf",
  "codex"
] as const;

export const allWorkflowSkills = [...phase1Skills, ...phase2Skills] as const;

const defaultRequiredSkills = ["office-hours", "autoplan", "review", "qa", "ship"];

export class ReviewDashboard {
  private readonly artifacts: ArtifactStore;

  constructor(private readonly options: ReviewDashboardOptions) {
    this.artifacts = new ArtifactStore(options.dstackDir);
  }

  async compute(): Promise<ReviewDashboardResult> {
    const staleArtifacts = await new StalenessDetector({ dstackDir: this.options.dstackDir }).detect();
    const staleBySkill = new Map(staleArtifacts.map((entry) => [entry.skillName, entry]));
    const required = new Set(this.options.requiredSkills ?? defaultRequiredSkills);
    const known = this.options.knownSkills ?? [...allWorkflowSkills];
    const artifactStatuses: ReviewEntry[] = [];
    for (const skillName of known) {
      const artifact = await this.artifacts.readLatest(skillName);
      const stale = staleBySkill.get(skillName);
      artifactStatuses.push({
        skillName,
        hasArtifact: Boolean(artifact),
        lastRunAt: artifact?.createdAt ?? null,
        verdict: artifact?.verdict ?? null,
        isStale: Boolean(stale),
        stalenessReason: stale ? `${skillName} is stale because ${stale.staleBecauseOf} was re-run.` : null,
        isRequired: required.has(skillName),
        isOptional: !required.has(skillName)
      });
    }
    const openGates = artifactStatuses.filter((entry) => entry.isRequired && (!entry.hasArtifact || entry.isStale || entry.verdict === "FAIL")).map((entry) => entry.skillName);
    const completedGates = artifactStatuses.filter((entry) => entry.isRequired && entry.hasArtifact && !entry.isStale && entry.verdict !== "FAIL").map((entry) => entry.skillName);
    const neverRunSkills = artifactStatuses.filter((entry) => !entry.hasArtifact).map((entry) => entry.skillName);
    const readinessScore = scoreReadiness(artifactStatuses, staleArtifacts);
    const overallReadiness = readiness(openGates, staleArtifacts, artifactStatuses);
    return {
      projectId: this.options.projectRoot,
      computedAt: new Date().toISOString(),
      workflowStage: workflowStage(artifactStatuses),
      overallReadiness,
      readinessScore,
      artifactStatuses,
      staleArtifacts,
      openGates,
      completedGates,
      neverRunSkills,
      topBlockers: topBlockers(openGates, staleArtifacts, artifactStatuses)
    };
  }
}

function readiness(openGates: string[], staleArtifacts: ArtifactStalenessReport[], entries: ReviewEntry[]): OverallReadiness {
  if (entries.every((entry) => !entry.hasArtifact)) return "UNKNOWN";
  if (entries.some((entry) => entry.isRequired && entry.verdict === "FAIL")) return "BLOCKED";
  if (openGates.length > 0) return "NOT_READY";
  if (staleArtifacts.some((entry) => entry.severity === "CRITICAL")) return "BLOCKED";
  if (staleArtifacts.length > 0) return "AT_RISK";
  return "READY";
}

function scoreReadiness(entries: ReviewEntry[], staleArtifacts: ArtifactStalenessReport[]): number {
  let score = 100;
  score -= entries.filter((entry) => entry.isRequired && !entry.hasArtifact).length * 14;
  score -= entries.filter((entry) => entry.isRequired && entry.verdict === "FAIL").length * 30;
  score -= staleArtifacts.filter((entry) => entry.severity === "CRITICAL").length * 20;
  score -= staleArtifacts.filter((entry) => entry.severity === "MAJOR").length * 10;
  score -= staleArtifacts.filter((entry) => entry.severity === "MINOR").length * 5;
  return Math.max(0, Math.min(100, score));
}

function workflowStage(entries: ReviewEntry[]): WorkflowStage {
  const has = (skillName: string): boolean => entries.some((entry) => entry.skillName === skillName && entry.hasArtifact);
  if (has("ship")) return "shipped";
  if (has("qa")) return "qa";
  if (has("review") || has("devex-review")) return "build";
  if (has("design-consultation") || has("design-review") || has("design-shotgun")) return "design";
  if (has("office-hours") || has("autoplan")) return "planning";
  return "unknown";
}

function topBlockers(openGates: string[], staleArtifacts: ArtifactStalenessReport[], entries: ReviewEntry[]): string[] {
  const failed = entries.filter((entry) => entry.verdict === "FAIL").map((entry) => `${entry.skillName} failed`);
  const stale = staleArtifacts.map((entry) => `${entry.skillName} stale after ${entry.staleBecauseOf}`);
  const open = openGates.map((gate) => `${gate} gate is open`);
  return [...failed, ...stale, ...open].slice(0, 3);
}

export function verdictOf(value: unknown): Verdict | null {
  return value === "PASS" || value === "REVISE" || value === "FAIL" ? value : null;
}
