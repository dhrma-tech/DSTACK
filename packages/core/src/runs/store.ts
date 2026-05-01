/**
 * RunStore - Persistent storage for skill run records
 * Stores run data under .dstack/runs/ with index.json for fast lookup
 */

import path from "node:path";
import fs from "node:fs/promises";
import { ensureDir, exists, readJsonFile, shortHash, nowIso, atomicWrite } from "../utils.js";
import type { Contracts } from "@dstack/shared";

export interface RunStoreOptions {
  dstackDir: string;
}

export interface RunRecord {
  id: string;
  skillName: string;
  command: string;
  status: Contracts.SkillRunStatus;
  requestedAt: string;
  startedAt?: string;
  completedAt?: string;
  request: Contracts.SkillRunRequest;
  result?: Contracts.SkillRunResult;
  artifactIds: string[];
  logPath?: string;
  provider: "gemini" | "fake";
  model: string;
  fakeMode: boolean;
  dryRun: boolean;
  warnings: string[];
  error?: string;
}

export interface RunIndex {
  runs: RunRecord[];
  lastUpdated: string;
}

export class RunStore {
  private readonly runsDir: string;
  private readonly indexPath: string;

  constructor(private readonly options: RunStoreOptions) {
    this.runsDir = path.join(options.dstackDir, "runs");
    this.indexPath = path.join(this.runsDir, "index.json");
  }

  /**
   * Initialize the store directory and index
   */
  async init(): Promise<void> {
    await ensureDir(this.runsDir);
    if (!(await exists(this.indexPath))) {
      const emptyIndex: RunIndex = {
        runs: [],
        lastUpdated: nowIso()
      };
      await fs.writeFile(this.indexPath, JSON.stringify(emptyIndex, null, 2));
    }
  }

  /**
   * Create a new run record
   */
  async createRun(request: Contracts.SkillRunRequest): Promise<RunRecord> {
    await this.init();

    const now = nowIso();
    const runId = shortHash(`${request.skillName}-${now}`, 12);
    const run: RunRecord = {
      id: runId,
      skillName: request.skillName,
      command: request.command,
      status: "queued",
      requestedAt: now,
      request,
      artifactIds: [],
      provider: request.providerOverride || "gemini",
      model: request.modelOverride || "unknown",
      fakeMode: request.providerOverride === "fake",
      dryRun: request.flags.dryRun,
      warnings: []
    };

    const index = await this.readIndex();
    index.runs.unshift(run); // Add to beginning for newest-first order
    index.lastUpdated = nowIso();
    await this.writeIndex(index);

    return run;
  }

  /**
   * Update run status and optional result
   */
  async updateRun(runId: string, updates: Partial<Pick<RunRecord, "status" | "startedAt" | "completedAt" | "result" | "artifactIds" | "logPath" | "warnings" | "error" | "request">>): Promise<RunRecord | null> {
    const index = await this.readIndex();
    const runIndex = index.runs.findIndex(r => r.id === runId);
    
    if (runIndex === -1) {
      return null;
    }

    const run = index.runs[runIndex];
    if (run) {
      Object.assign(run, updates);
      index.lastUpdated = nowIso();
      await this.writeIndex(index);
    }

    return run || null;
  }

  /**
   * Get run by ID
   */
  async getRun(runId: string): Promise<RunRecord | null> {
    const index = await this.readIndex();
    return index.runs.find(r => r.id === runId) || null;
  }

  /**
   * List runs, newest first
   */
  async listRuns(limit = 100): Promise<RunRecord[]> {
    const index = await this.readIndex();
    return index.runs.slice(0, limit);
  }

  /**
   * List runs by skill name, newest first
   */
  async listRunsBySkill(skillName: string, limit = 50): Promise<RunRecord[]> {
    const index = await this.readIndex();
    return index.runs
      .filter(r => r.skillName === skillName)
      .slice(0, limit);
  }

  /**
   * Get run statistics
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<Contracts.SkillRunStatus, number>;
    bySkill: Record<string, number>;
    recent: number; // runs in last 24 hours
  }> {
    const index = await this.readIndex();
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const stats = {
      total: index.runs.length,
      byStatus: {} as Record<Contracts.SkillRunStatus, number>,
      bySkill: {} as Record<string, number>,
      recent: 0
    };

    // Initialize status counters
    const statuses: Contracts.SkillRunStatus[] = ["queued", "running", "complete", "error", "interrupted", "blocked"];
    for (const status of statuses) {
      stats.byStatus[status] = 0;
    }

    for (const run of index.runs) {
      stats.byStatus[run.status]++;
      stats.bySkill[run.skillName] = (stats.bySkill[run.skillName] || 0) + 1;
      if (new Date(run.requestedAt) > dayAgo) {
        stats.recent++;
      }
    }

    return stats;
  }

  /**
   * Clear all runs
   */
  async clear(): Promise<void> {
    const emptyIndex: RunIndex = {
      runs: [],
      lastUpdated: nowIso()
    };
    await this.writeIndex(emptyIndex);
  }

  /**
   * Clean up old runs (keep last N runs per skill)
   */
  async cleanup(keepPerSkill = 50): Promise<number> {
    const index = await this.readIndex();
    const originalLength = index.runs.length;

    // Group by skill and keep only the most recent N per skill
    const skillGroups = new Map<string, RunRecord[]>();
    for (const run of index.runs) {
      if (!skillGroups.has(run.skillName)) {
        skillGroups.set(run.skillName, []);
      }
      skillGroups.get(run.skillName)!.push(run);
    }

    const newRuns: RunRecord[] = [];
    for (const [, runs] of skillGroups) {
      // Sort by requestedAt descending and keep top N
      runs.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
      newRuns.push(...runs.slice(0, keepPerSkill));
    }

    // Sort all runs by requestedAt descending
    newRuns.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());

    index.runs = newRuns;
    index.lastUpdated = nowIso();
    await this.writeIndex(index);

    return originalLength - newRuns.length;
  }

  private async readIndex(): Promise<RunIndex> {
    try {
      if (!(await exists(this.indexPath))) {
        return { runs: [], lastUpdated: nowIso() };
      }
      const data = await readJsonFile<unknown>(this.indexPath);
      if (!this.isValidIndex(data)) {
        throw new Error("Invalid run index format");
      }
      return data;
    } catch (error) {
      console.error("Failed to read run index:", error);
      return { runs: [], lastUpdated: nowIso() };
    }
  }

  private async writeIndex(index: RunIndex): Promise<void> {
    await atomicWrite(this.indexPath, JSON.stringify(index, null, 2));
  }

  private isValidIndex(data: unknown): data is RunIndex {
    return (
      typeof data === "object" &&
      data !== null &&
      "runs" in data &&
      "lastUpdated" in data &&
      Array.isArray((data as Record<string, unknown>).runs) &&
      typeof (data as Record<string, unknown>).lastUpdated === "string"
    );
  }
}
