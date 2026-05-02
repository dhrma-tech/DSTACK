import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';

export interface RunEvent {
  type: 'reasoning' | 'tool-call' | 'tool-result' | 'approval-required' | 'artifact-saved' | 'complete' | 'error';
  payload?: any;
}

export class SkillRunner {
  private activeRuns = new Map<string, EventEmitter>();
  private runLogs = new Map<string, RunEvent[]>();

  startRun(runId: string, skillName: string, args: Record<string, string> = {}) {
    const emitter = new EventEmitter();
    this.activeRuns.set(runId, emitter);
    this.runLogs.set(runId, []);

    // Push initial command event
    this.emitEvent(runId, {
      type: 'reasoning',
      payload: `Starting skill: /${skillName}`
    });

    // Format CLI args
    const cliArgs = [`/${skillName}`];
    for (const [key, value] of Object.entries(args)) {
      if (value) cliArgs.push(`--${key}=${value}`);
    }

    // Determine project root. If cwd is packages/server, go up two levels.
    const projectRoot = process.cwd().endsWith('server') ? 
      path.resolve(process.cwd(), '../../') : 
      process.cwd();
      
    const cliScript = path.resolve(projectRoot, 'packages/cli/src/index.ts');

    const child = spawn('npx', ['tsx', cliScript, `/${skillName}`, ...cliArgs.slice(1)], {
      cwd: projectRoot,
      shell: true
    });

    child.stdout.on('data', (data) => {
      const text = data.toString();
      // Extremely basic heuristic to convert CLI text to SSE events
      // For a real implementation, the CLI should output structured JSON
      this.emitEvent(runId, {
        type: 'reasoning',
        payload: text
      });
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      this.emitEvent(runId, {
        type: 'error',
        payload: { message: text }
      });
    });

    child.on('close', (code) => {
      this.emitEvent(runId, {
        type: 'complete',
        payload: { exitCode: code }
      });
      // We keep the log around for late joiners, but we might want to clean up emitters
      setTimeout(() => {
        this.activeRuns.delete(runId);
      }, 60000);
    });

    return emitter;
  }

  getEmitter(runId: string): EventEmitter | undefined {
    return this.activeRuns.get(runId);
  }

  getLog(runId: string): RunEvent[] {
    return this.runLogs.get(runId) || [];
  }

  private emitEvent(runId: string, event: RunEvent) {
    const log = this.runLogs.get(runId);
    if (log) log.push(event);
    
    const emitter = this.activeRuns.get(runId);
    if (emitter) {
      emitter.emit('event', event);
    }
  }

  respondToApproval(runId: string, decision: 'approve' | 'deny') {
    // In a real implementation, this would send input to the child process's stdin
    // For now, we'll just mock it
    this.emitEvent(runId, {
      type: 'reasoning',
      payload: `Approval decision received: ${decision}`
    });
  }
}

export const globalSkillRunner = new SkillRunner();
