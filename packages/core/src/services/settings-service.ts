/**
 * Settings service for frontend-ready settings information
 * Provides DTO-compatible data without console output
 */

import path from "node:path";
import { ConfigManager } from "../config.js";
import { SafetyModeManager } from "../safety/mode-manager.js";
import { DeployManager } from "../deploy/manager.js";
import { normalizeFreezeState } from "../deploy/freeze-state.js";
import { shortHash } from "../utils.js";
import type { Contracts } from "@dstack/shared";
import type { DStackConfig } from "@dstack/shared";

export interface ServiceOptions {
  projectRoot: string;
  allowSecrets?: boolean;
  allowAbsolutePaths?: boolean;
}

export class SettingsService {
  constructor(private readonly options: ServiceOptions) {}

  /**
   * Get complete settings including all subsystem states
   */
  async getSettings(): Promise<Contracts.Settings> {
    const config = await ConfigManager.load({
      projectRoot: this.options.projectRoot,
      allowSecrets: this.options.allowSecrets ?? false
    });

    const safetyModeManager = new SafetyModeManager({ dstackDir: config.dstackDir });
    const deployManager = new DeployManager(config);

    const safetyMode = await safetyModeManager.read();
    const deployState = await deployManager.readState();
    const freezeState = normalizeFreezeState(deployState);

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

  /**
   * Update settings
   */
  async updateSettings(): Promise<Contracts.Settings> {
    // TODO: Implement settings update
    throw new Error("Settings update not yet implemented");
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
