/**
 * BenchmarkStore - Storage and indexing for benchmark runs
 * Persists BenchmarkRun history and dry-run data
 */

import path from "node:path";
import fs from "node:fs/promises";
import { ensureDir, exists, shortHash, nowIso } from "../utils.js";

export interface BenchmarkStoreOptions {
  dstackDir: string;
  projectRoot: string;
}

export interface BenchmarkRunMetadata {
  id: string;
  type: "single-model" | "multi-model";
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  requestedAt: string;
  startedAt?: string;
  completedAt?: string;
  models: string[];
  prompts: string[];
  config: {
    iterations: number;
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
  };
  results: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    averageResponseTime: number;
    averageTokensUsed: number;
    totalCost?: number;
    modelResults: Array<{
      model: string;
      prompts: string[];
      results: Array<{
        prompt: string;
        response?: string;
        responseTime: number;
        tokensUsed: number;
        cost?: number;
        success: boolean;
        error?: string;
      }>;
    }>;
  };
  metadata?: Record<string, unknown>;
}

export class BenchmarkStore {
  private readonly benchmarkDir: string;
  private readonly runsPath: string;

  constructor(private readonly options: BenchmarkStoreOptions) {
    this.benchmarkDir = path.join(options.dstackDir, "benchmark");
    this.runsPath = path.join(this.benchmarkDir, "runs.json");
  }

  /**
   * Initialize the benchmark store directories and index files
   */
  async init(): Promise<void> {
    await ensureDir(this.benchmarkDir);
    
    if (!(await exists(this.runsPath))) {
      await fs.writeFile(this.runsPath, JSON.stringify({ runs: [], lastUpdated: nowIso() }, null, 2));
    }
  }

  /**
   * Create a new benchmark run
   */
  async createRun(config: {
    type: "single-model" | "multi-model";
    models: string[];
    prompts: string[];
    iterations?: number;
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
  }): Promise<BenchmarkRunMetadata> {
    await this.init();

    const run: BenchmarkRunMetadata = {
      id: shortHash(`benchmark-${config.type}-${nowIso()}`, 12),
      type: config.type,
      status: "pending",
      requestedAt: nowIso(),
      models: config.models,
      prompts: config.prompts,
      config: {
        iterations: config.iterations || 1,
        ...(config.temperature && { temperature: config.temperature }),
        ...(config.maxTokens && { maxTokens: config.maxTokens }),
        ...(config.timeoutMs && { timeoutMs: config.timeoutMs })
      },
      results: {
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
        averageResponseTime: 0,
        averageTokensUsed: 0,
        modelResults: config.models.map(model => ({
          model,
          prompts: config.prompts,
          results: []
        }))
      }
    };

    const index = await this.readRunsIndex();
    index.runs.unshift(run); // Add to beginning for newest-first order
    index.lastUpdated = nowIso();
    await this.writeRunsIndex(index);

    return run;
  }

  /**
   * Update benchmark run status and results
   */
  async updateRun(runId: string, updates: Partial<BenchmarkRunMetadata>): Promise<BenchmarkRunMetadata | null> {
    const index = await this.readRunsIndex();
    const runIndex = index.runs.findIndex(r => r.id === runId);

    const run = index.runs[runIndex];
    if (run) {
      Object.assign(run, updates);
      index.lastUpdated = nowIso();
      await this.writeRunsIndex(index);
    }

    return run || null;
  }

  /**
   * Add result to a benchmark run
   */
  async addResult(runId: string, model: string, prompt: string, result: {
    response?: string;
    responseTime: number;
    tokensUsed: number;
    cost?: number;
    success: boolean;
    error?: string;
  }): Promise<BenchmarkRunMetadata | null> {
    const run = await this.getRun(runId);
    if (!run) {
      return null;
    }

    // Find or create model results
    let modelResult = run.results.modelResults.find(mr => mr.model === model);
    if (!modelResult) {
      modelResult = {
        model,
        prompts: run.prompts,
        results: []
      };
      run.results.modelResults.push(modelResult);
    }

    // Add the result
    modelResult.results.push({
      prompt,
      ...result
    });

    // Update aggregates
    run.results.totalRuns++;
    if (result.success) {
      run.results.successfulRuns++;
    } else {
      run.results.failedRuns++;
    }

    // Update averages
    const allResults = run.results.modelResults.flatMap(mr => mr.results);
    run.results.averageResponseTime = allResults.reduce((sum, r) => sum + r.responseTime, 0) / allResults.length;
    run.results.averageTokensUsed = allResults.reduce((sum, r) => sum + r.tokensUsed, 0) / allResults.length;
    run.results.totalCost = allResults.reduce((sum, r) => sum + (r.cost || 0), 0);

    return await this.updateRun(runId, { results: run.results });
  }

  /**
   * Get benchmark run by ID
   */
  async getRun(runId: string): Promise<BenchmarkRunMetadata | null> {
    const index = await this.readRunsIndex();
    return index.runs.find(r => r.id === runId) || null;
  }

  /**
   * List benchmark runs, newest first
   */
  async listRuns(limit = 100): Promise<BenchmarkRunMetadata[]> {
    const index = await this.readRunsIndex();
    return index.runs.slice(0, limit);
  }

  /**
   * Get latest benchmark run
   */
  async getLatestRun(): Promise<BenchmarkRunMetadata | null> {
    const runs = await this.listRuns(1);
    return runs[0] || null;
  }

  /**
   * List runs by type
   */
  async listRunsByType(type: "single-model" | "multi-model", limit = 50): Promise<BenchmarkRunMetadata[]> {
    const index = await this.readRunsIndex();
    const typeRuns = index.runs.filter(r => r.type === type);
    return typeRuns.slice(0, limit);
  }

  /**
   * List runs by model
   */
  async listRunsByModel(model: string, limit = 50): Promise<BenchmarkRunMetadata[]> {
    const index = await this.readRunsIndex();
    const modelRuns = index.runs.filter(r => r.models.includes(model));
    return modelRuns.slice(0, limit);
  }

  /**
   * Get benchmark statistics
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    byModel: Record<string, number>;
    recent: number; // runs in last 24 hours
    averageResponseTime: number;
    averageTokensUsed: number;
    totalCost: number;
  }> {
    const index = await this.readRunsIndex();
    // const now = new Date();

    const stats = {
      total: index.runs.length,
      byStatus: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      byModel: {} as Record<string, number>,
      recent: 0,
      averageResponseTime: 0,
      averageTokensUsed: 0,
      totalCost: 0
    };

    // Initialize counters
    const statuses = ["pending", "running", "completed", "failed", "cancelled"];
    for (const status of statuses) {
      stats.byStatus[status] = 0;
    }

    const allResults: Array<{ responseTime: number; tokensUsed: number; cost?: number }> = [];

    for (const run of index.runs) {
      stats.byStatus[run.status] = (stats.byStatus[run.status] || 0) + 1;
      stats.byType[run.type] = (stats.byType[run.type] || 0) + 1;
      
      for (const model of run.models) {
        stats.byModel[model] = (stats.byModel[model] || 0) + 1;
      }
      
      // Collect all results for averages
      for (const modelResult of run.results.modelResults) {
        for (const result of modelResult.results) {
          allResults.push({
            responseTime: result.responseTime,
            tokensUsed: result.tokensUsed,
            ...(result.cost && { cost: result.cost })
          });
        }
      }

      // Add run-level aggregates
      stats.totalCost += run.results.totalCost || 0;
    }

    // Calculate averages
    if (allResults.length > 0) {
      stats.averageResponseTime = allResults.reduce((sum, r) => sum + r.responseTime, 0) / allResults.length;
      stats.averageTokensUsed = allResults.reduce((sum, r) => sum + r.tokensUsed, 0) / allResults.length;
    }

    return stats;
  }

  /**
   * Cancel a benchmark run
   */
  async cancelRun(runId: string): Promise<BenchmarkRunMetadata | null> {
    return await this.updateRun(runId, { 
      status: "cancelled", 
      completedAt: nowIso() 
    });
  }

  /**
   * Clean up old benchmark runs (keep last N runs)
   */
  async cleanup(keepRuns = 100): Promise<number> {
    const index = await this.readRunsIndex();
    const originalLength = index.runs.length;

    index.runs = index.runs.slice(0, keepRuns);
    index.lastUpdated = nowIso();
    await this.writeRunsIndex(index);

    return originalLength - index.runs.length;
  }

  private async readRunsIndex(): Promise<{ runs: BenchmarkRunMetadata[]; lastUpdated: string }> {
    try {
      if (!(await exists(this.runsPath))) {
        return { runs: [], lastUpdated: nowIso() };
      }
      const data = await fs.readFile(this.runsPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return { runs: [], lastUpdated: nowIso() };
    }
  }

  private async writeRunsIndex(index: { runs: BenchmarkRunMetadata[]; lastUpdated: string }): Promise<void> {
    await fs.writeFile(this.runsPath, JSON.stringify(index, null, 2));
  }
}
