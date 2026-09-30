import { randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getDstackDir } from '../context';
import type { RunEvent } from '../stream/skill-runner';

export type RunStatus = 'running' | 'complete' | 'error' | 'interrupted';

export interface RunRecord {
  id: string;
  skillName: string;
  status: RunStatus;
  startedAt: string;
  completedAt: string | null;
  verdict: 'PASS' | 'REVISE' | 'FAIL' | null;
  durationMs: number | null;
  provider: string;
  toolCallCount: number;
  /** What the run was started with, so it can be re-run. */
  inputs: Record<string, string>;
  flags: { force?: boolean; dryRun?: boolean; provider?: 'gemini' | 'fake' };
  events: RunEvent[];
}

export const RUN_ID_PATTERN = /^run-\d+-[a-z0-9]+$/;

function runsDir(): string {
  return path.join(getDstackDir(), 'runs');
}

export async function saveRunRecord(record: RunRecord): Promise<void> {
  await mkdir(runsDir(), { recursive: true });
  const target = path.join(runsDir(), `${record.id}.json`);
  const content = JSON.stringify(record, null, 2);
  const temp = `${target}.${process.pid}-${randomBytes(4).toString('hex')}.tmp`;
  await writeFile(temp, content, 'utf-8');
  await rename(temp, target);
}

export async function readRunRecord(runId: string): Promise<RunRecord | null> {
  if (!RUN_ID_PATTERN.test(runId)) return null;
  try {
    return JSON.parse(await readFile(path.join(runsDir(), `${runId}.json`), 'utf-8')) as RunRecord;
  } catch {
    return null;
  }
}

export async function listRunRecords(limit: number): Promise<Omit<RunRecord, 'events'>[]> {
  let files: string[];
  try {
    files = await readdir(runsDir());
  } catch {
    return [];
  }
  const ids = files.filter((file) => file.endsWith('.json')).map((file) => file.slice(0, -5)).filter((id) => RUN_ID_PATTERN.test(id));
  const records = await Promise.all(ids.map(readRunRecord));
  return records
    .filter((record): record is RunRecord => record !== null)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, limit)
    .map(({ events: _events, ...summary }) => summary);
}
