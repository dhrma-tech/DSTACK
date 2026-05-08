import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';

export type RunEvent =
  | { type: 'reasoning'; text: string }
  | { type: 'tool-call'; toolName: string; args: Record<string, unknown>; gateDecision: string }
  | { type: 'tool-result'; toolName: string; output: string; durationMs: number; error?: string }
  | { type: 'approval-required'; runId: string; toolName: string; description: string; permissionLevel: string; args: Record<string, unknown> }
  | { type: 'artifact-saved'; skillName: string; verdict: string; path: string; timestamp: string }
  | { type: 'complete'; skillName: string; status: string }
  | { type: 'error'; message: string; code?: string };

export class SkillRunner {
  private activeRuns = new Map<string, EventEmitter>();
  private childProcesses = new Map<string, ChildProcess>();
  private runLogs = new Map<string, RunEvent[]>();

  startRun(runId: string, skillName: string, args: Record<string, string> = {}) {
    const emitter = new EventEmitter();
    this.activeRuns.set(runId, emitter);
    this.runLogs.set(runId, []);

    this.emitEvent(runId, {
      type: 'reasoning',
      text: `Starting skill: ${skillName}`
    });

    const cliArgs = [`/${skillName}`, '--json-events'];
    for (const [key, value] of Object.entries(args)) {
      if (value !== undefined && value !== null) cliArgs.push(`--${key}=${value}`);
    }

    const projectRoot = process.cwd().endsWith('server')
      ? path.resolve(process.cwd(), '../../')
      : process.cwd();

    const cliScript = path.resolve(projectRoot, 'packages/cli/src/index.ts');

    const child = spawn('npx', ['tsx', cliScript, ...cliArgs], {
      cwd: projectRoot,
      shell: true
    });
    this.childProcesses.set(runId, child);

    child.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line) as RunEvent;
          this.emitEvent(runId, event);
        } catch {
          this.emitEvent(runId, { type: 'reasoning', text: line });
        }
      }
    });

    child.stderr.on('data', (data: Buffer) => {
      this.emitEvent(runId, { type: 'error', message: data.toString() });
    });

    child.on('close', (code) => {
      this.emitEvent(runId, {
        type: 'complete',
        status: code === 0 ? 'complete' : 'error',
        skillName
      });

      setTimeout(() => {
        this.activeRuns.delete(runId);
        this.childProcesses.delete(runId);
      }, 60000);
    });

    return emitter;
  }

  getEmitter(runId: string): EventEmitter | undefined {
    return this.activeRuns.get(runId);
  }

  getLog(runId: string): RunEvent[] {
    return this.runLogs.get(runId) ?? [];
  }

  private emitEvent(runId: string, event: RunEvent) {
    const log = this.runLogs.get(runId);
    if (log) log.push(event);
    const emitter = this.activeRuns.get(runId);
    if (emitter) emitter.emit('event', event);
  }

  respondToApproval(runId: string, decision: 'approve' | 'deny') {
    const child = this.childProcesses.get(runId);
    if (child?.stdin) {
      child.stdin.write(decision === 'approve' ? 'y\n' : 'n\n');
      this.emitEvent(runId, {
        type: 'reasoning',
        text: `Approval decision sent: ${decision}`
      });
    }
  }
}

export const globalSkillRunner = new SkillRunner();
