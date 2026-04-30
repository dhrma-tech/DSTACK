import { describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ArtifactStore, CheckpointStore, ConfigManager, FakeProvider, MemoryStore, PermissionGate, SkillExecutor, SkillRegistry } from "@dstack/core";
import type { ProjectMemory, SkillInvocation } from "@dstack/shared";
import { tempWorkspace } from "../helpers/temp-workspace.js";

describe("ConfigManager", () => {
  it("loads defaults and env overrides without requiring a live API key", async () => {
    const workspace = await tempWorkspace();
    try {
      vi.stubEnv("DSTACK_DEFAULT_MODEL", "gemini-test");
      const config = await ConfigManager.load({ projectRoot: workspace.root });
      expect(config.defaultModel).toBe("gemini-test");
      expect(config.geminiApiKey).toBeNull();
    } finally {
      vi.unstubAllEnvs();
      await workspace.cleanup();
    }
  });
});

describe("ArtifactStore and CheckpointStore", () => {
  it("writes latest artifacts and restores checkpoint pointers", async () => {
    const workspace = await tempWorkspace();
    try {
      const dstackDir = path.join(workspace.root, ".dstack");
      const artifacts = new ArtifactStore(dstackDir);
      const first = await artifacts.write("qa", { overallVerdict: "FAIL", blockers: ["x"] });
      const checkpoint = await new CheckpointStore(dstackDir, workspace.root).save("before");
      await artifacts.write("qa", { overallVerdict: "PASS", blockers: [] });
      await new CheckpointStore(dstackDir, workspace.root).restore("before");
      expect((await artifacts.readLatest("qa"))?.content.overallVerdict).toBe("FAIL");
      expect(checkpoint.artifactPointers.qa).toContain(path.basename(first.filePath));
    } finally {
      await workspace.cleanup();
    }
  });

  it("roundtrips project memory", async () => {
    const workspace = await tempWorkspace();
    try {
      const store = new MemoryStore(path.join(workspace.root, ".dstack"));
      const memory: ProjectMemory = {
        version: "1",
        projectName: "Demo",
        createdAt: "now",
        updatedAt: "now",
        techStack: { frontend: "React", backend: "Node", database: "", infra: "", testing: "Vitest" },
        goals: ["ship"],
        constraints: [],
        keyDecisions: [],
        domainTerms: {},
        openQuestions: []
      };
      await store.write(memory);
      expect((await store.read())?.projectName).toBe("Demo");
    } finally {
      await workspace.cleanup();
    }
  });
});

describe("PermissionGate", () => {
  it("denies destructive commands", async () => {
    const gate = new PermissionGate({ interactive: false });
    await expect(gate.check({ id: "1", name: "run_command", input: { command: "rm -rf ." } })).resolves.toBe("DENY");
  });
});

describe("Skill runtime", () => {
  it("lists all Phase 1 skills", async () => {
    const skills = await new SkillRegistry().list();
    expect(skills).toHaveLength(14);
    expect(skills.map((skill) => skill.name)).toContain("office-hours");
    expect(skills.map((skill) => skill.name)).toContain("ship");
  });

  it("runs a model-backed skill with FakeProvider and writes an artifact", async () => {
    const workspace = await tempWorkspace();
    try {
      const config = await ConfigManager.load({ projectRoot: workspace.root });
      const fake = new FakeProvider();
      fake.enqueue(JSON.stringify({
        projectName: "DStack",
        summary: "A workflow system",
        targetUsers: ["developers"],
        coreProblem: "undisciplined shipping",
        successMetrics: ["valid artifact"],
        techStack: { frontend: "", backend: "TypeScript", infra: "" },
        constraints: [],
        outOfScope: [],
        openQuestions: []
      }));
      const executor = new SkillExecutor({ config, providerOverride: fake, interactive: false });
      const invocation: SkillInvocation = {
        skillName: "/office-hours",
        projectRoot: workspace.root,
        inputs: { idea: "Build DStack" },
        flags: { force: false, dryRun: false, noStream: false, model: null, allowSecrets: false }
      };
      const result = await executor.run(invocation);
      expect(result.artifactPath).toBeTruthy();
      expect(await readFile(path.join(workspace.root, ".dstack", "artifacts", "office-hours", "latest.json"), "utf8")).toContain("DStack");
    } finally {
      await workspace.cleanup();
    }
  });

  it("rejects model output that does not match the skill output schema", async () => {
    const workspace = await tempWorkspace();
    try {
      const config = await ConfigManager.load({ projectRoot: workspace.root });
      const fake = new FakeProvider();
      fake.enqueue(JSON.stringify({ projectName: "Too thin" }));
      const executor = new SkillExecutor({ config, providerOverride: fake, interactive: false });
      await expect(executor.run({
        skillName: "/office-hours",
        projectRoot: workspace.root,
        inputs: { idea: "Build DStack" },
        flags: { force: false, dryRun: false, noStream: false, model: null, allowSecrets: false }
      })).rejects.toThrow("output failed schema validation");
    } finally {
      await workspace.cleanup();
    }
  });

  it("enforces missing prerequisite artifacts", async () => {
    const workspace = await tempWorkspace();
    try {
      const config = await ConfigManager.load({ projectRoot: workspace.root });
      const executor = new SkillExecutor({ config, providerOverride: new FakeProvider(), interactive: false });
      await expect(executor.run({ skillName: "/autoplan", projectRoot: workspace.root, inputs: {}, flags: { force: false, dryRun: false, noStream: false, model: null, allowSecrets: false } })).rejects.toThrow("requires /office-hours");
    } finally {
      await workspace.cleanup();
    }
  });

  it("blocks engineering review after a failed CEO review unless forced", async () => {
    const workspace = await tempWorkspace();
    try {
      const config = await ConfigManager.load({ projectRoot: workspace.root });
      const artifacts = new ArtifactStore(config.dstackDir);
      await artifacts.write("autoplan", { planVersion: "1", generatedAt: "now", phases: [], openDecisions: [], riskFlags: [], assumptionsMade: [] });
      await artifacts.write("plan-ceo-review", { overallVerdict: "FAIL", phaseReviews: [], globalConcerns: [], mustFixBeforeProceeding: ["fix plan"], approvedAspects: [] });
      const executor = new SkillExecutor({ config, providerOverride: new FakeProvider(), interactive: false });
      await expect(executor.run({
        skillName: "/plan-eng-review",
        projectRoot: workspace.root,
        inputs: {},
        flags: { force: false, dryRun: false, noStream: false, model: null, allowSecrets: false }
      })).rejects.toThrow("plan-ceo-review failed");
    } finally {
      await workspace.cleanup();
    }
  });

  it("blocks ship when QA did not pass", async () => {
    const workspace = await tempWorkspace();
    try {
      const config = await ConfigManager.load({ projectRoot: workspace.root });
      const artifacts = new ArtifactStore(config.dstackDir);
      await artifacts.write("qa", { passedChecks: [], failedChecks: [], testResults: {}, browserFindings: [], overallVerdict: "FAIL", blockers: ["critical"], recommendations: [] });
      await artifacts.write("review", { reviewedFiles: [], fileReviews: [], overallVerdict: "PASS", summary: "ok", criticalIssues: [] });
      const executor = new SkillExecutor({ config, providerOverride: new FakeProvider(), interactive: false });
      await expect(executor.run({
        skillName: "/ship",
        projectRoot: workspace.root,
        inputs: {},
        flags: { force: false, dryRun: false, noStream: false, model: null, allowSecrets: false }
      })).rejects.toThrow("blocked until /qa");
    } finally {
      await workspace.cleanup();
    }
  });
});
