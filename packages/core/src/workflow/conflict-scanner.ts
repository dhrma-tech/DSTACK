import type { ArtifactConflict, ConflictSeverity, Verdict } from "@dstack/shared";

/** Minimal read access the scanner needs; satisfied by ArtifactStore. */
export interface LatestVerdictReader {
  readLatest(skillName: string): Promise<{ verdict: Verdict | null; createdAt: string } | null>;
}

interface VerdictRule {
  /** The skill whose PASS is contradicted. */
  passed: string;
  /** A skill that, when not PASS, contradicts it. */
  objecting: string;
  field: string;
  severity: ConflictSeverity;
  message: (objectingVerdict: Verdict) => string;
}

// Contradictions between real DStack artifacts, read from their verdicts.
const RULES: VerdictRule[] = [
  { passed: "qa", objecting: "review", field: "overallVerdict", severity: "high", message: (v) => `QA passed, but code review is ${v}. QA may have validated code the review rejected.` },
  { passed: "ship", objecting: "qa", field: "overallVerdict", severity: "high", message: (v) => `Ship passed, but the latest QA is ${v}.` },
  { passed: "plan-eng-review", objecting: "plan-ceo-review", field: "overallVerdict", severity: "medium", message: (v) => `Engineering approved the plan, but the CEO review is ${v}.` },
  { passed: "plan-ceo-review", objecting: "plan-eng-review", field: "overallVerdict", severity: "medium", message: (v) => `The CEO review approved the plan, but the engineering review is ${v}.` },
  { passed: "review", objecting: "design-review", field: "overallVerdict", severity: "medium", message: (v) => `Code review passed, but the design review is ${v}.` },
  { passed: "qa", objecting: "health", field: "overallVerdict", severity: "low", message: (v) => `QA passed, but the project health check is ${v}.` }
];

export class ConflictScanner {
  constructor(private readonly artifacts: LatestVerdictReader) {}

  async scan(): Promise<ArtifactConflict[]> {
    const skills = [...new Set(RULES.flatMap((rule) => [rule.passed, rule.objecting]))];
    const latest = new Map(await Promise.all(skills.map(async (skill) => [skill, await this.artifacts.readLatest(skill)] as const)));
    const conflicts: ArtifactConflict[] = [];
    for (const rule of RULES) {
      const passed = latest.get(rule.passed);
      const objecting = latest.get(rule.objecting);
      if (passed?.verdict !== "PASS" || !objecting?.verdict || objecting.verdict === "PASS") continue;
      conflicts.push({ artifactA: rule.passed, artifactB: rule.objecting, field: rule.field, conflict: rule.message(objecting.verdict), severity: rule.severity });
    }
    return conflicts;
  }
}
