import { Router } from 'express';
import { SkillRegistry } from '@dstack/core';
import { CLI_ONLY_SKILLS, PARTIAL_SKILLS, SKILL_STAGE, type SkillManifest, type SkillPipelineNode } from '@dstack/shared';
import { asyncRoute, HttpError } from '../lib/http';
import { currentPipeline } from '../lib/pipeline';
import { listRunRecords } from '../lib/run-records';

export const skillsRouter = Router();

const registry = new SkillRegistry();
const RECENT_RUNS = 3;

function summary(manifest: SkillManifest, node: SkillPipelineNode | undefined) {
  return {
    name: manifest.name,
    command: manifest.name,
    description: manifest.description,
    stage: SKILL_STAGE[manifest.name] ?? 'utility',
    model: manifest.model,
    maturity: PARTIAL_SKILLS.includes(manifest.name) ? 'partial' : 'complete',
    available: !CLI_ONLY_SKILLS.includes(manifest.name),
    cliOnly: CLI_ONLY_SKILLS.includes(manifest.name),
    hidden: CLI_ONLY_SKILLS.includes(manifest.name),
    status: node?.status ?? 'ready',
    hasLatestArtifact: Boolean(node?.artifactAt),
    lastRunAt: node?.artifactAt ?? null,
    lastVerdict: node?.verdict ?? null,
    isBlocked: node?.status === 'blocked',
    missing: node?.missing ?? [],
    requiresArtifacts: manifest.requiresArtifacts,
    allowedTools: manifest.allowedTools,
    nextSkill: manifest.nextSkill
  };
}

skillsRouter.get('/', asyncRoute(async (_req, res) => {
  const [manifests, pipeline] = await Promise.all([registry.list(), currentPipeline()]);
  const nodes = new Map(pipeline.nodes.map((node) => [node.skillName, node]));
  res.json(manifests.map((manifest) => summary(manifest, nodes.get(manifest.name))));
}));

// There is no skill marketplace yet. An empty list lets the page say so instead of showing invented listings.
skillsRouter.get('/market', (_req, res) => {
  res.json([]);
});

skillsRouter.get('/:skillName', asyncRoute(async (req, res) => {
  const raw = String(req.params.skillName);
  let manifest: SkillManifest;
  try {
    manifest = await registry.resolve(raw);
  } catch {
    throw new HttpError(404, `Unknown skill: ${raw}`, 'UNKNOWN_SKILL');
  }
  const pipeline = await currentPipeline();
  const recentRuns = (await listRunRecords(200)).filter((run) => run.skillName === manifest.name).slice(0, RECENT_RUNS);
  res.json({ ...summary(manifest, pipeline.nodes.find((node) => node.skillName === manifest.name)), inputs: manifest.inputs, recentRuns });
}));
