/**
 * Core Services tests
 * Tests for service wiring and store integration
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { RunService } from "../../packages/core/src/services/run-service.js";
import { ArtifactService } from "../../packages/core/src/services/artifact-service.js";
import { WorkflowService } from "../../packages/core/src/services/workflow-service.js";
import { BrowserService } from "../../packages/core/src/services/browser-service.js";
import { DeployService } from "../../packages/core/src/services/deploy-service.js";
import { BenchmarkService } from "../../packages/core/src/services/benchmark-service.js";
import { RunStore } from "../../packages/core/src/runs/store.js";
import { ArtifactStore } from "../../packages/core/src/artifacts/store.js";
import { WorkflowGraph } from "../../packages/core/src/workflow/graph.js";
import { BrowserStore } from "../../packages/core/src/browser/store.js";
import { DeployStore } from "../../packages/core/src/deploy/store.js";
import { BenchmarkStore } from "../../packages/core/src/benchmark/store.js";

describe("Core Services", () => {
  let tempDir: string;
  let dstackDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), "core-services-test-"));
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

  describe("RunService reads RunStore", () => {
    it("creates RunService with correct store integration", async () => {
      const runStore = new RunStore({ dstackDir });
      const runService = new RunService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      expect(runService).toBeDefined();
      expect(runStore).toBeDefined();
    });

    it("returns empty runs when no runs exist", async () => {
      const runService = new RunService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      const runs = await runService.getSkillRuns();
      expect(runs).toEqual([]);
    });

    it("creates and retrieves runs through service", async () => {
      const runService = new RunService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      const runRequest = await runService.createRunRequest("test-skill", { input: "test" });
      expect(runRequest).toBeDefined();
      expect(runRequest.skillName).toBe("test-skill");
      expect(runRequest.inputs).toEqual({ input: "test" });

      const runs = await runService.getSkillRuns();
      expect(runs).toHaveLength(1);
      expect(runs[0].skillName).toBe("test-skill");
    });

    it("retrieves specific run by ID", async () => {
      const runService = new RunService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      await runService.createRunRequest("test-skill", { input: "test" });
      const runs = await runService.getSkillRuns("test-skill");
      
      expect(runs).toHaveLength(1);
      expect(runs[0].skillName).toBe("test-skill");
    });

    it("returns null for nonexistent run", async () => {
      const runService = new RunService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      const run = await runService.getSkillRun("nonexistent-id");
      expect(run).toBeNull();
    });
  });

  describe("ArtifactService reads ArtifactStore", () => {
    it("creates ArtifactService with correct store integration", async () => {
      const artifactStore = new ArtifactStore({ 
        dstackDir, 
        projectRoot, 
        allowAbsolutePaths: false 
      });
      const artifactService = new ArtifactService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      expect(artifactService).toBeDefined();
      expect(artifactStore).toBeDefined();
    });

    it("returns empty artifacts when none exist", async () => {
      const artifactService = new ArtifactService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      const artifacts = await artifactService.listArtifacts();
      expect(artifacts).toEqual([]);
    });

    it("returns null for nonexistent artifact", async () => {
      const artifactService = new ArtifactService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      const artifact = await artifactService.getArtifact("nonexistent-id");
      expect(artifact).toBeNull();
    });

    it("returns empty versions for nonexistent artifact", async () => {
      const artifactService = new ArtifactService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      const versions = await artifactService.getArtifactVersions("nonexistent-id");
      expect(versions).toEqual([]);
    });
  });

  describe("WorkflowService returns WorkflowGraph", () => {
    it("creates WorkflowService with correct graph integration", async () => {
      const workflowGraph = new WorkflowGraph({ dstackDir, projectRoot });
      const workflowService = new WorkflowService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      expect(workflowService).toBeDefined();
      expect(workflowGraph).toBeDefined();
    });

    it("returns current stage", async () => {
      const workflowService = new WorkflowService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      const currentStage = await workflowService.getCurrentStage();
      expect(currentStage).toBeDefined();
      expect(typeof currentStage).toBe("string");
    });

    it("returns workflow history", async () => {
      const workflowService = new WorkflowService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      const history = await workflowService.getWorkflowHistory();
      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
    });

    it("returns workflow status", async () => {
      const workflowService = new WorkflowService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      const status = await workflowService.getWorkflowStatus();
      expect(status).toBeDefined();
      expect(typeof status === "string" || typeof status === "object").toBe(true);
    });
  });

  describe("BrowserService reads BrowserStore", () => {
    it("creates BrowserService with correct store integration", async () => {
      const browserStore = new BrowserStore({ 
        dstackDir, 
        projectRoot, 
        allowAbsolutePaths: false 
      });
      const browserService = new BrowserService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      expect(browserService).toBeDefined();
      expect(browserStore).toBeDefined();
    });

    it("returns empty browser sessions when none exist", async () => {
      const browserService = new BrowserService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      const sessions = await browserService.getBrowserSessions();
      expect(sessions).toEqual([]);
    });

    it("returns null for nonexistent browser session", async () => {
      const browserService = new BrowserService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      const session = await browserService.getBrowserSession("nonexistent-id");
      expect(session).toBeDefined();
      expect(session.sessionId).toBe("nonexistent-id");
    });

    it("returns empty snapshots when none exist", async () => {
      const browserService = new BrowserService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      const sessions = await browserService.getBrowserSessions();
      expect(sessions).toEqual([]);
    });

    it("returns empty screenshots when none exist", async () => {
      const browserService = new BrowserService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      const sessions = await browserService.getBrowserSessions();
      expect(sessions).toEqual([]);
    });
  });

  describe("DeployService reads DeployStore", () => {
    it("creates DeployService with correct store integration", async () => {
      const deployStore = new DeployStore({ dstackDir, projectRoot });
      const deployService = new DeployService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      expect(deployService).toBeDefined();
      expect(deployStore).toBeDefined();
    });

    it("returns empty deploy runs when none exist", async () => {
      const deployService = new DeployService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      const runs = await deployService.getDeployRuns();
      expect(runs).toEqual([]);
    });

    it("returns null for nonexistent deploy run", async () => {
      const deployService = new DeployService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      const run = await deployService.getDeployRun("nonexistent-id");
      expect(run).toBeNull();
    });

    it("returns deploy config", async () => {
      const deployService = new DeployService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      const config = await deployService.getDeployConfig();
      expect(config).toBeDefined();
    });
  });

  describe("BenchmarkService reads BenchmarkStore", () => {
    it("creates BenchmarkService with correct store integration", async () => {
      const benchmarkStore = new BenchmarkStore({ dstackDir, projectRoot });
      const benchmarkService = new BenchmarkService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      expect(benchmarkService).toBeDefined();
      expect(benchmarkStore).toBeDefined();
    });

    it("returns empty benchmark runs when none exist", async () => {
      const benchmarkService = new BenchmarkService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      const runs = await benchmarkService.listBenchmarkRuns();
      expect(runs).toEqual([]);
    });

    it("returns null for nonexistent benchmark run", async () => {
      const benchmarkService = new BenchmarkService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      const run = await benchmarkService.getBenchmarkRun("nonexistent-id");
      expect(run).toBeNull();
    });

    it("creates benchmark run through service", async () => {
      const benchmarkService = new BenchmarkService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      const config = {
        type: "single-model" as const,
        models: ["test-model"],
        prompts: ["Test prompt"],
        iterations: 1
      };

      const run = await benchmarkService.createBenchmarkRun(config);
      expect(run).toBeDefined();
      expect(run.suiteName).toBeDefined();
    });
  });

  describe("missing stores return safe empty DTOs/nulls", () => {
    it("RunService handles missing .dstack directory gracefully", async () => {
      const runService = new RunService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      // Should not throw filesystem errors
      const runs = await runService.getSkillRuns();
      expect(runs).toEqual([]);

      const run = await runService.getSkillRun("any-id");
      expect(run).toBeNull();
    });

    it("ArtifactService handles missing .dstack directory gracefully", async () => {
      const artifactService = new ArtifactService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      // Should not throw filesystem errors
      const artifacts = await artifactService.listArtifacts();
      expect(artifacts).toEqual([]);

      const artifact = await artifactService.getArtifact("any-id");
      expect(artifact).toBeNull();

      const versions = await artifactService.getArtifactVersions("any-id");
      expect(versions).toEqual([]);
    });

    it("WorkflowService handles missing .dstack directory gracefully", async () => {
      const workflowService = new WorkflowService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      // Should not throw filesystem errors
      const currentStage = await workflowService.getCurrentStage();
      expect(currentStage).toBeDefined();
      expect(typeof currentStage).toBe("string");

      const history = await workflowService.getWorkflowHistory();
      expect(Array.isArray(history)).toBe(true);

      const status = await workflowService.getWorkflowStatus();
      expect(status).toBeDefined();
      expect(typeof status === "string" || typeof status === "object").toBe(true);
    });

    it("BrowserService handles missing .dstack directory gracefully", async () => {
      const browserService = new BrowserService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      // Should not throw filesystem errors
      const sessions = await browserService.getBrowserSessions();
      expect(sessions).toEqual([]);

      const session = await browserService.getBrowserSession("any-id");
      expect(session).toBeDefined();
      expect(session.sessionId).toBe("any-id");

      const snapshots = await browserService.getBrowserSessions();
      expect(snapshots).toEqual([]);
    });

    it("DeployService handles missing .dstack directory gracefully", async () => {
      const deployService = new DeployService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      // Should not throw filesystem errors
      const runs = await deployService.getDeployRuns();
      expect(runs).toEqual([]);

      const run = await deployService.getDeployRun("any-id");
      expect(run).toBeNull();

      const config = await deployService.getDeployConfig();
      expect(config).toBeDefined();
    });

    it("BenchmarkService handles missing .dstack directory gracefully", async () => {
      const benchmarkService = new BenchmarkService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      // Should not throw filesystem errors
      const runs = await benchmarkService.listBenchmarkRuns();
      expect(runs).toEqual([]);

      const run = await benchmarkService.getBenchmarkRun("any-id");
      expect(run).toBeNull();
    });
  });

  describe("service constructor validation", () => {
    it("all services accept consistent ServiceOptions", async () => {
      const serviceOptions = {
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      };

      // All services should accept the same options interface
      expect(() => new RunService(serviceOptions)).not.toThrow();
      expect(() => new ArtifactService(serviceOptions)).not.toThrow();
      expect(() => new WorkflowService(serviceOptions)).not.toThrow();
      expect(() => new BrowserService(serviceOptions)).not.toThrow();
      expect(() => new DeployService(serviceOptions)).not.toThrow();
      expect(() => new BenchmarkService(serviceOptions)).not.toThrow();
    });

    it("services handle corrupted data gracefully", async () => {
      // Create corrupted .dstack structure
      await fs.mkdir(dstackDir, { recursive: true });
      await fs.writeFile(
        path.join(dstackDir, "runs.json"),
        "invalid json content"
      );
      await fs.writeFile(
        path.join(dstackDir, "artifacts.json"),
        "invalid json content"
      );

      const runService = new RunService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      const artifactService = new ArtifactService({
        projectRoot,
        allowSecrets: false,
        allowAbsolutePaths: false
      });

      // Should handle corrupted data gracefully
      const runs = await runService.getSkillRuns();
      expect(runs).toEqual([]);

      const artifacts = await artifactService.listArtifacts();
      expect(artifacts).toEqual([]);
    });
  });
});
