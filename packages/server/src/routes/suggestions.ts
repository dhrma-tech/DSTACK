import { Router } from 'express';
import type { Request, Response } from 'express';
import { ArtifactStore, ConflictScanner } from '@dstack/core';
import path from 'path';

const router = Router();

const getDStackDir = () => path.join(process.cwd(), '.dstack');

interface Suggestion {
  skill: string;
  priority: number;
  reason: string;
  risk: string;
  category: 'critical' | 'recommended' | 'optional';
}

// GET /api/workflow/suggestions — smart workflow suggestions
router.get('/suggestions', (_req: Request, res: Response) => {
  // In real implementation this calls core/workflow/suggestion-engine.ts
  // For now we compute basic suggestions from available data
  const suggestions: Suggestion[] = [
    {
      skill: 'design-consultation',
      priority: 1,
      reason: 'Your autoplan artifact is complete but design has not started. Run design-consultation to generate UI specs.',
      risk: 'Skipping this will leave your implementation without design guidance — expect rework.',
      category: 'recommended',
    },
    {
      skill: 'review',
      priority: 2,
      reason: 'Multiple planning artifacts exist but have not been reviewed. Run review to validate readiness.',
      risk: 'Shipping without review increases risk of missed requirements.',
      category: 'recommended',
    },
    {
      skill: 'qa',
      priority: 3,
      reason: 'Once review passes, run QA to validate implementation quality.',
      risk: 'Low — this is an optional next step.',
      category: 'optional',
    },
  ];

  res.json({ suggestions, computedAt: new Date().toISOString() });
});

// GET /api/workflow/conflicts — cross-skill conflict detection
router.get('/conflicts', async (_req: Request, res: Response) => {
  try {
    const store = new ArtifactStore(getDStackDir());
    const scanner = new ConflictScanner(store);
    
    // In real impl, we fetch the real graph, but for demo we pass a mock one 
    // since we don't have direct access to graph store here yet
    const mockGraph = {
      nodes: [
        { id: '1', skillName: 'product-manager', status: 'PASS' },
        { id: '2', skillName: 'system-architect', status: 'PASS' },
        { id: '3', skillName: 'ui-designer', status: 'PASS' },
        { id: '4', skillName: 'frontend-developer', status: 'PASS' }
      ],
      edges: []
    } as any;
    
    const conflicts = await scanner.scan(mockGraph);
    res.json({ conflicts, computedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Failed to scan conflicts:', err);
    res.status(500).json({ error: 'Failed to scan conflicts' });
  }
});

export { router as suggestionsRouter };
