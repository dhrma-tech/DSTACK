import type { JsonObject } from "@dstack/shared";

export interface CSOEngineOptions {
  projectRoot: string;
  dstackDir: string;
}

export interface CSOAssessmentRequest {
  minimumArtifacts: string[];
}

export interface CSOAssessment extends JsonObject {
  overallAssessment: "ON_TRACK" | "AT_RISK" | "OFF_TRACK";
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
  confidenceRationale: string;
  strategicStrengths: string[];
  topThreeRisks: JsonObject[];
  scopeAssessment: string;
  timelineRealism: "ON_TRACK" | "OPTIMISTIC" | "UNREALISTIC";
  nextCycleRecommendations: JsonObject[];
  artifactsReviewed: string[];
  summary: string;
}

export class CSOEngine {
  constructor(private readonly _options: CSOEngineOptions) {}

  assess(artifacts: Record<string, JsonObject>): CSOAssessment {
    const reviewed = Object.keys(artifacts).sort();
    const lowContext = reviewed.length <= 1;
    return {
      overallAssessment: lowContext ? "AT_RISK" : "ON_TRACK",
      confidenceLevel: lowContext ? "LOW" : "HIGH",
      confidenceRationale: lowContext ? "Only one artifact was available, so strategic confidence is limited." : "Planning, review, and execution artifacts are available.",
      strategicStrengths: ["Workflow artifacts make decisions auditable.", "Review and QA gates reduce shipping ambiguity."],
      topThreeRisks: [
        { risk: "Scope creep across workflow stages", likelihood: "MEDIUM", impact: "HIGH", mitigation: "Keep plan-tune changes tied to review findings." },
        { risk: "Insufficient live-provider validation", likelihood: "MEDIUM", impact: "MEDIUM", mitigation: "Run selected skills with Gemini once quota is available." },
        { risk: "Deployment assumptions remain untested", likelihood: "LOW", impact: "HIGH", mitigation: "Run setup-deploy before production rollout." }
      ],
      scopeAssessment: "Scope is disciplined when stage gates remain enforced.",
      timelineRealism: "ON_TRACK",
      nextCycleRecommendations: [
        { recommendation: "Run /health before ship readiness decisions.", affectedSkills: ["health", "ship"], priority: "HIGH" },
        { recommendation: "Capture lessons with /retro and /setup-memory.", affectedSkills: ["retro", "setup-memory"], priority: "MEDIUM" }
      ],
      artifactsReviewed: reviewed,
      summary: lowContext ? "Strategic review has limited context; run /autoplan before relying on this assessment." : "The project is directionally healthy with clear operational gates."
    };
  }
}
