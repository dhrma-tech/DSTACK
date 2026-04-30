import type { JsonObject } from "@dstack/shared";

export const defaultOutputs: Record<string, JsonObject> = {
  "office-hours": { projectName: "Untitled Project", summary: "", targetUsers: [], coreProblem: "", successMetrics: [], techStack: { frontend: "", backend: "", infra: "" }, constraints: [], outOfScope: [], openQuestions: [] },
  autoplan: { planVersion: "1", generatedAt: new Date().toISOString(), phases: [], openDecisions: [], riskFlags: ["Plan requires review."], assumptionsMade: [] },
  "plan-ceo-review": { overallVerdict: "REVISE", phaseReviews: [], globalConcerns: [], mustFixBeforeProceeding: [], approvedAspects: [] },
  "plan-eng-review": { overallVerdict: "REVISE", taskReviews: [], architectureConcerns: [], missingInfrastructure: [], securityFlags: [], testingGaps: [], mustFixBeforeProceeding: [] },
  "design-consultation": { screens: [], userFlows: [], designPrinciples: [], responsiveStrategy: "", openDesignDecisions: [] },
  "design-review": { overallVerdict: "REVISE", screenReviews: [], uxAntiPatterns: [], accessibilityFailures: [], mustFixBeforeProceeding: [] },
  review: { reviewedFiles: [], fileReviews: [], overallVerdict: "PASS", summary: "No review findings.", criticalIssues: [] },
  qa: { passedChecks: [], failedChecks: [], testResults: { passed: 0, failed: 0, skipped: 0, testCommand: "" }, browserFindings: [], overallVerdict: "PASS", blockers: [], recommendations: [] },
  "qa-only": { testCommand: "", passed: 0, failed: 0, skipped: 0, failures: [], overallVerdict: "PASS" },
  investigate: { issue: "", rootCause: "", confidence: "low", relevantFiles: [], executionTrace: [], proposedFix: { description: "", affectedFiles: [], approach: "" }, alternativeHypotheses: [] },
  ship: { shippable: false, gateResults: [], blockers: [], changelogEntry: "", suggestedTag: "", deployCommand: "", deployedAt: null },
  browse: { url: "", title: "", summary: "", consoleErrors: [], networkErrors: [], accessibilityIssues: [], interactiveElements: [], screenshotPath: "", recommendations: [] }
};
