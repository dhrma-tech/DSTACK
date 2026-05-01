/**
 * Benchmark service for frontend-ready benchmark information
 * Provides DTO-compatible data without console output
 */

import path from "node:path";
import { BenchmarkStore, type BenchmarkRunMetadata } from "../benchmark/store.js";
import type { Contracts } from "@dstack/shared";

export interface ServiceOptions {
  projectRoot: string;
  allowSecrets?: boolean;
  allowAbsolutePaths?: boolean;
}

export class BenchmarkService {
  private readonly benchmarkStore: BenchmarkStore;

  constructor(private readonly options: ServiceOptions) {
    this.benchmarkStore = new BenchmarkStore({
      dstackDir: path.join(options.projectRoot, ".dstack"),
      projectRoot: options.projectRoot
    });
  }

  /**
   * Get benchmark runs
   */
  async listBenchmarkRuns(limit = 10): Promise<Contracts.BenchmarkRun[]> {
    const runs = await this.benchmarkStore.listRuns(limit);
    return runs.map((run: BenchmarkRunMetadata) => this.runToContract(run));
  }

  /**
   * Get benchmark run by ID
   */
  async getBenchmarkRun(runId: string): Promise<Contracts.BenchmarkRun | null> {
    const run = await this.benchmarkStore.getRun(runId);
    return run ? this.runToContract(run) : null;
  }

  /**
   * Create benchmark run
   */
  async createBenchmarkRun(config: {
    type: "single-model" | "multi-model";
    models: string[];
    prompts: string[];
    iterations?: number;
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
  }): Promise<Contracts.BenchmarkRun> {
    const run = await this.benchmarkStore.createRun(config);
    return this.runToContract(run);
  }

  /**
   * Get benchmark results
   */
  async getBenchmarkResults(): Promise<unknown | null> {
    // TODO: Implement benchmark results retrieval
    return null;
  }

  private runToContract(run: BenchmarkRunMetadata): Contracts.BenchmarkRun {
    return {
      id: run.id,
      projectId: "unknown", // TODO: Get from project config
      suiteName: "benchmark-suite", // TODO: Get from config
      runType: run.type,
      providerName: "gemini", // TODO: Get from config
      liveMode: true, // TODO: Get from config
      dryRun: false, // TODO: Get from config
      runAt: run.requestedAt,
      completedAt: run.completedAt || null,
      durationMs: run.results.averageResponseTime || 0,
      promptCount: run.prompts.length,
      modelsCompared: run.models,
      estimate: {
        estimatedInputTokens: run.results.averageTokensUsed || 0,
        estimatedOutputTokens: run.results.averageTokensUsed || 0,
        estimatedTokens: run.results.averageTokensUsed || 0,
        estimatedCostUsd: run.results.totalCost || null,
        pricingDisclaimer: "Estimates only"
      },
      modelResults: run.results.modelResults.map(mr => {
        const successfulResults = mr.results.filter(r => r.success);
        const totalTokens = mr.results.reduce((sum, r) => sum + r.tokensUsed, 0);
        const avgLatency = successfulResults.length > 0 
          ? successfulResults.reduce((sum, r) => sum + r.responseTime, 0) / successfulResults.length 
          : 0;
        
        return {
          model: mr.model,
          status: mr.results.every(r => r.success) ? "complete" : mr.results.some(r => r.success) ? "complete" : "failed",
          avgQualityScore: null, // TODO: Calculate from results
          avgLatencyMs: avgLatency || null,
          passRate: (successfulResults.length / mr.results.length) || 0,
          totalInputTokens: totalTokens / 2, // Estimate split
          totalOutputTokens: totalTokens / 2, // Estimate split
          totalTokensUsed: totalTokens,
          estimatedCostUsd: mr.results.reduce((sum, r) => sum + (r.cost || 0), 0) || null,
          qualityEvaluation: "not_evaluated_offline",
          promptResultsCount: mr.results.length,
          pricingDisclaimer: "Estimates only",
          warnings: [],
          error: mr.results.some(r => !r.success && r.error) ? "Some prompts failed" : null
        };
      }),
      summary: {
        bestQualityModel: run.models[0] || null,
        bestLatencyModel: run.models[0] || null,
        bestValueModel: run.models[0] || null,
        avgLatencyMs: run.results.averageResponseTime || null,
        avgQualityScore: null, // TODO: Calculate from results
        warnings: []
      },
      warnings: []
    };
  }
}
