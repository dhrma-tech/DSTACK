import { Router } from 'express';
import type { SkillPipelineNode } from '@dstack/shared';
import { asyncRoute } from '../lib/http';
import { currentPipeline } from '../lib/pipeline';

export const workflowGraphRouter = Router();

type UiStatus = 'not_started' | 'ready' | 'PASS' | 'REVISE' | 'FAIL' | 'BLOCKED' | 'STALE';

function uiStatus(node: SkillPipelineNode): UiStatus {
  switch (node.status) {
    case 'stale': return 'STALE';
    case 'blocked': return 'BLOCKED';
    case 'ready': return 'ready';
    case 'complete': return 'PASS';
    default: return node.status;
  }
}

workflowGraphRouter.get('/graph', asyncRoute(async (_req, res) => {
  const pipeline = await currentPipeline();
  res.json({
    nodes: pipeline.nodes.map((node) => ({
      id: node.skillName,
      skillName: node.skillName,
      label: node.skillName,
      phase: node.requires.length === 0 ? 'start' : 'pipeline',
      status: uiStatus(node),
      verdict: node.verdict,
      timestamp: node.artifactAt,
      isStale: node.status === 'stale',
      missing: node.missing,
      staleBecause: node.staleBecause
    })),
    edges: pipeline.edges
  });
}));
