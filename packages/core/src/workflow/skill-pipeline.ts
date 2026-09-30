import { CORE_PIPELINE, PROJECT_STAGES, SKILL_STAGE, type ProjectHealth, type ProjectHealthStatus, type ProjectStage, type SkillManifest, type SkillPipeline, type SkillPipelineNode, type SkillSuggestion, type Verdict } from "@dstack/shared";

export interface PipelineSources {
  manifests: SkillManifest[];
  readLatest(skillName: string): Promise<{ verdict: Verdict | null; createdAt: string } | null>;
}

const MAX_SUGGESTIONS = 8;
const MAX_RECOMMENDED = 3;

/** Builds each skill's status from its latest artifact and the artifacts it requires. */
export async function buildSkillPipeline(sources: PipelineSources): Promise<SkillPipeline> {
  const manifests = new Map(sources.manifests.map((manifest) => [manifest.name, manifest]));
  const latest = new Map(await Promise.all(sources.manifests.map(async (manifest) => [manifest.name, await sources.readLatest(manifest.name)] as const)));

  // Staleness propagates downstream: if /autoplan is re-run, /qa (which needs it) and /ship (which needs /qa) are stale.
  const staleMemo = new Map<string, string[]>();
  const staleCauses = (skill: string, visiting: Set<string>): string[] => {
    const cached = staleMemo.get(skill);
    if (cached) return cached;
    const own = latest.get(skill);
    const manifest = manifests.get(skill);
    if (!own || !manifest || visiting.has(skill)) return [];
    visiting.add(skill);
    const causes = new Set<string>();
    for (const required of manifest.requiresArtifacts) {
      const upstream = latest.get(required);
      if (upstream && Date.parse(upstream.createdAt) > Date.parse(own.createdAt)) causes.add(required);
      if (staleCauses(required, visiting).length > 0) causes.add(required);
    }
    visiting.delete(skill);
    const result = [...causes].sort();
    staleMemo.set(skill, result);
    return result;
  };

  const nodes: SkillPipelineNode[] = sources.manifests.map((manifest) => {
    const own = latest.get(manifest.name) ?? null;
    const missing = manifest.requiresArtifacts.filter((required) => !latest.get(required));
    const staleBecause = staleCauses(manifest.name, new Set());
    let status: SkillPipelineNode["status"];
    if (own && staleBecause.length > 0) status = "stale";
    else if (own) status = own.verdict ?? "complete";
    else status = missing.length > 0 ? "blocked" : "ready";
    return { skillName: manifest.name, requires: [...manifest.requiresArtifacts], status, verdict: own?.verdict ?? null, artifactAt: own?.createdAt ?? null, missing, staleBecause, nextSkill: manifest.nextSkill };
  });

  const edges = sources.manifests.flatMap((manifest) => manifest.requiresArtifacts.filter((required) => manifests.has(required)).map((required) => ({ from: required, to: manifest.name })));
  return { nodes, edges };
}

function pipelineRank(skill: string): number {
  const index = CORE_PIPELINE.indexOf(skill);
  return index === -1 ? CORE_PIPELINE.length : index;
}

function byPipeline(a: SkillPipelineNode, b: SkillPipelineNode): number {
  return pipelineRank(a.skillName) - pipelineRank(b.skillName) || a.skillName.localeCompare(b.skillName);
}

/** Turns pipeline state into ranked next steps: problems first, then the next skills on the core path. */
export function suggestNextSkills(pipeline: SkillPipeline): SkillSuggestion[] {
  const sorted = [...pipeline.nodes].sort(byPipeline);
  const suggestions: Omit<SkillSuggestion, "priority">[] = [];

  for (const node of sorted.filter((item) => item.status === "FAIL")) {
    suggestions.push({ skill: node.skillName, category: "critical", reason: `/${node.skillName} failed. Fix what it reported, or run /investigate, then re-run it.`, risk: `Skills after /${node.skillName} are working from a failed result.` });
  }
  for (const node of sorted.filter((item) => item.status === "stale")) {
    const causes = node.staleBecause.map((cause) => `/${cause}`).join(", ");
    suggestions.push({ skill: node.skillName, category: "critical", reason: `Re-run /${node.skillName}: ${causes} changed after it last ran.`, risk: `Its result may not match the latest ${causes}.` });
  }
  for (const node of sorted.filter((item) => item.status === "REVISE")) {
    suggestions.push({ skill: node.skillName, category: "recommended", reason: `/${node.skillName} asked for revisions. Address them and re-run it.`, risk: "Moving on leaves known issues unresolved." });
  }
  const ready = sorted.filter((item) => item.status === "ready");
  ready.forEach((node, index) => {
    const onCorePath = CORE_PIPELINE.includes(node.skillName);
    suggestions.push({
      skill: node.skillName,
      category: onCorePath && index < MAX_RECOMMENDED ? "recommended" : "optional",
      reason: node.requires.length > 0 ? `Everything /${node.skillName} needs is ready (${node.requires.map((r) => `/${r}`).join(", ")}).` : `/${node.skillName} has no prerequisites.`,
      risk: onCorePath ? `Later steps that need /${node.skillName} stay blocked until it runs.` : "Optional step."
    });
  });

  return suggestions.slice(0, MAX_SUGGESTIONS).map((suggestion, index) => ({ ...suggestion, priority: index + 1 }));
}

const HEALTH_PENALTY = { FAIL: 25, stale: 10, REVISE: 5 } as const;

/** The furthest stage with a finished, non-failing result. A new project is in planning. */
export function projectStage(pipeline: SkillPipeline): ProjectStage {
  let furthest = 0;
  for (const node of pipeline.nodes) {
    const stage = SKILL_STAGE[node.skillName];
    if (!stage || !(node.status === "PASS" || node.status === "complete")) continue;
    furthest = Math.max(furthest, PROJECT_STAGES.indexOf(stage));
  }
  return PROJECT_STAGES[furthest] ?? "planning";
}

/** A simple, explainable health score derived from the pipeline. */
export function projectHealth(pipeline: SkillPipeline): ProjectHealth {
  const names = (status: SkillPipelineNode["status"]) => pipeline.nodes.filter((node) => node.status === status).map((node) => node.skillName);
  const failing = names("FAIL");
  const stale = names("stale");
  const revise = names("REVISE");
  const score = Math.max(0, 100 - failing.length * HEALTH_PENALTY.FAIL - stale.length * HEALTH_PENALTY.stale - revise.length * HEALTH_PENALTY.REVISE);
  const status: ProjectHealthStatus = score >= 80 ? "HEALTHY" : score >= 50 ? "DEGRADED" : "CRITICAL";
  const recommendations = suggestNextSkills(pipeline).slice(0, 3).map((suggestion) => suggestion.reason);
  return { score, status, failing, stale, revise, recommendations };
}
