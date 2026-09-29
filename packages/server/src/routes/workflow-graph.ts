import { Router } from 'express';
import { WorkflowService } from '@dstack/core';
import type { Contracts } from '@dstack/shared';
import { serviceOptions } from '../context';
import { asyncRoute } from '../lib/http';

export const workflowGraphRouter = Router();

type UiStatus = 'not_started' | 'ready' | 'running' | 'PASS' | 'REVISE' | 'FAIL' | 'BLOCKED' | 'STALE';

function uiStatus(node: Contracts.WorkflowNode): UiStatus {
  if (node.isStale || node.status === 'stale') return 'STALE';
  if (node.status === 'blocked') return 'BLOCKED';
  if (node.status === 'running') return 'running';
  if (node.status === 'ready') return 'ready';
  if (node.verdict) return node.verdict;
  return 'not_started';
}

workflowGraphRouter.get('/graph', asyncRoute(async (_req, res) => {
  const graph = await new WorkflowService(serviceOptions()).getWorkflowStatus();
  const skillNodes = graph.nodes.filter((node) => node.nodeType === 'skill');
  const skillIds = new Set(skillNodes.map((node) => node.id));
  res.json({
    currentStage: graph.currentStage,
    blockers: graph.blockers,
    suggestedNextSkills: graph.suggestedNextSkills,
    nodes: skillNodes.map((node) => ({
      id: node.id,
      skillName: node.skillName ?? node.id,
      label: node.label,
      phase: node.stage,
      status: uiStatus(node),
      verdict: node.verdict ?? null,
      timestamp: null,
      isStale: node.isStale
    })),
    edges: graph.edges
      .filter((edge) => skillIds.has(edge.fromNodeId) && skillIds.has(edge.toNodeId))
      .map((edge) => ({ from: edge.fromNodeId, to: edge.toNodeId }))
  });
}));
