/**
 * Run service for frontend-ready run information
 * Provides DTO-compatible data without console output
 */

import path from "node:path";
import { ConfigManager } from "../config.js";
import { RunStore, type RunRecord } from "../runs/store.js";
import type { Contracts } from "@dstack/shared";

export interface ServiceOptions {
  projectRoot: string;
  allowSecrets?: boolean;
  allowAbsolutePaths?: boolean;
}

export class RunService {
  private readonly runStore: RunStore;

  constructor(private readonly options: ServiceOptions) {
    this.runStore = new RunStore({ dstackDir: path.join(options.projectRoot, ".dstack") });
  }

  /**
   * Get skill run history
   */
  async getSkillRuns(skillName?: string, limit = 10): Promise<Contracts.SkillRun[]> {
    const records = skillName 
      ? await this.runStore.listRunsBySkill(skillName, limit)
      : await this.runStore.listRuns(limit);
    
    return records.map(this.recordToContract);
  }

  /**
   * Get skill run by ID
   */
  async getSkillRun(runId: string): Promise<Contracts.SkillRun | null> {
    const record = await this.runStore.getRun(runId);
    return record ? this.recordToContract(record) : null;
  }

  /**
   * Create skill run request
   */
  async createRunRequest(skillName: string, input?: unknown): Promise<Contracts.SkillRunRequest> {
    const config = await ConfigManager.load({
      projectRoot: this.options.projectRoot,
      allowSecrets: this.options.allowSecrets ?? false
    });

    const request: Contracts.SkillRunRequest = {
      skillName,
      command: "run", // Default command
      inputs: (input || {}) as Record<string, Contracts.JsonValue>,
      flags: {
        force: false,
        dryRun: false,
        noStream: false,
        allowSecrets: this.options.allowSecrets ?? false
      },
      providerOverride: config.provider,
      modelOverride: config.defaultModel,
      requestSource: "api" as const,
      actor: "dstack"
    };

    // Create run record in store
    await this.runStore.createRun(request);
    
    return request;
  }

  /**
   * Execute skill
   */
  async executeSkill(request: Contracts.SkillRunRequest): Promise<Contracts.SkillRunResult> {
    // Get the run record
    const runs = await this.runStore.listRunsBySkill(request.skillName, 1);
    const run = runs[0];
    
    if (!run) {
      throw new Error(`Run not found for skill: ${request.skillName}`);
    }

    // Update run status to running
    await this.runStore.updateRun(run.id, {
      status: "running",
      startedAt: new Date().toISOString()
    });

    // Handle fake mode execution
    if (request.providerOverride === "fake") {
      return await this.executeFakeSkill(run.id, request);
    }

    // TODO: Implement real skill execution via SkillExecutor
    throw new Error("Real skill execution not yet implemented");
  }

  /**
   * Execute skill in fake mode
   */
  private async executeFakeSkill(runId: string, request: Contracts.SkillRunRequest): Promise<Contracts.SkillRunResult> {
    // Simulate skill execution with fake results
    const result: Contracts.SkillRunResult = {
      runId,
      skillName: request.skillName,
      status: "complete",
      verdict: "PASS",
      output: {
        message: `Fake execution of ${request.skillName} completed`,
        inputs: request.inputs,
        fake: true
      },
      nextSkill: "", // Empty string instead of null to match test expectations
      artifact: null,
      runtimeStatus: {
        safetyMode: "test",
        deployFrozen: false
      },
      blockers: [],
      warnings: [],
      toolCalls: [],
      provider: "fake",
      model: request.modelOverride || "fake-model"
    };

    // Update run with completion status and result
    await this.runStore.updateRun(runId, {
      status: "complete",
      completedAt: new Date().toISOString(),
      result
    });

    return result;
  }

  /**
   * Update run record
   */
  async updateRunRecord(runId: string, updates: { request?: Contracts.SkillRunRequest }): Promise<void> {
    if (updates.request) {
      await this.runStore.updateRun(runId, { 
        request: updates.request
      });
    }
  }

  /**
   * Clear all runs
   */
  async clearRuns(): Promise<void> {
    await this.runStore.clear();
  }

  private recordToContract(record: RunRecord): Contracts.SkillRun & Partial<Contracts.SkillRunResult> {
    const base = {
      id: record.id,
      projectId: "unknown", // TODO: Get from project config
      skillName: record.skillName,
      command: record.command,
      status: record.status,
      requestedAt: record.requestedAt,
      startedAt: record.startedAt || null,
      completedAt: record.completedAt || null,
      request: record.request,
      provider: record.provider,
      model: record.model,
      fakeMode: record.fakeMode,
      dryRun: record.dryRun,
      interactive: false, // TODO: Determine from request
      warnings: record.warnings,
      error: record.error ? {
        code: "UNKNOWN_ERROR",
        message: record.error,
        details: null
      } : null,
      logPathRelative: record.logPath || null,
      artifactId: record.artifactIds[0] || null
    };

    // If result exists, include it in the result field
    if (record.result) {
      return {
        ...base,
        result: record.result
      };
    }

    return base;
  }
}
