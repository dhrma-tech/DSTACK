/**
 * Skill service for frontend-ready skill information
 * Provides DTO-compatible data without console output
 */

import { ConfigManager } from "../config.js";
import type { Contracts } from "@dstack/shared";

export interface ServiceOptions {
  projectRoot: string;
  allowSecrets?: boolean;
  allowAbsolutePaths?: boolean;
}

export class SkillService {
  constructor(private readonly options: ServiceOptions) {}

  /**
   * Get available skills
   */
  async getAvailableSkills(): Promise<Contracts.Skill[]> {
    // TODO: Implement skill discovery
    return [];
  }

  /**
   * Get skill manifest summary
   */
  async getSkillManifest(): Promise<Contracts.SkillManifestSummary | null> {
    // TODO: Implement skill manifest loading
    return null;
  }

  /**
   * Create skill run request
   */
  async createRunRequest(skillName: string, input?: unknown): Promise<Contracts.SkillRunRequest> {
    const config = await ConfigManager.load({
      projectRoot: this.options.projectRoot,
      allowSecrets: this.options.allowSecrets ?? false
    });

    return {
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
  }

  /**
   * Get skill run history
   */
  async getSkillRuns(): Promise<Contracts.SkillRun[]> {
    // TODO: Implement skill run history from store
    return [];
  }

  /**
   * Get skill run by ID
   */
  async getSkillRun(): Promise<Contracts.SkillRun | null> {
    // TODO: Implement skill run retrieval from store
    return null;
  }

  /**
   * Execute skill
   */
  async executeSkill(): Promise<Contracts.SkillRunResult> {
    // TODO: Implement skill execution via SkillExecutor
    throw new Error("Skill execution not yet implemented");
  }
}
