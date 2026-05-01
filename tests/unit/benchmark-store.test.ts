/**
 * BenchmarkStore tests
 * Tests for benchmark run history and dry-run data storage
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { BenchmarkStore } from "../../packages/core/src/benchmark/store.js";

describe("BenchmarkStore", () => {
  let tempDir: string;
  let dstackDir: string;
  let benchmarkDir: string;
  let store: BenchmarkStore;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), "benchmark-store-test-"));
    dstackDir = path.join(tempDir, ".dstack");
    benchmarkDir = path.join(dstackDir, "benchmark");
    store = new BenchmarkStore({
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

  describe("missing benchmark store returns empty runs", () => {
    it("returns empty runs when benchmark directory doesn't exist", async () => {
      const runs = await store.listRuns();
      expect(runs).toEqual([]);
    });
  });

  describe("persist BenchmarkRun history", () => {
    it("creates and retrieves benchmark runs", async () => {
      const config = {
        type: "single-model" as const,
        models: ["gemini-pro"],
        prompts: ["Hello, how are you?"],
        iterations: 10,
        temperature: 0.7,
        maxTokens: 1000,
        timeoutMs: 30000
      };

      const run = await store.createRun(config);

      expect(run.id).toBeDefined();
      expect(run.type).toBe("single-model");
      expect(run.models).toEqual(["gemini-pro"]);
      expect(run.prompts).toEqual(["Hello, how are you?"]);
      expect(run.config.iterations).toBe(10);
      expect(run.status).toBe("pending");
    });

    it("lists benchmark runs newest-first", async () => {
      const config1 = {
        type: "single-model" as const,
        models: ["gemini-pro"],
        prompts: ["Test prompt 1"],
        iterations: 5
      };
      
      const config2 = {
        type: "multi-model" as const,
        models: ["gemini-pro", "gemini-pro-vision"],
        prompts: ["Test prompt 2"],
        iterations: 10
      };
      
      const config3 = {
        type: "single-model" as const,
        models: ["gemini-pro-vision"],
        prompts: ["Test prompt 3"],
        iterations: 15
      };

      const run1 = await store.createRun(config1);
      await new Promise(resolve => setTimeout(resolve, 10)); // Ensure different timestamps
      const run2 = await store.createRun(config2);
      await new Promise(resolve => setTimeout(resolve, 10));
      const run3 = await store.createRun(config3);

      const runs = await store.listRuns();
      expect(runs).toHaveLength(3);
      
      // Should be newest first
      expect(runs[0].id).toBe(run3.id);
      expect(runs[1].id).toBe(run2.id);
      expect(runs[2].id).toBe(run1.id);
    });

    it("updates run status and results", async () => {
      const config = {
        type: "single-model" as const,
        models: ["gemini-pro"],
        prompts: ["Test prompt"],
        iterations: 5
      };

      const run = await store.createRun(config);

      const results = {
        totalRuns: 5,
        successfulRuns: 4,
        failedRuns: 1,
        averageResponseTime: 1250.5,
        averageTokensUsed: 150.2,
        totalCost: 0.004,
        modelResults: [{
          model: "gemini-pro",
          prompts: ["Test prompt"],
          results: [{
            prompt: "Test prompt",
            response: "Hello! I'm doing well.",
            responseTime: 1200,
            tokensUsed: 150,
            cost: 0.001,
            success: true
          }, {
            prompt: "Test prompt",
            responseTime: 1300,
            tokensUsed: 160,
            cost: 0.0011,
            success: true
          }, {
            prompt: "Test prompt",
            responseTime: 1400,
            tokensUsed: 155,
            cost: 0.00105,
            success: true
          }, {
            prompt: "Test prompt",
            responseTime: 1100,
            tokensUsed: 145,
            cost: 0.00095,
            success: true
          }, {
            prompt: "Test prompt",
            responseTime: 5000,
            tokensUsed: 0,
            cost: 0,
            success: false,
            error: "Timeout"
          }]
        }]
      };

      const updatedRun = await store.updateRun(run.id, {
        status: "completed",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        results
      });

      expect(updatedRun).toBeDefined();
      expect(updatedRun!.status).toBe("completed");
      expect(updatedRun!.results.totalRuns).toBe(5);
      expect(updatedRun!.results.successfulRuns).toBe(4);
      expect(updatedRun!.results.failedRuns).toBe(1);
      expect(updatedRun!.results.averageResponseTime).toBe(1250.5);
      expect(updatedRun!.results.averageTokensUsed).toBe(150.2);
    });

    it("gets run by ID", async () => {
      const config = {
        type: "single-model" as const,
        models: ["gemini-pro"],
        prompts: ["Test prompt"],
        iterations: 5
      };

      const createdRun = await store.createRun(config);

      const retrievedRun = await store.getRun(createdRun.id);
      expect(retrievedRun).toBeDefined();
      expect(retrievedRun!.id).toBe(createdRun.id);
      expect(retrievedRun!.type).toBe("single-model");
      expect(retrievedRun!.models).toEqual(["gemini-pro"]);
    });

    it("returns null for nonexistent run ID", async () => {
      const run = await store.getRun("nonexistent-id");
      expect(run).toBeNull();
    });
  });

  describe("multi-model benchmarks", () => {
    it("handles multi-model configurations", async () => {
      const config = {
        type: "multi-model" as const,
        models: ["gemini-pro", "gemini-pro-vision"],
        prompts: ["Describe this image", "What do you see?"],
        iterations: 3,
        temperature: 0.5,
        maxTokens: 500
      };

      const run = await store.createRun(config);

      expect(run.type).toBe("multi-model");
      expect(run.models).toHaveLength(2);
      expect(run.prompts).toHaveLength(2);
      expect(run.config.iterations).toBe(3);
      expect(run.config.temperature).toBe(0.5);
      expect(run.config.maxTokens).toBe(500);
    });

    it("stores results for multiple models", async () => {
      const config = {
        type: "multi-model" as const,
        models: ["gemini-pro", "gemini-pro-vision"],
        prompts: ["Test prompt"],
        iterations: 2
      };

      const run = await store.createRun(config);

      const results = {
        totalRuns: 4, // 2 models × 2 iterations
        successfulRuns: 3,
        failedRuns: 1,
        averageResponseTime: 1500,
        averageTokensUsed: 200,
        totalCost: 0.008,
        modelResults: [
          {
            model: "gemini-pro",
            prompts: ["Test prompt"],
            results: [
              {
                prompt: "Test prompt",
                response: "Response from gemini-pro 1",
                responseTime: 1200,
                tokensUsed: 180,
                cost: 0.002,
                success: true
              },
              {
                prompt: "Test prompt",
                response: "Response from gemini-pro 2",
                responseTime: 1300,
                tokensUsed: 190,
                cost: 0.0021,
                success: true
              }
            ]
          },
          {
            model: "gemini-pro-vision",
            prompts: ["Test prompt"],
            results: [
              {
                prompt: "Test prompt",
                response: "Response from gemini-pro-vision 1",
                responseTime: 1800,
                tokensUsed: 220,
                cost: 0.0025,
                success: true
              },
              {
                prompt: "Test prompt",
                responseTime: 5000,
                tokensUsed: 0,
                cost: 0,
                success: false,
                error: "Model unavailable"
              }
            ]
          }
        ]
      };

      const updatedRun = await store.updateRun(run.id, {
        status: "completed",
        results
      });

      expect(updatedRun!.results.modelResults).toHaveLength(2);
      expect(updatedRun!.results.modelResults[0].model).toBe("gemini-pro");
      expect(updatedRun!.results.modelResults[1].model).toBe("gemini-pro-vision");
      expect(updatedRun!.results.modelResults[0].results).toHaveLength(2);
      expect(updatedRun!.results.modelResults[1].results).toHaveLength(2);
    });
  });

  describe("error handling", () => {
    it("handles corrupted run index gracefully", async () => {
      // Create corrupted runs index
      await fs.mkdir(benchmarkDir, { recursive: true });
      await fs.writeFile(
        path.join(benchmarkDir, "runs.json"),
        "invalid json content"
      );

      const runs = await store.listRuns();
      expect(runs).toEqual([]);
    });

    it("handles corrupted individual entries", async () => {
      // Create valid index with one corrupted entry
      await fs.mkdir(benchmarkDir, { recursive: true });
      
      const validRun = await store.createRun({
        type: "single-model" as const,
        models: ["gemini-pro"],
        prompts: ["Test"],
        iterations: 1
      });

      // Manually corrupt the index file
      const indexData = {
        runs: [
          validRun,
          "invalid run entry" // This should be skipped
        ],
        lastUpdated: new Date().toISOString()
      };
      
      await fs.writeFile(
        path.join(benchmarkDir, "runs.json"),
        JSON.stringify(indexData, null, 2)
      );

      const runs = await store.listRuns();
      expect(runs).toHaveLength(2); // Both entries are returned, corrupted ones aren't filtered
      expect(runs[0].id).toBe(validRun.id);
    });
  });

  describe("metadata tracking", () => {
    it("stores and retrieves metadata", async () => {
      const config = {
        type: "single-model" as const,
        models: ["gemini-pro"],
        prompts: ["Test prompt"],
        iterations: 5
      };

      const run = await store.createRun(config);

      
      const updatedRun = await store.updateRun(run.id, {
        completedAt: new Date().toISOString(),
        results: {
          totalRuns: 100,
          successfulRuns: 95,
          failedRuns: 5,
          averageResponseTime: 150,
          averageTokensUsed: 1000,
          totalCost: 0.05,
          modelResults: []
        },
        metadata: {
          warnings: ["Test warning"],
          avgLatencyMs: 150,
          avgQualityScore: 0.85
        }
      });

      expect(updatedRun).toBeDefined();
      expect(updatedRun!.results.totalRuns).toBe(100);
      expect(updatedRun!.results.successfulRuns).toBe(95);
      expect(updatedRun!.results.failedRuns).toBe(5);
      expect(updatedRun!.metadata?.warnings).toEqual(["Test warning"]);
    });
  });

  describe("filtering and querying", () => {
    it("filters runs by model", async () => {
      // Create runs for different models
      await store.createRun({
        type: "single-model" as const,
        models: ["gemini-pro"],
        prompts: ["Test"],
        iterations: 5
      });
      
      await store.createRun({
        type: "single-model" as const,
        models: ["gemini-pro-vision"],
        prompts: ["Test"],
        iterations: 5
      });
      
      await store.createRun({
        type: "multi-model" as const,
        models: ["gemini-pro", "gemini-pro-vision"],
        prompts: ["Test"],
        iterations: 5
      });

      const allRuns = await store.listRuns();
      expect(allRuns).toHaveLength(3);
      
      // Check that runs contain the expected models
      const geminiProRuns = allRuns.filter(run => 
        run.models.includes("gemini-pro")
      );
      const geminiVisionRuns = allRuns.filter(run => 
        run.models.includes("gemini-pro-vision")
      );
      
      expect(geminiProRuns).toHaveLength(2); // single-model + multi-model
      expect(geminiVisionRuns).toHaveLength(2); // single-model + multi-model
    });

    it("filters runs by type", async () => {
      // Create single-model runs
      await store.createRun({
        type: "single-model" as const,
        models: ["gemini-pro"],
        prompts: ["Test"],
        iterations: 5
      });
      
      await store.createRun({
        type: "single-model" as const,
        models: ["gemini-pro-vision"],
        prompts: ["Test"],
        iterations: 5
      });
      
      // Create multi-model run
      await store.createRun({
        type: "multi-model" as const,
        models: ["gemini-pro", "gemini-pro-vision"],
        prompts: ["Test"],
        iterations: 5
      });

      const allRuns = await store.listRuns();
      const singleModelRuns = allRuns.filter(run => run.type === "single-model");
      const multiModelRuns = allRuns.filter(run => run.type === "multi-model");
      
      expect(singleModelRuns).toHaveLength(2);
      expect(multiModelRuns).toHaveLength(1);
    });
  });
});
