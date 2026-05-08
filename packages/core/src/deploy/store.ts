/**
 * DeployStore - sandbox-synchronized deploy state.
 *
 * All persistence flows through SandboxProvider. This keeps the deploy ledger,
 * approval state, rollback state, and agent-written files aligned with the same
 * execution substrate that runs builds and previews.
 */

import path from "node:path";
import { type Contracts } from "@dstack/shared";
import { LocalSandboxProvider, type SandboxFileVerification, type SandboxProvider, StateDesyncError } from "../services/sandbox.js";
import { nowIso, shortHash } from "../utils.js";

export interface DeployStoreOptions {
  dstackDir: string;
  projectRoot: string;
  sandbox?: SandboxProvider;
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
  artifacts: string[];
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

interface RunsIndex {
  runs: DeployRunMetadata[];
  lastUpdated: string;
}

interface ApprovalsIndex {
  approvals: ApprovalState[];
  lastUpdated: string;
}

interface RollbacksIndex {
  rollbacks: RollbackState[];
  lastUpdated: string;
}

export class DeployStore {
  private readonly sandbox: SandboxProvider;
  private readonly deployDir: string;
  private readonly runsPath: string;
  private readonly approvalsPath: string;
  private readonly rollbacksPath: string;

  constructor(private readonly options: DeployStoreOptions) {
    const sandboxRoot = sandboxRootFor(options.projectRoot, options.dstackDir);
    this.sandbox = options.sandbox ?? new LocalSandboxProvider({ rootDir: sandboxRoot.rootDir });
    this.deployDir = joinSandboxPath(sandboxRoot.dstackRelativePath, "deploy");
    this.runsPath = joinSandboxPath(this.deployDir, "runs.json");
    this.approvalsPath = joinSandboxPath(this.deployDir, "approvals.json");
    this.rollbacksPath = joinSandboxPath(this.deployDir, "rollbacks.json");
  }

  async init(): Promise<void> {
    if (!(await this.sandbox.fileExists(this.runsPath))) {
      await this.writeRunsIndex({ runs: [], lastUpdated: nowIso() });
    }
    if (!(await this.sandbox.fileExists(this.approvalsPath))) {
      await this.writeApprovalsIndex({ approvals: [], lastUpdated: nowIso() });
    }
    if (!(await this.sandbox.fileExists(this.rollbacksPath))) {
      await this.writeRollbacksIndex({ rollbacks: [], lastUpdated: nowIso() });
    }
  }

  async createRun(type: "full" | "canary" | "dry-run", config: Contracts.DeployConfig, reason?: string): Promise<DeployRunMetadata> {
    await this.init();
    const run: DeployRunMetadata = {
      id: shortHash(`deploy-${type}-${nowIso()}`, 12),
      type,
      status: "pending",
      requestedAt: nowIso(),
      config,
      artifacts: [],
      approvalRequired: false,
      rollbackRequired: false,
      healthChecks: { passed: 0, failed: 0, skipped: 0 },
      logs: [],
      ...(reason ? { reason } : {})
    };

    const index = await this.readRunsIndex();
    index.runs.unshift(run);
    index.lastUpdated = nowIso();
    await this.writeRunsIndex(index);
    return run;
  }

  async updateRun(runId: string, updates: Partial<DeployRunMetadata>): Promise<DeployRunMetadata | null> {
    const index = await this.readRunsIndex();
    const runIndex = index.runs.findIndex((run) => run.id === runId);
    if (runIndex === -1) return null;
    const current = index.runs[runIndex];
    if (!current) return null;
    const updated = { ...current, ...updates };
    index.runs[runIndex] = updated;
    index.lastUpdated = nowIso();
    await this.writeRunsIndex(index);
    return updated;
  }

  async getRun(runId: string): Promise<DeployRunMetadata | null> {
    const index = await this.readRunsIndex();
    return index.runs.find((run) => run.id === runId) ?? null;
  }

  async listRuns(limit = 100): Promise<DeployRunMetadata[]> {
    const index = await this.readRunsIndex();
    return index.runs.slice(0, limit);
  }

  async getLatestRun(): Promise<DeployRunMetadata | null> {
    return (await this.listRuns(1))[0] ?? null;
  }

  async addApprovalRequirement(artifactId: string, requestedBy: string, reason?: string): Promise<ApprovalState> {
    await this.init();
    const approval: ApprovalState = {
      artifactId,
      required: true,
      requestedAt: nowIso(),
      requestedBy,
      approved: false,
      ...(reason ? { reason } : {})
    };
    const index = await this.readApprovalsIndex();
    index.approvals = index.approvals.filter((entry) => entry.artifactId !== artifactId);
    index.approvals.unshift(approval);
    index.lastUpdated = nowIso();
    await this.writeApprovalsIndex(index);
    return approval;
  }

  async approveArtifact(artifactId: string, approvedBy: string, reason?: string): Promise<ApprovalState | null> {
    const index = await this.readApprovalsIndex();
    const approvalIndex = index.approvals.findIndex((approval) => approval.artifactId === artifactId);
    if (approvalIndex === -1) return null;
    const current = index.approvals[approvalIndex];
    if (!current) return null;
    const updated: ApprovalState = {
      ...current,
      approved: true,
      approvedBy,
      approvedAt: nowIso(),
      ...(reason ? { reason } : {})
    };
    index.approvals[approvalIndex] = updated;
    index.lastUpdated = nowIso();
    await this.writeApprovalsIndex(index);
    return updated;
  }

  async getApprovalState(artifactId: string): Promise<ApprovalState | null> {
    const index = await this.readApprovalsIndex();
    return index.approvals.find((approval) => approval.artifactId === artifactId) ?? null;
  }

  async listPendingApprovals(): Promise<ApprovalState[]> {
    const index = await this.readApprovalsIndex();
    return index.approvals.filter((approval) => approval.required && !approval.approved);
  }

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
    index.rollbacks = index.rollbacks.filter((entry) => entry.deployRunId !== deployRunId);
    index.rollbacks.unshift(rollback);
    index.lastUpdated = nowIso();
    await this.writeRollbacksIndex(index);
    await this.updateRun(deployRunId, { rollbackRequired: true, rollbackReason: reason });
    return rollback;
  }

  async completeRollback(deployRunId: string, success: boolean, initiatedBy?: string): Promise<RollbackState | null> {
    const index = await this.readRollbacksIndex();
    const rollbackIndex = index.rollbacks.findIndex((rollback) => rollback.deployRunId === deployRunId);
    if (rollbackIndex === -1) return null;
    const current = index.rollbacks[rollbackIndex];
    if (!current) return null;
    const updated: RollbackState = {
      ...current,
      completed: true,
      completedAt: nowIso(),
      success,
      ...(initiatedBy ? { initiatedBy } : {})
    };
    index.rollbacks[rollbackIndex] = updated;
    index.lastUpdated = nowIso();
    await this.writeRollbacksIndex(index);
    await this.updateRun(deployRunId, { status: success ? "success" : "rolled_back", completedAt: nowIso() });
    return updated;
  }

  async getRollbackState(deployRunId: string): Promise<RollbackState | null> {
    const index = await this.readRollbacksIndex();
    return index.rollbacks.find((rollback) => rollback.deployRunId === deployRunId) ?? null;
  }

  async listRequiredRollbacks(): Promise<RollbackState[]> {
    const index = await this.readRollbacksIndex();
    return index.rollbacks.filter((rollback) => rollback.required && !rollback.completed);
  }

  async writeAgentFiles(files: Record<string, string>): Promise<SandboxFileVerification[]> {
    await this.sandbox.writeFiles(files);
    return this.verifyClaimedFiles(Object.keys(files));
  }

  async verifyClaimedFiles(filePaths: string[]): Promise<SandboxFileVerification[]> {
    const verifications: SandboxFileVerification[] = [];
    for (const filePath of filePaths) {
      const lsResult = await this.sandbox.runCommand(`ls -la ${shellQuote(filePath)}`);
      if (lsResult.code !== 0) {
        const fallback = await this.sandbox.verifyFile(filePath);
        if (!fallback.exists || fallback.sizeBytes <= 0) {
          throw new StateDesyncError(`Agent claimed ${filePath} was written, but sandbox verification failed: ${lsResult.stderr || lsResult.stdout}`, filePath, fallback);
        }
        verifications.push(fallback);
        continue;
      }
      const verification = await this.sandbox.verifyFile(filePath);
      if (!verification.exists || verification.sizeBytes <= 0) {
        throw new StateDesyncError(`Agent claimed ${filePath} was written, but the sandbox file is missing or empty.`, filePath, verification);
      }
      verifications.push(verification);
    }
    return verifications;
  }

  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    pendingApprovals: number;
    requiredRollbacks: number;
    recent: number;
  }> {
    const runsIndex = await this.readRunsIndex();
    const approvalsIndex = await this.readApprovalsIndex();
    const rollbacksIndex = await this.readRollbacksIndex();
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const stats = {
      total: runsIndex.runs.length,
      byStatus: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      pendingApprovals: approvalsIndex.approvals.filter((approval) => approval.required && !approval.approved).length,
      requiredRollbacks: rollbacksIndex.rollbacks.filter((rollback) => rollback.required && !rollback.completed).length,
      recent: 0
    };
    for (const run of runsIndex.runs) {
      stats.byStatus[run.status] = (stats.byStatus[run.status] ?? 0) + 1;
      stats.byType[run.type] = (stats.byType[run.type] ?? 0) + 1;
      if (Date.parse(run.requestedAt) > dayAgo) stats.recent += 1;
    }
    return stats;
  }

  async cleanup(keepRuns = 100): Promise<number> {
    const runsIndex = await this.readRunsIndex();
    const originalLength = runsIndex.runs.length;
    runsIndex.runs = runsIndex.runs.slice(0, keepRuns);
    runsIndex.lastUpdated = nowIso();
    await this.writeRunsIndex(runsIndex);
    return originalLength - runsIndex.runs.length;
  }

  private async readRunsIndex(): Promise<RunsIndex> {
    return this.readJsonIndex(this.runsPath, { runs: [], lastUpdated: nowIso() }, isRunsIndex);
  }

  private async writeRunsIndex(index: RunsIndex): Promise<void> {
    await this.writeJsonIndex(this.runsPath, index);
  }

  private async readApprovalsIndex(): Promise<ApprovalsIndex> {
    return this.readJsonIndex(this.approvalsPath, { approvals: [], lastUpdated: nowIso() }, isApprovalsIndex);
  }

  private async writeApprovalsIndex(index: ApprovalsIndex): Promise<void> {
    await this.writeJsonIndex(this.approvalsPath, index);
  }

  private async readRollbacksIndex(): Promise<RollbacksIndex> {
    return this.readJsonIndex(this.rollbacksPath, { rollbacks: [], lastUpdated: nowIso() }, isRollbacksIndex);
  }

  private async writeRollbacksIndex(index: RollbacksIndex): Promise<void> {
    await this.writeJsonIndex(this.rollbacksPath, index);
  }

  private async readJsonIndex<T>(filePath: string, fallback: T, guard: (value: unknown) => value is T): Promise<T> {
    try {
      if (!(await this.sandbox.fileExists(filePath))) return fallback;
      const parsed = JSON.parse(await this.sandbox.readFile(filePath)) as unknown;
      return guard(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  private async writeJsonIndex(filePath: string, value: unknown): Promise<void> {
    await this.sandbox.writeFiles({ [filePath]: JSON.stringify(value, null, 2) });
    await this.verifyClaimedFiles([filePath]);
  }
}

function sandboxRootFor(projectRoot: string, dstackDir: string): { rootDir: string; dstackRelativePath: string } {
  const relative = path.relative(projectRoot, dstackDir);
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
    return { rootDir: projectRoot, dstackRelativePath: toSandboxPath(relative || ".dstack") };
  }
  return { rootDir: dstackDir, dstackRelativePath: "." };
}

function joinSandboxPath(...segments: string[]): string {
  return segments.filter(Boolean).join("/").replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "");
}

function toSandboxPath(value: string): string {
  return value.replace(/\\/g, "/");
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

function isRunsIndex(value: unknown): value is RunsIndex {
  return isRecord(value) && Array.isArray(value.runs) && typeof value.lastUpdated === "string";
}

function isApprovalsIndex(value: unknown): value is ApprovalsIndex {
  return isRecord(value) && Array.isArray(value.approvals) && typeof value.lastUpdated === "string";
}

function isRollbacksIndex(value: unknown): value is RollbacksIndex {
  return isRecord(value) && Array.isArray(value.rollbacks) && typeof value.lastUpdated === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
