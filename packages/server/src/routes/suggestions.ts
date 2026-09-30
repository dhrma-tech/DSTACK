import { Router } from 'express';
import type { Request, Response } from 'express';
import { ArtifactStore, ConflictScanner, suggestNextSkills } from '@dstack/core';
import { getDstackDir } from '../context';
import { currentPipeline } from '../lib/pipeline';

const router = Router();

// GET /api/workflow/suggestions — ranked next steps from the current pipeline state
router.get('/suggestions', async (_req: Request, res: Response) => {
  try {
    const suggestions = suggestNextSkills(await currentPipeline());
    res.json({ suggestions, computedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Failed to compute suggestions:', err);
    res.status(500).json({ error: 'Failed to compute suggestions' });
  }
});

// GET /api/workflow/conflicts — contradictions between the latest artifacts' verdicts
router.get('/conflicts', async (_req: Request, res: Response) => {
  try {
    const conflicts = await new ConflictScanner(new ArtifactStore(getDstackDir())).scan();
    res.json({ conflicts, computedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Failed to scan conflicts:', err);
    res.status(500).json({ error: 'Failed to scan conflicts' });
  }
});

export { router as suggestionsRouter };
