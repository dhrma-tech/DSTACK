/**
 * Project service for frontend-ready project information
 * Provides DTO-compatible data without console output
 */

import path from "node:path";
import { ConfigManager } from "../config.js";
import { LearningStore } from "../memory/learning-store.js";
import { SafetyModeManager } from "../safety/mode-manager.js";
import { DeployService } from "./deploy-service.js";
import { shortHash } from "../utils.js";
import type { Contracts } from "@dstack/shared";
import type { DStackConfig } from "@dstack/shared";

export interface ServiceOptions {
  projectRoot: string;
  allowSecrets?: boolean;
  allowAbsolutePaths?: boolean;
}

export class ProjectService {
  constructor(private readonly options: ServiceOptions) {}

  /**
   * Get current project information
   */
  async getCurrentProject(): Promise<Contracts.Project> {
    const config = await ConfigManager.load({
      projectRoot: this.options.projectRoot,
      allowSecrets: this.options.allowSecrets ?? false
    });

    const learningStore = new LearningStore({ dstackDir: config.dstackDir });
    const safetyManager = new SafetyModeManager({ dstackDir: config.dstackDir });
    const deployService = new DeployService({
      projectRoot: this.options.projectRoot,
      allowSecrets: this.options.allowSecrets ?? false,
      allowAbsolutePaths: this.options.allowAbsolutePaths ?? false
    });

    // Get learning count
    const learningEntries = await learningStore.all();

    // Get safety mode state
    const safetyMode = await safetyManager.read();

    // Get freeze state from DeployService
    const freezeState = await deployService.getFreezeState();

    // Generate project ID from root path
    const projectId = shortHash(path.resolve(this.options.projectRoot), 12);

    const project: Contracts.Project = {
      id: projectId,
      name: path.basename(this.options.projectRoot),
      rootDisplayPath: path.relative(process.cwd(), this.options.projectRoot),
      dstackDirRelative: path.relative(this.options.projectRoot, config.dstackDir),
      workflowStage: "phase1", // TODO: Determine from current state
      updatedAt: new Date().toISOString(),
      provider: this.mapProviderConfig(config),
      safetyMode,
      freezeState,
      artifactCounts: {
        total: 0, // TODO: Implement artifact store
        latest: 0,
        stale: 0
      },
      learningCount: learningEntries.length,
      tasteProfileUpdatedAt: null // TODO: Implement taste profile
    };

    // Add optional properties only when they should exist
    if (this.options.allowAbsolutePaths) {
      project.rootAbsolutePath = path.resolve(this.options.projectRoot);
    }

    return project;
  }

  /**
   * Get project configuration
   */
  async getProjectConfig(): Promise<Contracts.ProjectConfig> {
    const config = await ConfigManager.load({
      projectRoot: this.options.projectRoot,
      allowSecrets: this.options.allowSecrets ?? false
    });

    const deployService = new DeployService({
      projectRoot: this.options.projectRoot,
      allowSecrets: this.options.allowSecrets ?? false,
      allowAbsolutePaths: this.options.allowAbsolutePaths ?? false
    });
    const deployConfig = await deployService.getDeployConfig();

    const projectId = shortHash(path.resolve(this.options.projectRoot), 12);

    return {
      projectId,
      dstackVersion: "0.1.0", // TODO: Get from package.json
      providerName: config.provider,
      defaultModel: config.defaultModel,
      proModel: config.proModel,
      maxTokens: config.maxTokens,
      requestTimeoutMs: config.requestTimeoutMs,
      maxRetries: config.maxRetries,
      retryBaseDelayMs: config.retryBaseDelayMs,
      maxToolCalls: config.maxToolCalls,
      browserHeadless: config.browserHeadless,
      allowSecrets: config.allowSecrets,
      requireApprovalForFileOverwrite: config.requireApprovalForFileOverwrite,
      requireApprovalForGitCommit: config.requireApprovalForGitCommit,
      requireApprovalForShellCommands: config.requireApprovalForShellCommands,
      skillOverrides: config.skillOverrides,
      deployConfig: deployConfig as Contracts.DeployConfig | null,
      apiServer: {
        host: "127.0.0.1",
        port: 4570,
        tokenFileRelative: path.relative(config.dstackDir, path.join(config.dstackDir, "api", "token")),
        bindLocalOnly: true
      }
    };
  }

  /**
   * Get complete settings including all subsystem states
   */
  async getSettings(): Promise<Contracts.Settings> {
    const config = await ConfigManager.load({
      projectRoot: this.options.projectRoot,
      allowSecrets: this.options.allowSecrets ?? false
    });

    const safetyModeManager = new SafetyModeManager({ dstackDir: config.dstackDir });
    const deployService = new DeployService({
      projectRoot: this.options.projectRoot,
      allowSecrets: this.options.allowSecrets ?? false,
      allowAbsolutePaths: this.options.allowAbsolutePaths ?? false
    });

    const safetyMode = await safetyModeManager.read();
    const freezeState = await deployService.getFreezeState();

    const projectId = shortHash(path.resolve(this.options.projectRoot), 12);

    const settings: Contracts.Settings = {
      projectId,
      projectRootDisplayPath: path.relative(process.cwd(), this.options.projectRoot),
      dstackDirRelative: path.relative(this.options.projectRoot, config.dstackDir),
      allowAbsolutePaths: this.options.allowAbsolutePaths ?? false,
      provider: this.mapProviderConfig(config),
      model: this.mapModelConfig(config),
      browserHeadless: config.browserHeadless,
      allowSecrets: config.allowSecrets,
      permissionDefaults: {
        requireApprovalForFileOverwrite: config.requireApprovalForFileOverwrite,
        requireApprovalForGitCommit: config.requireApprovalForGitCommit,
        requireApprovalForShellCommands: config.requireApprovalForShellCommands
      },
      safetyMode,
      freezeState,
      apiServer: {
        host: "127.0.0.1",
        port: 4570,
        tokenFileRelative: path.relative(config.dstackDir, path.join(config.dstackDir, "api", "token")),
        bindLocalOnly: true
      }
    };

    // Add optional properties only when they should exist
    if (this.options.allowAbsolutePaths) {
      settings.projectRootAbsolutePath = path.resolve(this.options.projectRoot);
    }

    return settings;
  }

  private mapProviderConfig(config: DStackConfig): Contracts.ProviderConfig {
    return {
      current: config.provider,
      available: ["gemini", "fake"],
      geminiConfigured: !!config.geminiApiKey,
      fakeAvailable: true,
      allowLive: config.provider === "gemini",
      defaultProvider: config.provider
    };
  }

  private mapModelConfig(config: DStackConfig): Contracts.ModelConfig {
    return {
      defaultModel: config.defaultModel,
      proModel: config.proModel,
      maxTokens: config.maxTokens,
      requestTimeoutMs: config.requestTimeoutMs,
      maxRetries: config.maxRetries,
      retryBaseDelayMs: config.retryBaseDelayMs,
      maxToolCalls: config.maxToolCalls,
      skillOverrides: config.skillOverrides
    };
  }
}
