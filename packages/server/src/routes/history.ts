import { Router } from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

interface HistoryEntry {
  id: string;
  command: string;
  skillName: string;
  inputs: Record<string, string>;
  flags: Record<string, boolean | string>;
  verdict: 'PASS' | 'REVISE' | 'FAIL' | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  provider: string;
  model: string;
}

interface HistoryStore {
  version: '1';
  entries: HistoryEntry[];
}

function getHistoryPath(): string {
  const projectRoot = process.cwd().endsWith('server')
    ? path.resolve(process.cwd(), '../../')
    : process.cwd();
  return path.join(projectRoot, '.dstack', 'history.json');
}

function readHistory(): HistoryStore {
  const historyPath = getHistoryPath();
  try {
    if (fs.existsSync(historyPath)) {
      const raw = fs.readFileSync(historyPath, 'utf-8');
      return JSON.parse(raw) as HistoryStore;
    }
  } catch { /* ignore */ }
  return { version: '1', entries: [] };
}

function writeHistory(store: HistoryStore): void {
  const historyPath = getHistoryPath();
  const dir = path.dirname(historyPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(historyPath, JSON.stringify(store, null, 2), 'utf-8');
}

// GET /api/history — list history entries with optional filters
router.get('/', (req: Request, res: Response) => {
  const store = readHistory();
  let entries = store.entries;

  // Filter by search query
  const search = (req.query.search as string)?.toLowerCase();
  if (search) {
    entries = entries.filter(
      e => e.skillName.toLowerCase().includes(search) ||
           e.command.toLowerCase().includes(search)
    );
  }

  // Filter by skill name
  const skill = req.query.skill as string;
  if (skill) {
    entries = entries.filter(e => e.skillName === skill);
  }

  // Filter by verdict
  const verdict = req.query.verdict as string;
  if (verdict) {
    entries = entries.filter(e => e.verdict === verdict);
  }

  // Filter by days
  const days = parseInt(req.query.days as string, 10);
  if (days > 0) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    entries = entries.filter(e => new Date(e.startedAt).getTime() >= cutoff);
  }

  // Limit
  const limit = parseInt(req.query.limit as string, 10) || 100;
  entries = entries.slice(0, limit);

  res.json({ entries, total: store.entries.length });
});

// POST /api/history — add a history entry
router.post('/', (req: Request, res: Response) => {
  const store = readHistory();
  const entry: HistoryEntry = {
    id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    command: req.body.command ?? `/${req.body.skillName}`,
    skillName: req.body.skillName,
    inputs: req.body.inputs ?? {},
    flags: req.body.flags ?? {},
    verdict: req.body.verdict ?? null,
    startedAt: req.body.startedAt ?? new Date().toISOString(),
    completedAt: req.body.completedAt ?? null,
    durationMs: req.body.durationMs ?? null,
    provider: req.body.provider ?? 'unknown',
    model: req.body.model ?? 'unknown',
  };
  store.entries.unshift(entry); // newest first
  // Keep max 500 entries
  if (store.entries.length > 500) store.entries = store.entries.slice(0, 500);
  writeHistory(store);
  res.status(201).json(entry);
});

// POST /api/history/:id/rerun — clone a history entry for re-execution
router.post('/:id/rerun', (req: Request, res: Response) => {
  const store = readHistory();
  const original = store.entries.find(e => e.id === req.params.id);
  if (!original) {
    res.status(404).json({ error: 'History entry not found' });
    return;
  }
  res.json({
    skillName: original.skillName,
    inputs: original.inputs,
    flags: original.flags,
  });
});

// DELETE /api/history — clear all history
router.delete('/', (_req: Request, res: Response) => {
  writeHistory({ version: '1', entries: [] });
  res.json({ cleared: true });
});

export { router as historyRouter };
