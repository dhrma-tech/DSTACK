/**
 * Store integration tests
 * Tests for store integration and basic functionality
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { RunStore } from "../../packages/core/src/runs/store.js";
import { ArtifactStore } from "../../packages/core/src/artifacts/store.js";
import { WorkflowGraph } from "../../packages/core/src/workflow/graph.js";
import { BrowserStore } from "../../packages/core/src/browser/store.js";
import { DeployStore } from "../../packages/core/src/deploy/store.js";
import { BenchmarkStore } from "../../packages/core/src/benchmark/store.js";

describe("Store Integration", () => {
  let tempDir: string;
  let dstackDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), "store-integration-test-"));
    dstackDir = path.join(tempDir, ".dstack");
    projectRoot = tempDir;
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("store initialization", () => {
    it("initializes all stores without errors", async () => {
      const runStore = new RunStore({ dstackDir });
      const artifactStore = new ArtifactStore({ dstackDir, projectRoot, allowAbsolutePaths: false });
      const workflowGraph = new WorkflowGraph({ dstackDir, projectRoot });
      const browserStore = new BrowserStore({ dstackDir, projectRoot, allowAbsolutePaths: false });
      const deployStore = new DeployStore({ dstackDir, projectRoot });
      const benchmarkStore = new BenchmarkStore({ dstackDir, projectRoot });

      // All stores should be created successfully
      expect(runStore).toBeDefined();
      expect(artifactStore).toBeDefined();
      expect(workflowGraph).toBeDefined();
      expect(browserStore).toBeDefined();
      expect(deployStore).toBeDefined();
      expect(benchmarkStore).toBeDefined();
    });

    it("handles missing directories gracefully", async () => {
      // Don't create any directories - stores should handle missing data gracefully

      const runStore = new RunStore({ dstackDir });
      const artifactStore = new ArtifactStore({ dstackDir, projectRoot, allowAbsolutePaths: false });
      const workflowGraph = new WorkflowGraph({ dstackDir, projectRoot });
      const browserStore = new BrowserStore({ dstackDir, projectRoot, allowAbsolutePaths: false });
      const deployStore = new DeployStore({ dstackDir, projectRoot });
      const benchmarkStore = new BenchmarkStore({ dstackDir, projectRoot });

      // All stores should handle missing data gracefully
      const runs = await runStore.listRuns();
      const artifacts = await artifactStore.listArtifacts();
      const graph = await workflowGraph.buildGraph();
      const snapshots = await browserStore.listSnapshots();
      const deployRuns = await deployStore.listRuns();
      const benchmarkRuns = await benchmarkStore.listRuns();

      expect(runs).toEqual([]);
      expect(artifacts).toEqual([]);
      expect(graph.nodes).toEqual([]);
      expect(snapshots).toEqual([]);
      expect(deployRuns).toEqual([]);
      expect(benchmarkRuns).toEqual([]);
    });
  });

  describe("concurrent store operations", () => {
    it("handles concurrent operations across stores", async () => {
      // Initialize all stores
      const runStore = new RunStore({ dstackDir });
      const artifactStore = new ArtifactStore({ dstackDir, projectRoot, allowAbsolutePaths: false });
      const workflowGraph = new WorkflowGraph({ dstackDir, projectRoot });
      const browserStore = new BrowserStore({ dstackDir, projectRoot, allowAbsolutePaths: false });
      const deployStore = new DeployStore({ dstackDir, projectRoot });
      const benchmarkStore = new BenchmarkStore({ dstackDir, projectRoot });

      // Perform concurrent operations
      const operations = [
        runStore.createRun({
          skillName: "test-skill",
          command: "test command",
          inputs: {},
          flags: { force: false, dryRun: false, noStream: false, allowSecrets: false },
          providerOverride: null,
          modelOverride: null,
          requestSource: "cli",
          actor: "test-user"
        }),
        artifactStore.createArtifact("test-skill", "test-artifact", { data: "test" }),
        workflowGraph.buildGraph(),
        browserStore.saveSnapshot({
          sessionId: "test-session",
          url: "https://example.com",
          title: "Test Page",
          timestamp: new Date().toISOString(),
          viewport: { width: 1024, height: 768 },
          cookiesCount: 0,
          localStorageEntries: 0,
          sessionStorageEntries: 0
        }),
        deployStore.createRun("full", {
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
        }),
        benchmarkStore.createRun({
          type: "single-model",
          models: ["gemini-pro"],
          prompts: ["Test prompt"],
          iterations: 3
        })
      ];

      const results = await Promise.all(operations);

      // Verify all operations succeeded
      expect(results[0]).toBeDefined(); // Run
      expect(results[1]).toBeDefined(); // Artifact
      expect(results[2]).toBeDefined(); // Workflow graph
      expect(results[3]).toBeDefined(); // Browser session
      expect(results[4]).toBeDefined(); // Deploy run
      expect(results[5]).toBeDefined(); // Benchmark run

      // Verify data persistence
      const runs = await runStore.listRuns();
      const artifacts = await artifactStore.listArtifacts();
      const snapshots = await browserStore.listSnapshots();
      const deployRuns = await deployStore.listRuns();
      const benchmarkRuns = await benchmarkStore.listRuns();

      expect(runs).toHaveLength(1);
      expect(artifacts).toHaveLength(1);
      expect(snapshots).toHaveLength(1);
      expect(deployRuns).toHaveLength(1);
      expect(benchmarkRuns).toHaveLength(1);
    });

    it("isolates store data correctly", async () => {
      // Create separate store instances
      const runStore1 = new RunStore({ dstackDir });
      const runStore2 = new RunStore({ dstackDir });

      // Create runs with different stores
      await runStore1.createRun({
        skillName: "skill-1",
        command: "command-1",
        inputs: {},
        flags: { force: false, dryRun: false, noStream: false, allowSecrets: false },
        providerOverride: null,
        modelOverride: null,
        requestSource: "cli",
        actor: "user-1"
      });

      await runStore2.createRun({
        skillName: "skill-2",
        command: "command-2",
        inputs: {},
        flags: { force: false, dryRun: false, noStream: false, allowSecrets: false },
        providerOverride: null,
        modelOverride: null,
        requestSource: "cli",
        actor: "user-2"
      });

      // Both stores should see the same data (shared storage)
      const runs1 = await runStore1.listRuns();
      const runs2 = await runStore2.listRuns();

      expect(runs1).toHaveLength(2);
      expect(runs2).toHaveLength(2);
      expect(runs1.map((r) => r.id)).toEqual(runs2.map((r) => r.id));
    });
  });

  describe("error handling and recovery", () => {
    it("handles corrupted data gracefully", async () => {
      // Create corrupted index files
      await fs.mkdir(dstackDir, { recursive: true });
      await fs.mkdir(path.join(dstackDir, "runs"), { recursive: true });
      await fs.mkdir(path.join(dstackDir, "browser"), { recursive: true });
      await fs.mkdir(path.join(dstackDir, "deploy"), { recursive: true });
      await fs.mkdir(path.join(dstackDir, "benchmark"), { recursive: true });

      // Write corrupted index files
      await fs.writeFile(path.join(dstackDir, "runs", "index.json"), "invalid json");
      await fs.writeFile(path.join(dstackDir, "browser", "snapshots.json"), "invalid json");
      await fs.writeFile(path.join(dstackDir, "deploy", "runs.json"), "invalid json");
      await fs.writeFile(path.join(dstackDir, "benchmark", "runs.json"), "invalid json");

      // Stores should handle corrupted data gracefully
      const runStore = new RunStore({ dstackDir });
      const browserStore = new BrowserStore({ dstackDir, projectRoot, allowAbsolutePaths: false });
      const deployStore = new DeployStore({ dstackDir, projectRoot });
      const benchmarkStore = new BenchmarkStore({ dstackDir, projectRoot });

      const runs = await runStore.listRuns();
      const snapshots = await browserStore.listSnapshots();
      const deployRuns = await deployStore.listRuns();
      const benchmarkRuns = await benchmarkStore.listRuns();

      expect(runs).toEqual([]);
      expect(snapshots).toEqual([]);
      expect(deployRuns).toEqual([]);
      expect(benchmarkRuns).toEqual([]);
    });
  });

  describe("data consistency", () => {
    it("maintains data consistency across store operations", async () => {
      const runStore = new RunStore({ dstackDir });
      const artifactStore = new ArtifactStore({ dstackDir, projectRoot, allowAbsolutePaths: false });

      // Create a run
      const run = await runStore.createRun({
        skillName: "test-skill",
        command: "test command",
        inputs: {},
        flags: { force: false, dryRun: false, noStream: false, allowSecrets: false },
        providerOverride: null,
        modelOverride: null,
        requestSource: "cli",
        actor: "test-user"
      });

      // Create an artifact
      const artifact = await artifactStore.createArtifact("test-skill", "test-artifact", { data: "test" });

      // Update the run
      const updatedRun = await runStore.updateRun(run.id, {
        status: "complete",
        completedAt: new Date().toISOString()
      });

      // Verify data consistency
      expect(updatedRun).toBeDefined();
      expect(updatedRun!.status).toBe("complete");

      const retrievedRun = await runStore.getRun(run.id);
      expect(retrievedRun).toBeDefined();
      expect(retrievedRun!.status).toBe("complete");

      const retrievedArtifact = await artifactStore.getArtifact(artifact.id);
      expect(retrievedArtifact).toBeDefined();
      expect(retrievedArtifact!.content).toEqual({ data: "test" });
    });
  });
});
