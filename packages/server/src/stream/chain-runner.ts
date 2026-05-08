import { EventEmitter } from 'events';
import { globalSkillRunner } from './skill-runner';
import type { RunEvent } from './skill-runner';

export interface ChainRunState {
  id: string;
  chain: string[];
  currentSkillIndex: number;
  status: 'running' | 'complete' | 'error';
  emitter: EventEmitter;
}

export class ChainRunner {
  private activeChains = new Map<string, ChainRunState>();

  startChain(chain: string[], initialInputs: Record<string, string> = {}): string {
    const chainId = `chain-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const emitter = new EventEmitter();
    
    const state: ChainRunState = {
      id: chainId,
      chain,
      currentSkillIndex: 0,
      status: 'running',
      emitter
    };
    
    this.activeChains.set(chainId, state);
    
    // Start running the first skill asynchronously
    setImmediate(() => {
      this.runNextSkill(state, initialInputs);
    });
    
    return chainId;
  }

  getChain(chainId: string) {
    return this.activeChains.get(chainId);
  }

  private async runNextSkill(state: ChainRunState, inputs: Record<string, string>) {
    if (state.currentSkillIndex >= state.chain.length) {
      state.status = 'complete';
      state.emitter.emit('chain_complete', { status: 'complete' });
      return;
    }

    const currentSkillName = state.chain[state.currentSkillIndex];
    state.emitter.emit('skill_start', { skillName: currentSkillName, index: state.currentSkillIndex });

    const runId = `chain-step-${Date.now()}`;
    const skillEmitter = globalSkillRunner.startRun(runId, currentSkillName, inputs);

    // Pipe events to the chain emitter
    skillEmitter.on('event', (event: RunEvent) => {
      state.emitter.emit('skill_event', { skillName: currentSkillName, event });
    });

    // Wait for completion
    await new Promise<void>((resolve) => {
      const completionListener = (event: RunEvent) => {
        if (event.type === 'complete' || event.type === 'error') {
          skillEmitter.off('event', completionListener);
          if (event.type === 'error' || (event.type === 'complete' && event.status === 'error')) {
            state.status = 'error';
            state.emitter.emit('chain_complete', { status: 'error', failedSkill: currentSkillName });
            resolve();
          } else {
            // Success, go to next
            state.currentSkillIndex++;
            this.runNextSkill(state, inputs).then(resolve);
          }
        }
      };
      skillEmitter.on('event', completionListener);
    });
  }
}

export const globalChainRunner = new ChainRunner();
