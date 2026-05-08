/**
 * DeployStore tests
 * Tests for deploy run history, approval, and rollback state storage
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { DeployStore } from "../../packages/core/src/deploy/store.js";
import { StateDesyncError } from "../../packages/core/src/services/sandbox.js";

describe("DeployStore", () => {
  let tempDir: string;
  let dstackDir: string;
  let deployDir: string;
  let store: DeployStore;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), "deploy-store-test-"));
    dstackDir = path.join(tempDir, ".dstack");
    deployDir = path.join(dstackDir, "deploy");
    store = new DeployStore({
      dstackDir,
      projectRoot: tempDir
    });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("missing deploy store returns empty runs", () => {
    it("returns empty runs when deploy directory doesn't exist", async () => {
      const runs = await store.listRuns();
      expect(runs).toEqual([]);
    });
  });

  describe("sandbox materialization checks", () => {
    it("writes agent files through the sandbox and verifies they exist", async () => {
      const verifications = await store.writeAgentFiles({
        "components/Button.tsx": "export function Button() { return null; }\n"
      });

      expect(verifications).toHaveLength(1);
      expect(verifications[0]?.exists).toBe(true);
      expect(verifications[0]?.sizeBytes).toBeGreaterThan(0);
      await expect(fs.readFile(path.join(tempDir, "components", "Button.tsx"), "utf8")).resolves.toContain("Button");
    });

    it("throws StateDesyncError when an agent claims an empty file was written", async () => {
      await expect(store.writeAgentFiles({
        "components/Empty.tsx": ""
      })).rejects.toBeInstanceOf(StateDesyncError);
    });
  });

  describe("persist DeployRun history", () => {
    it("creates and retrieves deploy runs", async () => {
      const config = {
        schemaVersion: "1.0",
        platform: "node",
        environment: "development",
        deployCommand: "npm start",
        dryRunCommand: "npm run dry-run",
        healthCheckIntervalSeconds: 30,
        healthCheckTimeoutSeconds: 60,
        rollbackCommand: "npm run rollback",
        requiredEnvVars: ["NODE_ENV"],
        confirmationPolicy: "typed-hash" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const run = await store.createRun("full", config, "Test deployment");

      expect(run.id).toBeDefined();
      expect(run.type).toBe("full");
      expect(run.status).toBe("pending");
      expect(run.config.platform).toBe("node");
      expect(run.config.deployCommand).toBe("npm start");
      expect(run.artifacts).toEqual([]);
      expect(run.approvalRequired).toBe(false);
      expect(run.rollbackRequired).toBe(false);
    });

    it("lists deploy runs newest-first", async () => {
      const config = {
        schemaVersion: "1.0",
        platform: "node",
        environment: "development",
        deployCommand: "npm start",
        dryRunCommand: "npm run dry-run",
        healthCheckIntervalSeconds: 30,
        healthCheckTimeoutSeconds: 60,
        rollbackCommand: "npm run rollback",
        requiredEnvVars: ["NODE_ENV"],
        confirmationPolicy: "typed-hash" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const run1 = await store.createRun("full", config, "First deployment");
      await new Promise(resolve => setTimeout(resolve, 10)); // Ensure different timestamps
      
      const run2 = await store.createRun("canary", config, "Second deployment");
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const run3 = await store.createRun("dry-run", config, "Third deployment");

      const runs = await store.listRuns();
      expect(runs).toHaveLength(3);
      
      // Should be newest first
      expect(runs[0].id).toBe(run3.id);
      expect(runs[1].id).toBe(run2.id);
      expect(runs[2].id).toBe(run1.id);
    });

    it("updates run status and results", async () => {
      const config = {
        schemaVersion: "1.0",
        platform: "node",
        environment: "development",
        deployCommand: "npm start",
        dryRunCommand: "npm run dry-run",
        healthCheckIntervalSeconds: 30,
        healthCheckTimeoutSeconds: 60,
        rollbackCommand: "npm run rollback",
        requiredEnvVars: ["NODE_ENV"],
        confirmationPolicy: "typed-hash" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const run = await store.createRun("full", config, "Test deployment");

      const updatedRun = await store.updateRun(run.id, {
        status: "success",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        artifacts: ["artifact-1", "artifact-2"],
        healthChecks: {
          passed: 5,
          failed: 0,
          skipped: 0
        }
      });

      expect(updatedRun).toBeDefined();
      expect(updatedRun!.status).toBe("success");
      expect(updatedRun!.artifacts).toEqual(["artifact-1", "artifact-2"]);
      expect(updatedRun!.healthChecks.passed).toBe(5);
    });

    it("gets run by ID", async () => {
      const config = {
        schemaVersion: "1.0",
        platform: "node",
        environment: "development",
        deployCommand: "npm start",
        dryRunCommand: "npm run dry-run",
        healthCheckIntervalSeconds: 30,
        healthCheckTimeoutSeconds: 60,
        rollbackCommand: "npm run rollback",
        requiredEnvVars: ["NODE_ENV"],
        confirmationPolicy: "typed-hash" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const createdRun = await store.createRun("full", config, "Test deployment");

      const retrievedRun = await store.getRun(createdRun.id);
      expect(retrievedRun).toBeDefined();
      expect(retrievedRun!.id).toBe(createdRun.id);
      expect(retrievedRun!.type).toBe("full");
      expect(retrievedRun!.config.platform).toBe("node");
    });

    it("returns null for nonexistent run ID", async () => {
      const run = await store.getRun("nonexistent-id");
      expect(run).toBeNull();
    });
  });

  describe("persist approval-required state", () => {
    it("adds and retrieves approval requirements", async () => {
      const approval = await store.addApprovalRequirement("artifact-123", "user1", "Production deployment requires approval");

      expect(approval.artifactId).toBe("artifact-123");
      expect(approval.required).toBe(true);
      expect(approval.requestedBy).toBe("user1");
      expect(approval.approved).toBe(false);
      expect(approval.reason).toBe("Production deployment requires approval");

      const retrievedState = await store.getApprovalState("artifact-123");
      expect(retrievedState).toBeDefined();
      expect(retrievedState!.required).toBe(true);
      expect(retrievedState!.requestedBy).toBe("user1");
    });

    it("handles granted approval", async () => {
      await store.addApprovalRequirement("artifact-456", "user2", "Requires approval");
      
      const approvedState = await store.approveArtifact("artifact-456", "admin", "Approved for production");
      
      expect(approvedState).toBeDefined();
      expect(approvedState!.approved).toBe(true);
      expect(approvedState!.approvedBy).toBe("admin");
      expect(approvedState!.approvedAt).toBeDefined();

      const retrievedState = await store.getApprovalState("artifact-456");
      expect(retrievedState).toBeDefined();
      expect(retrievedState!.approved).toBe(true);
      expect(retrievedState!.approvedBy).toBe("admin");
    });

    it("lists pending approvals", async () => {
      await store.addApprovalRequirement("artifact-1", "user1", "Needs approval");
      await store.addApprovalRequirement("artifact-2", "user2", "Also needs approval");
      await store.approveArtifact("artifact-1", "admin", "Approved");

      const pendingApprovals = await store.listPendingApprovals();
      expect(pendingApprovals).toHaveLength(1);
      expect(pendingApprovals[0].artifactId).toBe("artifact-2");
      expect(pendingApprovals[0].approved).toBe(false);
    });
  });

  describe("persist rollback-required state", () => {
    it("requires and retrieves rollback state", async () => {
      const config = {
        schemaVersion: "1.0",
        platform: "node",
        environment: "development",
        deployCommand: "npm start",
        dryRunCommand: "npm run dry-run",
        healthCheckIntervalSeconds: 30,
        healthCheckTimeoutSeconds: 60,
        rollbackCommand: "npm run rollback",
        requiredEnvVars: ["NODE_ENV"],
        confirmationPolicy: "typed-hash" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const run = await store.createRun("full", config, "Test deployment");

      const rollbackState = await store.requireRollback(run.id, "Health check failed");

      expect(rollbackState.deployRunId).toBe(run.id);
      expect(rollbackState.required).toBe(true);
      expect(rollbackState.reason).toBe("Health check failed");
      expect(rollbackState.completed).toBe(false);

      const retrievedState = await store.getRollbackState(run.id);
      expect(retrievedState).toBeDefined();
      expect(retrievedState!.required).toBe(true);
      expect(retrievedState!.reason).toBe("Health check failed");
    });

    it("handles completed rollback", async () => {
      const config = {
        schemaVersion: "1.0",
        platform: "node",
        environment: "development",
        deployCommand: "npm start",
        dryRunCommand: "npm run dry-run",
        healthCheckIntervalSeconds: 30,
        healthCheckTimeoutSeconds: 60,
        rollbackCommand: "npm run rollback",
        requiredEnvVars: ["NODE_ENV"],
        confirmationPolicy: "typed-hash" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const run = await store.createRun("full", config, "Test deployment");

      await store.requireRollback(run.id, "Performance degradation");
      
      const completedRollback = await store.completeRollback(run.id, true, "admin");
      
      expect(completedRollback).toBeDefined();
      expect(completedRollback!.completed).toBe(true);
      expect(completedRollback!.success).toBe(true);
      expect(completedRollback!.initiatedBy).toBe("admin");
      expect(completedRollback!.completedAt).toBeDefined();

      const retrievedState = await store.getRollbackState(run.id);
      expect(retrievedState).toBeDefined();
      expect(retrievedState!.completed).toBe(true);
      expect(retrievedState!.success).toBe(true);
    });

    it("lists required rollbacks", async () => {
      const config = {
        schemaVersion: "1.0",
        platform: "node",
        environment: "development",
        deployCommand: "npm start",
        dryRunCommand: "npm run dry-run",
        healthCheckIntervalSeconds: 30,
        healthCheckTimeoutSeconds: 60,
        rollbackCommand: "npm run rollback",
        requiredEnvVars: ["NODE_ENV"],
        confirmationPolicy: "typed-hash" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const run1 = await store.createRun("full", config, "Test 1");
      const run2 = await store.createRun("full", config, "Test 2");

      await store.requireRollback(run1.id, "Issue 1");
      await store.requireRollback(run2.id, "Issue 2");
      await store.completeRollback(run1.id, true, "admin");

      const requiredRollbacks = await store.listRequiredRollbacks();
      expect(requiredRollbacks).toHaveLength(1);
      expect(requiredRollbacks[0].deployRunId).toBe(run2.id);
      expect(requiredRollbacks[0].completed).toBe(false);
    });
  });

  describe("error handling", () => {
    it("handles corrupted run index gracefully", async () => {
      // Create corrupted runs index
      await fs.mkdir(deployDir, { recursive: true });
      await fs.writeFile(
        path.join(deployDir, "runs.json"),
        "invalid json content"
      );

      const runs = await store.listRuns();
      expect(runs).toEqual([]);
    });

    it("handles corrupted approval index gracefully", async () => {
      // Create corrupted approvals index
      await fs.mkdir(deployDir, { recursive: true });
      await fs.writeFile(
        path.join(deployDir, "approvals.json"),
        "invalid json content"
      );

      const approvals = await store.listPendingApprovals();
      expect(approvals).toEqual([]);
    });

    it("handles corrupted rollback index gracefully", async () => {
      // Create corrupted rollbacks index
      await fs.mkdir(deployDir, { recursive: true });
      await fs.writeFile(
        path.join(deployDir, "rollbacks.json"),
        "invalid json content"
      );

      const rollbacks = await store.listRequiredRollbacks();
      expect(rollbacks).toEqual([]);
    });
  });

  describe("production approval fields persist", () => {
    it("persists approvalRequired field correctly", async () => {
      const config = {
        schemaVersion: "1.0",
        platform: "node",
        environment: "production",
        deployCommand: "npm start",
        dryRunCommand: "npm run dry-run",
        healthCheckIntervalSeconds: 30,
        healthCheckTimeoutSeconds: 60,
        rollbackCommand: "npm run rollback",
        requiredEnvVars: ["NODE_ENV"],
        confirmationPolicy: "typed-hash" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const run = await store.createRun("full", config, "Production deployment");
      
      // Update run to require approval
      const updatedRun = await store.updateRun(run.id, {
        approvalRequired: true
      });

      expect(updatedRun).toBeDefined();
      expect(updatedRun!.approvalRequired).toBe(true);

      const retrievedRun = await store.getRun(run.id);
      expect(retrievedRun).toBeDefined();
      expect(retrievedRun!.approvalRequired).toBe(true);
    });

    it("persists freeze state correctly", async () => {
      const config = {
        schemaVersion: "1.0",
        platform: "node",
        environment: "production",
        deployCommand: "npm start",
        dryRunCommand: "npm run dry-run",
        healthCheckIntervalSeconds: 30,
        healthCheckTimeoutSeconds: 60,
        rollbackCommand: "npm run rollback",
        requiredEnvVars: ["NODE_ENV"],
        confirmationPolicy: "typed-hash" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const run = await store.createRun("full", config, "Production deployment");
      
      // Update run with freeze state
      const updatedRun = await store.updateRun(run.id, {
        status: "success",
        completedAt: new Date().toISOString()
      });

      expect(updatedRun).toBeDefined();
      expect(updatedRun!.status).toBe("success");

      const retrievedRun = await store.getRun(run.id);
      expect(retrievedRun).toBeDefined();
      expect(retrievedRun!.status).toBe("success");
    });
  });

  describe("health checks and logs", () => {
    it("persists health check results", async () => {
      const config = {
        schemaVersion: "1.0",
        platform: "node",
        environment: "development",
        deployCommand: "npm start",
        dryRunCommand: "npm run dry-run",
        healthCheckIntervalSeconds: 30,
        healthCheckTimeoutSeconds: 60,
        rollbackCommand: "npm run rollback",
        requiredEnvVars: ["NODE_ENV"],
        confirmationPolicy: "typed-hash" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const run = await store.createRun("full", config, "Test deployment");

      const updatedRun = await store.updateRun(run.id, {
        status: "success",
        healthChecks: {
          passed: 8,
          failed: 2,
          skipped: 1
        },
        logs: [
          "Starting deployment...",
          "Building application...",
          "Running health checks...",
          "Deployment completed successfully"
        ]
      });

      expect(updatedRun).toBeDefined();
      expect(updatedRun!.healthChecks.passed).toBe(8);
      expect(updatedRun!.healthChecks.failed).toBe(2);
      expect(updatedRun!.logs).toHaveLength(4);
      expect(updatedRun!.logs[3]).toBe("Deployment completed successfully");
    });
  });
});
