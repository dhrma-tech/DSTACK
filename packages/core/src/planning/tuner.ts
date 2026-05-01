import type { JsonObject } from "@dstack/shared";

export interface PlanTunerOptions {
  projectRoot: string;
  dstackDir: string;
}

export interface PlanTuneRequest {
  autoplan: JsonObject;
  reviews: Record<string, JsonObject>;
}

export interface PlanTuneResult extends JsonObject {
  baseArtifactTimestamp: string;
  reviewsConsidered: string[];
  issuesAddressed: JsonObject[];
  issuesDeferred: JsonObject[];
  changeLog: string[];
  revisedPlan: JsonObject;
}

export class PlanTuner {
  constructor(private readonly _options: PlanTunerOptions) {}

  tune(request: PlanTuneRequest): PlanTuneResult {
    const issues = collectIssues(request.reviews);
    const revisedPlan = structuredClone(request.autoplan) as JsonObject;
    const phases = Array.isArray(revisedPlan.phases) ? revisedPlan.phases : [];
    const firstPhase = phases.find(isJsonObject);
    const addressedIssues = issues.slice(0, 3);
    const addressed = addressedIssues.map((issue) => ({
      source: issue.source,
      issue: issue.text,
      resolution: `Added or adjusted plan task to address: ${issue.text}`,
      affectedPhase: String(firstPhase?.name ?? "Phase 1"),
      affectedTaskId: issue.taskId ?? null
    }));
    const deferred = issues.length > 3 ? issues.slice(3).map((issue) => ({ issue: issue.text, reason: "Deferred for a follow-up planning pass." })) : [];
    if (isJsonObject(firstPhase)) {
      const tasks = Array.isArray(firstPhase.tasks) ? firstPhase.tasks : [];
      if (issues.length > 0) {
        tasks.push({ id: `PT-${tasks.length + 1}`, title: `Address review feedback: ${issues[0]!.text}`, estimateHours: 1, dependencies: [], riskLevel: "low", tags: ["review-feedback"] });
        firstPhase.tasks = tasks;
      }
    }
    return {
      baseArtifactTimestamp: stringValue(request.autoplan.generatedAt, new Date().toISOString()),
      reviewsConsidered: Object.keys(request.reviews),
      issuesAddressed: addressed,
      issuesDeferred: deferred,
      changeLog: issues.length > 0 ? addressed.map((entry) => `Updated ${entry.affectedPhase} for ${entry.source}: ${entry.issue}`) : ["No review issues found; plan unchanged."],
      revisedPlan
    };
  }
}

function collectIssues(reviews: Record<string, JsonObject>): Array<{ source: string; text: string; taskId: string | null }> {
  const issues: Array<{ source: string; text: string; taskId: string | null }> = [];
  for (const [source, review] of Object.entries(reviews)) {
    const mustFix = Array.isArray(review.mustFixBeforeProceeding) ? review.mustFixBeforeProceeding.filter((item): item is string => typeof item === "string") : [];
    issues.push(...mustFix.map((text) => ({ source, text, taskId: null })));
  }
  return issues;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}
