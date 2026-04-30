import path from "node:path";
import type { Artifact, ArtifactStalenessReport, StalenessSeverity } from "@dstack/shared";
import { ArtifactStore } from "../memory.js";

export interface StalenessDetectorOptions {
  dstackDir: string;
  dependencyGraph?: Record<string, string[]>;
}

export type StalenessDetectionResult = ArtifactStalenessReport[];

export const workflowDependencyGraph: Record<string, string[]> = {
  autoplan: ["office-hours"],
  "plan-ceo-review": ["autoplan"],
  "plan-eng-review": ["autoplan", "plan-ceo-review"],
  "plan-design-review": ["autoplan", "plan-eng-review"],
  "plan-devex-review": ["autoplan", "plan-eng-review"],
  "plan-tune": ["autoplan", "plan-ceo-review", "plan-eng-review", "plan-design-review", "plan-devex-review"],
  "design-consultation": ["plan-eng-review"],
  "design-shotgun": ["design-consultation", "plan-eng-review"],
  "design-html": ["design-consultation", "design-shotgun"],
  "design-review": ["design-consultation"],
  review: ["autoplan"],
  "devex-review": ["autoplan"],
  qa: ["review"],
  investigate: ["qa"],
  ship: ["qa", "review"],
  "setup-deploy": ["ship"],
  canary: ["setup-deploy", "ship"],
  "land-and-deploy": ["setup-deploy", "ship"],
  retro: ["ship"],
  "setup-memory": ["retro"],
  cso: ["office-hours", "autoplan"],
  codex: ["autoplan"],
  "make-pdf": [],
  health: [],
  guard: [],
  careful: [],
  freeze: [],
  unfreeze: [],
  learn: [],
  skillify: [],
  benchmark: [],
  "benchmark-models": [],
  "setup-browser-cookies": [],
  scrape: [],
  "pair-agent": [],
  browse: []
};

export class StalenessDetector {
  private readonly artifacts: ArtifactStore;
  private readonly graph: Record<string, string[]>;

  constructor(private readonly options: StalenessDetectorOptions) {
    this.artifacts = new ArtifactStore(options.dstackDir);
    this.graph = options.dependencyGraph ?? workflowDependencyGraph;
  }

  async detect(): Promise<StalenessDetectionResult> {
    const artifacts = await this.loadArtifacts();
    const stale = new Map<string, ArtifactStalenessReport>();
    for (const skillName of this.topologicalOrder()) {
      const artifact = artifacts.get(skillName);
      if (!artifact) continue;
      const deps = this.graph[skillName] ?? [];
      for (const dependency of deps) {
        const dependencyArtifact = artifacts.get(dependency);
        if (!dependencyArtifact) continue;
        const directStale = timestampOf(dependencyArtifact) > timestampOf(artifact);
        const propagated = stale.get(dependency);
        if (!directStale && !propagated) continue;
        const cause = directStale ? dependency : propagated!.staleBecauseOf;
        const staleSince = directStale ? dependencyArtifact.createdAt : propagated!.staleSince;
        stale.set(skillName, {
          skillName,
          artifactPath: artifact.filePath,
          artifactTimestamp: artifact.createdAt,
          staleBecauseOf: cause,
          staleSince,
          severity: severityFor(skillName),
          recommendation: `Re-run /${skillName}`
        });
        break;
      }
    }
    return [...stale.values()].sort((a, b) => a.skillName.localeCompare(b.skillName));
  }

  private async loadArtifacts(): Promise<Map<string, Artifact>> {
    const names = new Set([...Object.keys(this.graph), ...Object.values(this.graph).flat(), ...(await this.artifacts.listSkillsWithArtifacts())]);
    const artifacts = new Map<string, Artifact>();
    for (const name of names) {
      const artifact = await this.artifacts.readLatest(name);
      if (artifact) artifacts.set(name, normalizeArtifactTimestamp(artifact));
    }
    return artifacts;
  }

  private topologicalOrder(): string[] {
    const nodes = new Set([...Object.keys(this.graph), ...Object.values(this.graph).flat()]);
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];
    const visit = (node: string): void => {
      if (visited.has(node)) return;
      if (visiting.has(node)) return;
      visiting.add(node);
      for (const dependency of this.graph[node] ?? []) visit(dependency);
      visiting.delete(node);
      visited.add(node);
      order.push(node);
    };
    for (const node of nodes) visit(node);
    return order;
  }
}

function normalizeArtifactTimestamp(artifact: Artifact): Artifact {
  const parsed = Date.parse(artifact.createdAt);
  if (!Number.isNaN(parsed)) return artifact;
  const fromFile = path.basename(artifact.filePath).split("-").slice(0, 4).join("-");
  return { ...artifact, createdAt: fromFile || new Date(0).toISOString() };
}

function timestampOf(artifact: Artifact): number {
  const parsed = Date.parse(artifact.createdAt);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function severityFor(skillName: string): StalenessSeverity {
  if (["qa", "review", "ship", "land-and-deploy"].includes(skillName)) return "CRITICAL";
  if (skillName.includes("review") || skillName.includes("plan") || skillName.startsWith("design")) return "MAJOR";
  return "MINOR";
}
