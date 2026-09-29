import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Router, type Response } from 'express';
import { getDstackDir } from '../context';
import { asyncRoute, HttpError, openSse, rateLimit, writeSse } from '../lib/http';
import { listRunRecords, readRunRecord, RUN_ID_PATTERN } from '../lib/run-records';
import { newRunId, parseInputs, parseRunRequest, resolveSkillName } from '../lib/run-request';
import { globalChainRunner } from '../stream/chain-runner';
import { globalSkillRunner, type RunEvent } from '../stream/skill-runner';

export const runsRouter = Router();

function requireRunId(raw: unknown): string {
  const runId = String(raw);
  if (!RUN_ID_PATTERN.test(runId)) throw new HttpError(404, 'Run not found', 'NOT_FOUND');
  return runId;
}

// Runs started from the CLI only leave a session log, not a run record.
async function listCliSessionLogs(limit: number) {
  const logsDir = path.join(getDstackDir(), 'logs');
  let files: string[];
  try {
    files = (await readdir(logsDir)).filter((file) => file.endsWith('.json'));
  } catch {
    return [];
  }
  const entries = await Promise.all(files.slice(-limit * 2).map(async (file) => {
    try {
      const parsed = JSON.parse(await readFile(path.join(logsDir, file), 'utf-8')) as { skillName?: string; startedAt?: string; completedAt?: string; provider?: string; status?: string };
      if (!parsed.skillName || !parsed.startedAt) return null;
      return {
        id: file.slice(0, -5), skillName: parsed.skillName, status: parsed.status ?? 'complete', startedAt: parsed.startedAt,
        completedAt: parsed.completedAt ?? null, verdict: null, provider: parsed.provider ?? 'gemini', toolCallCount: 0,
        durationMs: parsed.completedAt ? Date.parse(parsed.completedAt) - Date.parse(parsed.startedAt) : null, source: 'cli' as const
      };
    } catch {
      return null;
    }
  }));
  return entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

runsRouter.get('/runs', asyncRoute(async (req, res) => {
  const limit = Math.min(Number.parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
  const [records, cliRuns] = await Promise.all([listRunRecords(limit), listCliSessionLogs(limit)]);
  const merged = [...records.map((record) => ({ ...record, source: 'web' as const })), ...cliRuns];
  res.json(merged.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, limit));
}));

runsRouter.get('/runs/:runId', asyncRoute(async (req, res) => {
  const runId = requireRunId(req.params.runId);
  const record = await readRunRecord(runId);
  if (!record) throw new HttpError(404, 'Run not found', 'NOT_FOUND');
  res.json({ ...record, active: globalSkillRunner.isActive(runId) });
}));

runsRouter.post('/runs/:runId/stop', asyncRoute(async (req, res) => {
  const runId = requireRunId(req.params.runId);
  if (!globalSkillRunner.stopRun(runId)) throw new HttpError(409, 'Run is not active', 'NOT_ACTIVE');
  res.json({ stopped: true });
}));

runsRouter.post('/skills/:skillName/run', rateLimit(30), asyncRoute(async (req, res) => {
  const skillName = await resolveSkillName(req.params.skillName);
  const request = parseRunRequest(req.body);
  const runId = newRunId();
  globalSkillRunner.startRun(runId, skillName, request);
  res.json({ runId });
}));

async function replayStored(runId: string, res: Response): Promise<void> {
  const record = await readRunRecord(runId);
  if (!record) throw new HttpError(404, 'Run not found', 'NOT_FOUND');
  openSse(res);
  for (const event of record.events) writeSse(res, event);
  res.end();
}

runsRouter.get('/runs/:runId/stream', asyncRoute(async (req, res) => {
  const runId = requireRunId(req.params.runId);
  const emitter = globalSkillRunner.getEmitter(runId);
  if (!emitter) return replayStored(runId, res);

  openSse(res);
  const log = globalSkillRunner.getLog(runId);
  for (const event of log) writeSse(res, event);
  if (log.at(-1)?.type === 'complete') {
    res.end();
    return;
  }
  const listener = (event: RunEvent) => {
    writeSse(res, event);
    if (event.type === 'complete') res.end();
  };
  emitter.on('event', listener);
  req.on('close', () => emitter.off('event', listener));
}));

runsRouter.post('/approvals/:runId/respond', asyncRoute(async (req, res) => {
  const runId = requireRunId(req.params.runId);
  const { decision } = (req.body ?? {}) as { decision?: unknown };
  if (decision !== 'approve' && decision !== 'deny') throw new HttpError(400, 'decision must be "approve" or "deny"', 'VALIDATION');
  if (!globalSkillRunner.respondToApproval(runId, decision)) throw new HttpError(409, 'Run is not waiting for approval', 'NOT_ACTIVE');
  res.json({ written: true });
}));

runsRouter.post('/chain/run', rateLimit(10), asyncRoute(async (req, res) => {
  const { chain, inputs } = (req.body ?? {}) as { chain?: unknown; inputs?: unknown };
  if (!Array.isArray(chain) || chain.length === 0 || chain.length > 20) throw new HttpError(400, 'chain must be a list of 1–20 skill names', 'VALIDATION');
  const skills = await Promise.all(chain.map(resolveSkillName));
  const chainId = globalChainRunner.startChain(skills, parseInputs(inputs));
  res.json({ chainId });
}));

runsRouter.get('/chain/:chainId/stream', (req, res) => {
  const chainState = globalChainRunner.getChain(String(req.params.chainId));
  if (!chainState) {
    res.status(404).json({ error: 'Chain not found', code: 'NOT_FOUND' });
    return;
  }
  openSse(res);
  const onStart = (data: object) => writeSse(res, { type: 'skill_start', ...data });
  const onEvent = (data: object) => writeSse(res, { type: 'skill_event', ...data });
  const onComplete = (data: object) => {
    writeSse(res, { type: 'chain_complete', ...data });
    res.end();
  };
  chainState.emitter.on('skill_start', onStart);
  chainState.emitter.on('skill_event', onEvent);
  chainState.emitter.on('chain_complete', onComplete);
  req.on('close', () => {
    chainState.emitter.off('skill_start', onStart);
    chainState.emitter.off('skill_event', onEvent);
    chainState.emitter.off('chain_complete', onComplete);
  });
});
