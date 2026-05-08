import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

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
router.get('/conflicts', (_req: Request, res: Response) => {
  // Placeholder — will be implemented in Phase 2
  res.json({ conflicts: [], computedAt: new Date().toISOString() });
});

export { router as suggestionsRouter };
