import { Router } from 'express';
import { LearningStore } from '@dstack/core';
import type { LearningEntry } from '@dstack/shared';
import { getDstackDir } from '../context';
import { asyncRoute, HttpError } from '../lib/http';

export const learningsRouter = Router();

function store(): LearningStore {
  return new LearningStore({ dstackDir: getDstackDir() });
}

// Shape expected by the Learning Center page.
function present(entry: LearningEntry) {
  return {
    id: entry.id,
    skillName: entry.topic,
    pattern: entry.insight,
    context: entry.originalText,
    appliesTo: entry.appliesTo,
    source: entry.source,
    sourceRunId: entry.usedInSkillRuns[0] ?? '',
    status: entry.status ?? 'pending',
    createdAt: entry.createdAt
  };
}

learningsRouter.get('/', asyncRoute(async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const entries = query ? await store().search(query) : await store().all();
  res.json(entries.map(present));
}));

learningsRouter.post('/extract', asyncRoute(async (req, res) => {
  const { skillName, pattern, context, runId, appliesTo } = (req.body ?? {}) as Record<string, unknown>;
  if (typeof pattern !== 'string' || !pattern.trim()) throw new HttpError(400, 'pattern is required', 'VALIDATION');
  const topic = typeof skillName === 'string' && skillName ? skillName : 'general';
  const entry = await store().add({
    topic,
    insight: pattern.trim(),
    originalText: typeof context === 'string' && context ? context : pattern.trim(),
    wasRephrased: false,
    appliesTo: Array.isArray(appliesTo) ? appliesTo.filter((item): item is string => typeof item === 'string') : [topic],
    source: 'manual',
    usedInSkillRuns: typeof runId === 'string' && runId ? [runId] : [],
    status: 'pending'
  });
  res.json(present(entry));
}));

learningsRouter.post('/:id/status', asyncRoute(async (req, res) => {
  const { status } = (req.body ?? {}) as { status?: unknown };
  if (status !== 'approved' && status !== 'rejected' && status !== 'pending') {
    throw new HttpError(400, 'status must be approved, rejected or pending', 'VALIDATION');
  }
  const entry = await store().setStatus(String(req.params.id), status);
  if (!entry) throw new HttpError(404, 'Learning not found', 'NOT_FOUND');
  res.json(present(entry));
}));

learningsRouter.delete('/:id', asyncRoute(async (req, res) => {
  if (!(await store().remove(String(req.params.id)))) throw new HttpError(404, 'Learning not found', 'NOT_FOUND');
  res.json({ deleted: true });
}));
