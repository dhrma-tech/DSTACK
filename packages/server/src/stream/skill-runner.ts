import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';

export interface RunEvent {
  type: 'reasoning' | 'tool-call' | 'tool-result' | 'approval-required' | 'artifact-saved' | 'complete' | 'error';
  payload?: any;
}

export class SkillRunner {
  private activeRuns = new Map<string, EventEmitter>();
  private childProcesses = new Map<string, import('child_process').ChildProcess>();
  private runLogs = new Map<string, RunEvent[]>();

  startRun(runId: string, skillName: string, args: Record<string, string> = {}) {
    const emitter = new EventEmitter();
    this.activeRuns.set(runId, emitter);
    this.runLogs.set(runId, []);

    // Push initial command event
    this.emitEvent(runId, {
      type: 'reasoning',
      text: `Starting skill: /${skillName}`
    });

    // Format CLI args
    const cliArgs = [`/${skillName}`, '--json-events'];
    for (const [key, value] of Object.entries(args)) {
      if (value !== undefined && value !== null) cliArgs.push(`--${key}=${value}`);
    }

    // Determine project root. If cwd is packages/server, go up two levels.
    const projectRoot = process.cwd().endsWith('server') ? 
      path.resolve(process.cwd(), '../../') : 
      process.cwd();
      
    const cliScript = path.resolve(projectRoot, 'packages/cli/src/index.ts');

    const child = spawn('npx', ['tsx', cliScript, ...cliArgs], {
      cwd: projectRoot,
      shell: true
    });
    this.childProcesses.set(runId, child);

    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          this.emitEvent(runId, event);
        } catch (e) {
          // Fallback if not JSON
          this.emitEvent(runId, {
            type: 'reasoning',
            text: line
          } as any);
        }
      }
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      this.emitEvent(runId, {
        type: 'error',
        message: text
      } as any);
    });

    child.on('close', (code) => {
      this.emitEvent(runId, {
        type: 'complete',
        status: code === 0 ? 'complete' : 'error',
        skillName
      } as any);
      // We keep the log around for late joiners, but we might want to clean up emitters
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
    const child = this.childProcesses.get(runId);
    if (child && child.stdin) {
      child.stdin.write(decision === 'approve' ? 'y\n' : 'n\n');
      this.emitEvent(runId, {
        type: 'reasoning',
        text: `Approval decision sent: ${decision}`
      } as any);
    }
  }
}

export const globalSkillRunner = new SkillRunner();
