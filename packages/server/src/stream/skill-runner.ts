import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { getProjectRoot } from '../context';
import { toProjectRelative } from '../lib/redact';
import { saveRunRecord, type RunRecord } from '../lib/run-records';

export type RunEvent =
  | { type: 'reasoning'; text: string }
  | { type: 'tool-call'; toolName: string; args: Record<string, unknown>; gateDecision: string }
  | { type: 'tool-result'; toolName: string; output: string; durationMs: number; error?: string }
  | { type: 'approval-required'; runId: string; toolName: string; description: string; permissionLevel: string; args: Record<string, unknown> }
  | { type: 'artifact-saved'; skillName: string; verdict: string; path: string; timestamp: string }
  | { type: 'complete'; skillName: string; status: string; verdict?: string | null; durationMs?: number }
  | { type: 'error'; message: string; code?: string };

export interface RunRequest {
  inputs: Record<string, string>;
  flags: { force?: boolean; dryRun?: boolean; provider?: 'gemini' | 'fake' };
}

const STOP_GRACE_MS = 5_000;
// eslint-disable-next-line no-control-regex -- matching terminal escape sequences is the point
const ANSI_ESCAPE = /\u001b\[[0-9;]*[A-Za-z]/g;
const SAVE_DEBOUNCE_MS = 500;

// Resolved once: running the CLI via `node <tsx cli>` avoids a shell entirely,
// so no request value is ever interpreted by a shell.
const tsxCli = require.resolve('tsx/cli');

export function buildCliArgs(skillName: string, request: RunRequest): string[] {
  const args = [`/${skillName}`, '--json-events'];
  for (const [key, value] of Object.entries(request.inputs)) args.push(`--${key}=${value}`);
  if (request.flags.force) args.push('--force');
  if (request.flags.dryRun) args.push('--dry-run');
  if (request.flags.provider) args.push(`--provider=${request.flags.provider}`);
  return args;
}

export class SkillRunner {
  public globalEmitter = new EventEmitter();
  private activeRuns = new Map<string, EventEmitter>();
  private childProcesses = new Map<string, ChildProcess>();
  private records = new Map<string, RunRecord>();
  private saveTimers = new Map<string, NodeJS.Timeout>();
  private stopped = new Set<string>();
  private saving = new Map<string, Promise<void>>();

  startRun(runId: string, skillName: string, request: RunRequest = { inputs: {}, flags: {} }): EventEmitter {
    const emitter = new EventEmitter();
    this.activeRuns.set(runId, emitter);
    this.records.set(runId, {
      id: runId, skillName, status: 'running', startedAt: new Date().toISOString(), completedAt: null,
      verdict: null, durationMs: null, provider: request.flags.provider ?? process.env.DSTACK_PROVIDER ?? 'gemini',
      toolCallCount: 0, inputs: { ...request.inputs }, flags: { ...request.flags }, events: []
    });

    this.emitEvent(runId, { type: 'reasoning', text: `Starting skill: ${skillName}` });

    const projectRoot = getProjectRoot();
    const cliScript = path.resolve(__dirname, '../../../cli/src/index.ts');
    const child = spawn(process.execPath, [tsxCli, '--conditions', 'development', cliScript, ...buildCliArgs(skillName, request)], {
      cwd: projectRoot,
      shell: false,
      env: { ...process.env, DSTACK_PROJECT_ROOT: projectRoot }
    });
    this.childProcesses.set(runId, child);

    let buffered = '';
    child.stdout?.on('data', (data: Buffer) => {
      buffered += data.toString();
      const lines = buffered.split('\n');
      buffered = lines.pop() ?? '';
      for (const line of lines) this.handleLine(runId, line);
    });

    child.stderr?.on('data', (data: Buffer) => {
      this.emitEvent(runId, { type: 'error', message: data.toString() });
    });

    child.on('close', (code) => {
      if (buffered.trim()) this.handleLine(runId, buffered);
      const record = this.records.get(runId);
      const wasStopped = this.stopped.has(runId);
      const status = wasStopped ? 'interrupted' : code === 0 ? 'complete' : 'error';
      const durationMs = record ? Date.now() - Date.parse(record.startedAt) : 0;
      if (record) {
        record.status = status;
        record.completedAt = new Date().toISOString();
        record.durationMs = durationMs;
      }
      // Persist the finished record before announcing completion, so anyone who
      // reacts to `complete` by reading the run sees its final state.
      const complete = this.record(runId, { type: 'complete', status, skillName, verdict: record?.verdict ?? null, durationMs });
      this.stopped.delete(runId);
      void this.flush(runId).finally(() => this.broadcast(runId, complete));
      setTimeout(() => {
        this.activeRuns.delete(runId);
        this.childProcesses.delete(runId);
        this.records.delete(runId);
        this.saving.delete(runId);
      }, 60_000).unref();
    });

    return emitter;
  }

  /** Stops a running skill. Returns false if the run isn't active. */
  stopRun(runId: string): boolean {
    const child = this.childProcesses.get(runId);
    if (!child || child.exitCode !== null) return false;
    this.stopped.add(runId);
    this.emitEvent(runId, { type: 'error', message: 'Run stopped by user.', code: 'STOPPED' });
    child.kill('SIGTERM');
    setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
    }, STOP_GRACE_MS).unref();
    return true;
  }

  isActive(runId: string): boolean {
    const child = this.childProcesses.get(runId);
    return !!child && child.exitCode === null;
  }

  getEmitter(runId: string): EventEmitter | undefined {
    return this.activeRuns.get(runId);
  }

  getLog(runId: string): RunEvent[] {
    return this.records.get(runId)?.events ?? [];
  }

  respondToApproval(runId: string, decision: 'approve' | 'deny'): boolean {
    const child = this.childProcesses.get(runId);
    if (!child?.stdin || child.exitCode !== null) return false;
    child.stdin.write(decision === 'approve' ? 'y\n' : 'n\n');
    this.emitEvent(runId, { type: 'reasoning', text: `Approval decision sent: ${decision}` });
    return true;
  }

  private handleLine(runId: string, line: string): void {
    if (!line.trim()) return;
    let event: RunEvent;
    try {
      event = JSON.parse(line) as RunEvent;
    } catch {
      // Plain CLI output; drop terminal colour codes so the text reads cleanly in the browser.
      this.emitEvent(runId, { type: 'reasoning', text: line.replace(ANSI_ESCAPE, '') });
      return;
    }
    // The CLI prints its own `complete` before it exits. The runner sends the authoritative
    // one after the process has exited and the record is saved, so the CLI's copy is dropped.
    if (event.type === 'complete') return;
    this.emitEvent(runId, event);
  }

  private emitEvent(runId: string, rawEvent: RunEvent): void {
    this.broadcast(runId, this.record(runId, rawEvent));
  }

  /** Adds an event to the run record. Events reach the browser and disk, so project paths are made relative first. */
  private record(runId: string, rawEvent: RunEvent): RunEvent {
    const event = toProjectRelative(rawEvent);
    const record = this.records.get(runId);
    if (record) {
      record.events.push(event);
      if (event.type === 'tool-call') record.toolCallCount += 1;
      if (event.type === 'artifact-saved' && (event.verdict === 'PASS' || event.verdict === 'REVISE' || event.verdict === 'FAIL')) record.verdict = event.verdict;
      this.scheduleSave(runId);
    }
    return event;
  }

  private broadcast(runId: string, event: RunEvent): void {
    this.activeRuns.get(runId)?.emit('event', event);
    this.globalEmitter.emit('global_event', { runId, event });
  }

  private scheduleSave(runId: string): void {
    if (this.saveTimers.has(runId)) return;
    this.saveTimers.set(runId, setTimeout(() => void this.flush(runId), SAVE_DEBOUNCE_MS));
  }

  /** Saves the run record now. Saves for one run are chained so an older snapshot never lands after a newer one. */
  private flush(runId: string): Promise<void> {
    const timer = this.saveTimers.get(runId);
    if (timer) clearTimeout(timer);
    this.saveTimers.delete(runId);
    const previous = this.saving.get(runId) ?? Promise.resolve();
    const next = previous.then(async () => {
      const record = this.records.get(runId);
      if (!record) return;
      try {
        await saveRunRecord(record);
      } catch (error) {
        console.error(`Failed to save run record ${runId}:`, error);
      }
    });
    this.saving.set(runId, next);
    return next;
  }

}

export const globalSkillRunner = new SkillRunner();
