import { describe, expect, it } from "vitest";
import type { Contracts, ApiSchemas } from "@dstack/shared";

describe("Shared Contracts", () => {
  describe("Project contract", () => {
    it("has required fields with correct types", () => {
      const project: Contracts.Project = {
        id: "test-project",
        name: "Test Project",
        rootDisplayPath: "./test",
        rootAbsolutePath: "/absolute/path/test",
        dstackDirRelative: ".dstack",
        workflowStage: "planning",
        createdAt: "2023-01-01T00:00:00.000Z",
        updatedAt: "2023-01-01T00:00:00.000Z",
        provider: {
          current: "fake",
          available: ["fake", "gemini"],
          geminiConfigured: false,
          fakeAvailable: true,
          allowLive: false,
          defaultProvider: "fake"
        },
        safetyMode: {
          mode: "NORMAL",
          blockedOperations: [],
          gatedOperations: []
        },
        freezeState: {
          frozen: false,
          scope: "deploy"
        },
        artifactCounts: {
          total: 5,
          latest: 2,
          stale: 1
        },
        learningCount: 10
      };

      expect(project.id).toBe("test-project");
      expect(project.name).toBe("Test Project");
      expect(project.rootDisplayPath).toBe("./test");
      expect(project.rootAbsolutePath).toBe("/absolute/path/test");
      expect(project.dstackDirRelative).toBe(".dstack");
      expect(project.workflowStage).toBe("planning");
      expect(project.safetyMode.mode).toBe("NORMAL");
      expect(project.freezeState.frozen).toBe(false);
      expect(project.artifactCounts.total).toBe(5);
      expect(project.learningCount).toBe(10);
    });
  });

  describe("Skill contract", () => {
    it("has required fields with correct types", () => {
      const skill: Contracts.Skill = {
        name: "test-skill",
        command: "/test",
        description: "Test skill",
        stage: "planning",
        maturity: "complete",
        handlerType: "model",
        registered: true,
        available: true,
        model: "fake",
        streaming: false,
        allowedTools: ["browser"],
        requiresArtifacts: ["design"],
        artifactPath: ".dstack/artifacts/test.json",
        nextSkill: "next-skill",
        hasLatestArtifact: true,
        lastRunAt: "2023-01-01T00:00:00.000Z"
      };

      expect(skill.name).toBe("test-skill");
      expect(skill.command).toBe("/test");
      expect(skill.maturity).toBe("complete");
      expect(skill.handlerType).toBe("model");
      expect(skill.allowedTools).toContain("browser");
      expect(skill.hasLatestArtifact).toBe(true);
    });
  });

  describe("SkillRun contract", () => {
    it("has required fields with correct types", () => {
      const skillRun: Contracts.SkillRun = {
        id: "run-123",
        projectId: "test-project",
        skillName: "test-skill",
        command: "/test",
        status: "complete",
        requestedAt: "2023-01-01T00:00:00.000Z",
        startedAt: "2023-01-01T00:00:01.000Z",
        completedAt: "2023-01-01T00:00:05.000Z",
        request: {
          skillName: "test-skill",
          command: "/test",
          inputs: { test: "value" },
          flags: {
            force: false,
            dryRun: false,
            noStream: false,
            allowSecrets: false
          },
          requestSource: "cli",
          actor: "user"
        },
        result: {
          runId: "run-123",
          skillName: "test-skill",
          status: "complete",
          verdict: "PASS",
          warnings: [],
          blockers: [],
          runtimeStatus: {
            safetyMode: "NORMAL",
            deployFrozen: false
          },
          toolCalls: [],
          provider: "fake",
          model: "fake"
        },
        provider: "fake",
        model: "fake",
        fakeMode: true,
        dryRun: false,
        interactive: false,
        warnings: []
      };

      expect(skillRun.id).toBe("run-123");
      expect(skillRun.status).toBe("complete");
      expect(skillRun.request.inputs.test).toBe("value");
      expect(skillRun.result?.verdict).toBe("PASS");
      expect(skillRun.fakeMode).toBe(true);
    });
  });

  describe("Artifact contract", () => {
    it("has required fields with correct types", () => {
      const artifact: Contracts.Artifact = {
        id: "artifact-123",
        projectId: "test-project",
        skillName: "test-skill",
        artifactType: "design",
        schemaVersion: "1.0",
        version: "1.0.0",
        createdAt: "2023-01-01T00:00:00.000Z",
        isLatest: true,
        relativePath: ".dstack/artifacts/test.json",
        absolutePath: "/absolute/path/.dstack/artifacts/test.json",
        contentHash: "abc123",
        verdict: "PASS",
        summary: "Test artifact",
        warnings: [],
        content: { test: "data" },
        sourceRunId: "run-123",
        promptInjectionDetected: false
      };

      expect(artifact.id).toBe("artifact-123");
      expect(artifact.artifactType).toBe("design");
      expect(artifact.isLatest).toBe(true);
      expect(artifact.verdict).toBe("PASS");
      expect(artifact.content.test).toBe("data");
      expect(artifact.promptInjectionDetected).toBe(false);
    });
  });

  describe("BrowserSnapshot contract", () => {
    it("has required fields with correct types", () => {
      const snapshot: Contracts.BrowserSnapshot = {
        id: "snapshot-123",
        projectId: "test-project",
        session: "default",
        createdAt: "2023-01-01T00:00:00.000Z",
        url: "https://example.com",
        title: "Example Page",
        text: "Page content",
        ariaTree: "aria tree",
        interactiveRefs: [{
          ref: "@e1",
          role: "button",
          name: "Submit",
          selectorHint: "button",
          source: "role",
          visible: true,
          clickable: true,
          fillable: false,
          tagName: "button",
          attributes: { type: "submit" },
          order: 1
        }],
        promptInjectionDetected: false,
        promptInjectionFragments: [],
        scannerSummary: {
          detected: false,
          fragmentCount: 0
        },
        consoleLogsCount: 0,
        networkLogsCount: 0
      };

      expect(snapshot.id).toBe("snapshot-123");
      expect(snapshot.url).toBe("https://example.com");
      expect(snapshot.interactiveRefs).toHaveLength(1);
      expect(snapshot.interactiveRefs[0].ref).toBe("@e1");
      expect(snapshot.promptInjectionDetected).toBe(false);
      expect(snapshot.scannerSummary.detected).toBe(false);
    });
  });

  describe("API Response envelopes", () => {
    it("success response has correct structure", () => {
      const response: ApiSchemas.ApiResponse<{ test: string }> = {
        ok: true,
        data: { test: "value" },
        warnings: [],
        meta: {
          requestId: "req-123",
          timestamp: "2023-01-01T00:00:00.000Z",
          apiVersion: "v1"
        }
      };

      expect(response.ok).toBe(true);
      expect(response.data.test).toBe("value");
      expect(response.meta.apiVersion).toBe("v1");
      expect(response.meta.requestId).toBe("req-123");
    });

    it("error response has correct structure", () => {
      const response: ApiSchemas.ApiError = {
        ok: false,
        error: {
          code: "TEST_ERROR",
          message: "Test error message",
          details: { context: "test" },
          retryable: false,
          requestId: "req-123"
        },
        warnings: ["warning"],
        meta: {
          requestId: "req-123",
          timestamp: "2023-01-01T00:00:00.000Z",
          apiVersion: "v1"
        }
      };

      expect(response.ok).toBe(false);
      expect(response.error.code).toBe("TEST_ERROR");
      expect(response.error.message).toBe("Test error message");
      expect(response.error.retryable).toBe(false);
      expect(response.error.approvalRequired).toBeUndefined();
      expect(response.warnings).toContain("warning");
    });
  });
});
