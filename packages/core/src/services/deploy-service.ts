/**
 * Deploy service for frontend-ready deploy information
 * Provides DTO-compatible data without console output
 */

import path from "node:path";
import { ConfigManager } from "../config.js";
import { DeployManager } from "../deploy/manager.js";
import { DeployStore, type DeployRunMetadata } from "../deploy/store.js";
import { normalizeFreezeState } from "../deploy/freeze-state.js";
import { shortHash, nowIso } from "../utils.js";
import type { Contracts } from "@dstack/shared";

export interface ServiceOptions {
  projectRoot: string;
  allowSecrets?: boolean;
  allowAbsolutePaths?: boolean;
}

export class DeployService {
  private readonly deployStore: DeployStore;

  constructor(private readonly options: ServiceOptions) {
    this.deployStore = new DeployStore({
      dstackDir: path.join(options.projectRoot, ".dstack"),
      projectRoot: options.projectRoot
    });
  }

  /**
   * Get deploy configuration
   */
  async getDeployConfig(): Promise<Contracts.DeployConfig | null> {
    const config = await ConfigManager.load({
      projectRoot: this.options.projectRoot,
      allowSecrets: this.options.allowSecrets ?? false
    });

    const deployManager = new DeployManager(config);
    const deployConfig = await deployManager.getConfig();
    return deployConfig as Contracts.DeployConfig | null;
  }

  /**
   * Get deploy runs
   */
  async getDeployRuns(): Promise<Contracts.DeployRun[]> {
    const runs = await this.deployStore.listRuns();
    return runs.map(this.runToContract);
  }

  /**
   * Get deploy run by ID
   */
  async getDeployRun(runId: string): Promise<Contracts.DeployRun | null> {
    const run = await this.deployStore.getRun(runId);
    return run ? this.runToContract(run) : null;
  }

  /**
   * Get freeze state
   */
  async getFreezeState(): Promise<Contracts.FreezeState> {
    const config = await ConfigManager.load({
      projectRoot: this.options.projectRoot,
      allowSecrets: this.options.allowSecrets ?? false
    });

    const deployManager = new DeployManager(config);
    const deployState = await deployManager.readState();
    
    return normalizeFreezeState(deployState);
  }

  /**
   * Create deploy run
   */
  async createDeployRun(config?: {
    type: "full" | "canary" | "dry-run";
    reason?: string;
  }): Promise<Contracts.DeployRun> {
    const deployConfig = await this.getDeployConfig();
    if (!deployConfig) {
      throw new Error("Deploy configuration not available");
    }

    const run = await this.deployStore.createRun(
      config?.type || "dry-run",
      deployConfig,
      config?.reason
    );

    return this.runToContract(run);
  }

  private runToContract(run: DeployRunMetadata): Contracts.DeployRun {
    const isDryRun = run.type === "dry-run";
    const mappedStatus = run.status === "success" ? "complete" : run.status === "failure" ? "failed" : run.status === "rolled_back" ? "blocked" : run.status === "pending" ? "pending" : run.status === "running" ? "running" : "blocked";
    
    return {
      id: run.id,
      projectId: "unknown", // TODO: Get from project config
      environment: "production", // TODO: Get from config
      runType: run.type,
      status: mappedStatus as Contracts.DeployRun["status"],
      startedAt: run.startedAt || nowIso(),
      completedAt: run.completedAt || null,
      deployCommand: "deploy", // TODO: Get from config
      commandHash: shortHash(run.id, 16),
      gitHead: "unknown", // TODO: Get from git
      gitBranch: "main", // TODO: Get from git
      approvalRequired: run.approvalRequired,
      approvalGranted: !!run.approvedBy,
      blockers: [], // TODO: Calculate from dependencies
      verdict: mappedStatus === "complete" ? "PASS" : mappedStatus === "failed" ? "FAIL" : "IN_PROGRESS",
      healthCheckVerdict: "PASS", // TODO: Calculate from health checks
      healthChecks: [], // TODO: Convert health check format
      rollbackRequired: run.rollbackRequired,
      rollbackCommand: null,
      rollbackExecuted: false,
      frozenState: {
        frozen: false,
        scope: "deploy",
        reason: null
      },
      stdout: run.logs.join("\n"),
      stderr: run.error || "",
      dryRun: isDryRun,
      approvalHashProvided: null,
      rollbackResult: null
    };
  }
}
