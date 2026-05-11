import { Router } from 'express';
import { LearningStore } from '@dstack/core';
import path from 'path';

export const learningsRouter = Router();

import fs from 'node:fs';

const findProjectRoot = () => {
  let current = __dirname;
  while (current !== path.parse(current).root) {
    if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }
    current = path.dirname(current);
  }
  return process.cwd();
};

const getStore = () => {
  const projectRoot = findProjectRoot();
  return new LearningStore({ dstackDir: path.join(projectRoot, '.dstack') });
};

learningsRouter.get('/', async (req, res) => {
  try {
    const store = getStore();
    const learnings = await store.all();
    res.json(learnings);
  } catch (err) {
    console.error('Failed to load learnings:', err);
    res.status(500).json({ error: 'Failed to load learnings' });
  }
});


// Status updates not implemented in current core store

learningsRouter.post('/extract', async (req, res) => {
  try {
    const { skillName, pattern, appliesTo } = req.body;
    const store = getStore();
    const entry = await store.add({
      topic: skillName || 'general',
      insight: pattern || 'New insight detected.',
      originalText: pattern || '',
      wasRephrased: false,
      appliesTo: Array.isArray(appliesTo) ? appliesTo : [skillName].filter(Boolean),
      source: 'retro'
    });
    res.json(entry);
  } catch (err) {
    console.error('Failed to extract learning:', err);
    res.status(500).json({ error: 'Failed to extract learning' });
  }
});

learningsRouter.delete('/:id', async (req, res) => {
  // Pruning is currently by date in core, but we could add single-item delete if needed.
  // For now, let's just stub this to avoid errors.
  res.status(501).json({ error: 'Single-item deletion not yet implemented in core store' });
});
