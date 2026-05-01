/**
 * DeployStore - Storage and indexing for deploy runs and approval state
 * Persists DeployRun history, approval-required artifacts, and rollback state
 */

import path from "node:path";
import fs from "node:fs/promises";
import { ensureDir, exists, shortHash, nowIso } from "../utils.js";
import type { Contracts } from "@dstack/shared";

export interface DeployStoreOptions {
  dstackDir: string;
  projectRoot: string;
}

export interface DeployRunMetadata {
  id: string;
  type: "full" | "canary" | "dry-run";
  status: "pending" | "running" | "success" | "failure" | "rolled_back";
  requestedAt: string;
  startedAt?: string;
  completedAt?: string;
  reason?: string;
  config: Contracts.DeployConfig;
  artifacts: string[]; // Artifact IDs deployed
  approvalRequired: boolean;
  approvedBy?: string;
  approvedAt?: string;
  rollbackRequired: boolean;
  rollbackReason?: string;
  healthChecks: {
    passed: number;
    failed: number;
    skipped: number;
  };
  logs: string[];
  error?: string;
}

export interface ApprovalState {
  artifactId: string;
  required: boolean;
  requestedAt: string;
  requestedBy: string;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: string;
  reason?: string;
}

export interface RollbackState {
  deployRunId: string;
  required: boolean;
  reason?: string;
  initiatedAt?: string;
  initiatedBy?: string;
  completed: boolean;
  completedAt?: string;
  success?: boolean;
}

export class DeployStore {
  private readonly deployDir: string;
  private readonly runsPath: string;
  private readonly approvalsPath: string;
  private readonly rollbacksPath: string;

  constructor(private readonly options: DeployStoreOptions) {
    this.deployDir = path.join(options.dstackDir, "deploy");
    this.runsPath = path.join(this.deployDir, "runs.json");
    this.approvalsPath = path.join(this.deployDir, "approvals.json");
    this.rollbacksPath = path.join(this.deployDir, "rollbacks.json");
  }

  /**
   * Initialize the deploy store directories and index files
   */
  async init(): Promise<void> {
    await ensureDir(this.deployDir);
    
    if (!(await exists(this.runsPath))) {
      await fs.writeFile(this.runsPath, JSON.stringify({ runs: [], lastUpdated: nowIso() }, null, 2));
    }
    
    if (!(await exists(this.approvalsPath))) {
      await fs.writeFile(this.approvalsPath, JSON.stringify({ approvals: [], lastUpdated: nowIso() }, null, 2));
    }
    
    if (!(await exists(this.rollbacksPath))) {
      await fs.writeFile(this.rollbacksPath, JSON.stringify({ rollbacks: [], lastUpdated: nowIso() }, null, 2));
    }
  }

  /**
   * Create a new deploy run
   */
  async createRun(type: "full" | "canary" | "dry-run", config: Contracts.DeployConfig, reason?: string): Promise<DeployRunMetadata> {
    await this.init();

    const run: DeployRunMetadata = {
      id: shortHash(`deploy-${type}-${nowIso()}`, 12),
      type,
      status: "pending",
      requestedAt: nowIso(),
      config,
      artifacts: [], // Will be populated during deployment
      approvalRequired: false, // TODO: Get from config when available
      rollbackRequired: false,
      healthChecks: {
        passed: 0,
        failed: 0,
        skipped: 0
      },
      logs: [],
      ...(reason && { reason })
    };

    const index = await this.readRunsIndex();
    index.runs.unshift(run); // Add to beginning for newest-first order
    index.lastUpdated = nowIso();
    await this.writeRunsIndex(index);

    return run;
  }

  /**
   * Update deploy run status and metadata
   */
  async updateRun(runId: string, updates: Partial<DeployRunMetadata>): Promise<DeployRunMetadata | null> {
    const index = await this.readRunsIndex();
    const runIndex = index.runs.findIndex(r => r.id === runId);
    
    if (runIndex === -1) {
      return null;
    }

    const run = index.runs[runIndex];
    if (run) {
      Object.assign(run, updates);
      index.lastUpdated = nowIso();
      await this.writeRunsIndex(index);
    }

    return run || null;
  }

  /**
   * Get deploy run by ID
   */
  async getRun(runId: string): Promise<DeployRunMetadata | null> {
    const index = await this.readRunsIndex();
    return index.runs.find(r => r.id === runId) || null;
  }

  /**
   * List deploy runs, newest first
   */
  async listRuns(limit = 100): Promise<DeployRunMetadata[]> {
    const index = await this.readRunsIndex();
    return index.runs.slice(0, limit);
  }

  /**
   * Get latest deploy run
   */
  async getLatestRun(): Promise<DeployRunMetadata | null> {
    const runs = await this.listRuns(1);
    return runs[0] || null;
  }

  /**
   * Add approval requirement for an artifact
   */
  async addApprovalRequirement(artifactId: string, requestedBy: string, reason?: string): Promise<ApprovalState> {
    await this.init();

    const approval: ApprovalState = {
      artifactId,
      required: true,
      requestedAt: nowIso(),
      requestedBy,
      approved: false,
      ...(reason && { reason })
    };

    const index = await this.readApprovalsIndex();
    // Remove any existing approval for this artifact
    index.approvals = index.approvals.filter(a => a.artifactId !== artifactId);
    index.approvals.unshift(approval);
    index.lastUpdated = nowIso();
    await this.writeApprovalsIndex(index);

    return approval;
  }

  /**
   * Approve an artifact
   */
  async approveArtifact(artifactId: string, approvedBy: string, reason?: string): Promise<ApprovalState | null> {
    const index = await this.readApprovalsIndex();
    const approvalIndex = index.approvals.findIndex(a => a.artifactId === artifactId);
    
    if (approvalIndex === -1) {
      return null;
    }

    const approval = index.approvals[approvalIndex];
    if (approval) {
      approval.approved = true;
      approval.approvedBy = approvedBy;
      approval.approvedAt = nowIso();
      if (reason) {
        approval.reason = reason;
      }
    }
    
    index.lastUpdated = nowIso();
    await this.writeApprovalsIndex(index);

    return approval || null;
  }

  /**
   * Get approval state for an artifact
   */
  async getApprovalState(artifactId: string): Promise<ApprovalState | null> {
    const index = await this.readApprovalsIndex();
    return index.approvals.find(a => a.artifactId === artifactId) || null;
  }

  /**
   * List all pending approvals
   */
  async listPendingApprovals(): Promise<ApprovalState[]> {
    const index = await this.readApprovalsIndex();
    return index.approvals.filter(a => a.required && !a.approved);
  }

  /**
   * Mark rollback as required for a deploy run
   */
  async requireRollback(deployRunId: string, reason: string): Promise<RollbackState> {
    await this.init();

    const rollback: RollbackState = {
      deployRunId,
      required: true,
      reason,
      initiatedAt: nowIso(),
      completed: false
    };

    const index = await this.readRollbacksIndex();
    // Remove any existing rollback for this run
    index.rollbacks = index.rollbacks.filter(r => r.deployRunId !== deployRunId);
    index.rollbacks.unshift(rollback);
    index.lastUpdated = nowIso();
    await this.writeRollbacksIndex(index);

    // Also update the deploy run
    await this.updateRun(deployRunId, { rollbackRequired: true, rollbackReason: reason });

    return rollback;
  }

  /**
   * Complete a rollback
   */
  async completeRollback(deployRunId: string, success: boolean, initiatedBy?: string): Promise<RollbackState | null> {
    const index = await this.readRollbacksIndex();
    const rollbackIndex = index.rollbacks.findIndex(r => r.deployRunId === deployRunId);
    
    if (rollbackIndex === -1) {
      return null;
    }

    const rollback = index.rollbacks[rollbackIndex];
    if (rollback) {
      rollback.completed = true;
      rollback.completedAt = nowIso();
      rollback.success = success;
      if (initiatedBy) {
        rollback.initiatedBy = initiatedBy;
      }
    }
    
    index.lastUpdated = nowIso();
    await this.writeRollbacksIndex(index);

    // Also update the deploy run status
    await this.updateRun(deployRunId, { 
      status: success ? "success" : "rolled_back",
      completedAt: nowIso()
    });

    return rollback || null;
  }

  /**
   * Get rollback state for a deploy run
   */
  async getRollbackState(deployRunId: string): Promise<RollbackState | null> {
    const index = await this.readRollbacksIndex();
    return index.rollbacks.find(r => r.deployRunId === deployRunId) || null;
  }

  /**
   * List all required rollbacks
   */
  async listRequiredRollbacks(): Promise<RollbackState[]> {
    const index = await this.readRollbacksIndex();
    return index.rollbacks.filter(r => r.required && !r.completed);
  }

  /**
   * Get deploy statistics
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    pendingApprovals: number;
    requiredRollbacks: number;
    recent: number; // runs in last 24 hours
  }> {
    const runsIndex = await this.readRunsIndex();
    const approvalsIndex = await this.readApprovalsIndex();
    const rollbacksIndex = await this.readRollbacksIndex();
    
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const stats = {
      total: runsIndex.runs.length,
      byStatus: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      pendingApprovals: approvalsIndex.approvals.filter(a => a.required && !a.approved).length,
      requiredRollbacks: rollbacksIndex.rollbacks.filter(r => r.required && !r.completed).length,
      recent: 0
    };

    // Initialize counters
    for (const run of runsIndex.runs) {
      stats.byStatus[run.status] = (stats.byStatus[run.status] || 0) + 1;
      stats.byType[run.type] = (stats.byType[run.type] || 0) + 1;
      if (new Date(run.requestedAt) > dayAgo) {
        stats.recent++;
      }
    }

    return stats;
  }

  /**
   * Clean up old deploy runs (keep last N runs)
   */
  async cleanup(keepRuns = 100): Promise<number> {
    const runsIndex = await this.readRunsIndex();
    const originalLength = runsIndex.runs.length;

    runsIndex.runs = runsIndex.runs.slice(0, keepRuns);
    runsIndex.lastUpdated = nowIso();
    await this.writeRunsIndex(runsIndex);

    return originalLength - runsIndex.runs.length;
  }

  private async readRunsIndex(): Promise<{ runs: DeployRunMetadata[]; lastUpdated: string }> {
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

  private async writeRunsIndex(index: { runs: DeployRunMetadata[]; lastUpdated: string }): Promise<void> {
    await fs.writeFile(this.runsPath, JSON.stringify(index, null, 2));
  }

  private async readApprovalsIndex(): Promise<{ approvals: ApprovalState[]; lastUpdated: string }> {
    try {
      if (!(await exists(this.approvalsPath))) {
        return { approvals: [], lastUpdated: nowIso() };
      }
      const data = await fs.readFile(this.approvalsPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      // Index can't be read
      return { approvals: [], lastUpdated: nowIso() };
    }
  }

  private async writeApprovalsIndex(index: { approvals: ApprovalState[]; lastUpdated: string }): Promise<void> {
    await fs.writeFile(this.approvalsPath, JSON.stringify(index, null, 2));
  }

  private async readRollbacksIndex(): Promise<{ rollbacks: RollbackState[]; lastUpdated: string }> {
    try {
      if (!(await exists(this.rollbacksPath))) {
        return { rollbacks: [], lastUpdated: nowIso() };
      }
      const data = await fs.readFile(this.rollbacksPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      // Index can't be read
      return { rollbacks: [], lastUpdated: nowIso() };
    }
  }

  private async writeRollbacksIndex(index: { rollbacks: RollbackState[]; lastUpdated: string }): Promise<void> {
    await fs.writeFile(this.rollbacksPath, JSON.stringify(index, null, 2));
  }
}
