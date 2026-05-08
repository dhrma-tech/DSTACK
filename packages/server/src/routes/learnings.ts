import { Router } from 'express';
import { LearningStore } from '@dstack/core';
import path from 'path';

export const learningsRouter = Router();

const getStore = () => {
  const projectRoot = process.cwd().endsWith('server') ? path.resolve(process.cwd(), '../../') : process.cwd();
  return new LearningStore(projectRoot);
};

learningsRouter.get('/', async (req, res) => {
  try {
    const store = getStore();
    const learnings = await store.getLearnings();
    res.json(learnings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load learnings' });
  }
});

learningsRouter.post('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (status !== 'approved' && status !== 'rejected') {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const store = getStore();
    const success = await store.updateStatus(id, status);
    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update learning status' });
  }
});

learningsRouter.post('/extract', async (req, res) => {
  // Mock logic for "Pattern Extraction"
  // In a real scenario, this would call an LLM with run logs to extract patterns
  try {
    const { runId, skillName, pattern, context } = req.body;
    const store = getStore();
    const entry = await store.addLearning({
      skillName,
      sourceRunId: runId,
      pattern: pattern || "New pattern detected from run logs.",
      context: context || "General"
    });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: 'Failed to extract learning' });
  }
});
