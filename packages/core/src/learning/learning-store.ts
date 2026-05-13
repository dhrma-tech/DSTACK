
import path from 'node:path';
import { exists, readJsonFile, atomicWrite, nowIso } from '../utils.js';

export interface LearningEntry {
  id: string;
  skillName: string;
  pattern: string; // e.g. "Always use 'export default' for components"
  context: string; // e.g. "React component generation"
  sourceRunId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export class LearningStore {
  private learningPath: string;

  constructor(projectRoot: string) {
    this.learningPath = path.join(projectRoot, '.dstack', 'learnings.json');
  }

  async getLearnings(): Promise<LearningEntry[]> {
    if (!(await exists(this.learningPath))) {
      return [];
    }
    return readJsonFile<LearningEntry[]>(this.learningPath);
  }

  async addLearning(entry: Omit<LearningEntry, 'id' | 'createdAt' | 'status'>): Promise<LearningEntry> {
    const learnings = await this.getLearnings();
    const newEntry: LearningEntry = {
      ...entry,
      id: `learn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      status: 'pending',
      createdAt: nowIso()
    };
    learnings.push(newEntry);
    await atomicWrite(this.learningPath, JSON.stringify(learnings, null, 2));
    return newEntry;
  }

  async updateStatus(id: string, status: 'approved' | 'rejected'): Promise<boolean> {
    const learnings = await this.getLearnings();
    const entry = learnings.find(l => l.id === id);
    if (!entry) return false;
    entry.status = status;
    await atomicWrite(this.learningPath, JSON.stringify(learnings, null, 2));
    return true;
  }

  async getApprovedForSkill(skillName: string): Promise<string[]> {
    const learnings = await this.getLearnings();
    return learnings
      .filter(l => l.status === 'approved' && (l.skillName === skillName || l.skillName === '*'))
      .map(l => l.pattern);
  }
}
