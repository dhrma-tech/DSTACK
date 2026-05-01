/**
 * API Routes Integration Tests
 * Tests all API routes functionality and behavior
 */

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startDstackApiServer } from "../../packages/core/src/api/server.js";
import type { ServerInfo } from "../../packages/core/src/api/server.js";
import type { ApiEnvelope, Skill } from "../../packages/shared/src/contracts.js";
import { readFile } from "node:fs/promises";
import path from "node:path";

describe("API Routes Integration Tests", () => {
  let serverInfo: ServerInfo;
  const baseUrl = "http://127.0.0.1:4573"; // Use different port
  const projectRoot = process.cwd();
  const tokenFile = ".dstack/api/test-routes-token";

  beforeAll(async () => {
    serverInfo = await startDstackApiServer({
      projectRoot,
      host: "127.0.0.1",
      port: 4573,
      tokenFile,
      allowAbsolutePaths: false,
      bindLocalOnly: true,
      allowExternalOrigins: false
    });

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    if (serverInfo) {
      await serverInfo.close();
    }
  });

  async function makeAuthenticatedRequest(endpoint: string, options: RequestInit = {}): Promise<ApiEnvelope<unknown>> {
    const tokenPath = path.join(projectRoot, tokenFile);
    const token = await readFile(tokenPath, 'utf-8');

    const response = await fetch(`${baseUrl}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token.trim()}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    return response.json();
  }

  describe("Skills Routes", () => {
    test("GET /v1/skills returns visible skills", async () => {
      const data = await makeAuthenticatedRequest('/v1/skills');
      
      expect(data.ok).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      
      // Should contain some skills (at least fake provider skills)
      expect(data.data.length).toBeGreaterThan(0);
      
      // Validate skill structure
      data.data.forEach((skill: Skill) => {
        expect(skill).toMatchObject({
          name: expect.any(String),
          description: expect.any(String),
          maturity: expect.any(String),
          model: expect.any(String)
        });
      });
    });

    test("hidden skills hidden by default", async () => {
      const data = await makeAuthenticatedRequest('/v1/skills');
      
      // Should not contain hidden skills
      const hiddenSkillNames = data.data
        .filter((skill: Skill) => skill.name.includes('hidden') || skill.name.includes('admin'))
        .map((skill: Skill) => skill.name);
      
      expect(hiddenSkillNames).toHaveLength(0);
    });

    test("includeHidden=true behavior", async () => {
      const data = await makeAuthenticatedRequest('/v1/skills?includeHidden=true');
      
      expect(data.ok).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      
      // Should contain more skills when includeHidden=true
      const defaultData = await makeAuthenticatedRequest('/v1/skills');
      expect(data.data.length).toBeGreaterThanOrEqual(defaultData.data.length);
    });

    test("GET /v1/skills/:name returns manifest summary", async () => {
      // First get list of skills to find a valid one
      const skillsData = await makeAuthenticatedRequest('/v1/skills');
      const skillName = skillsData.data[0]?.name;
      
      if (skillName) {
        const data = await makeAuthenticatedRequest(`/v1/skills/${skillName}`);
        
        expect(data.ok).toBe(true);
        expect(data.data).toMatchObject({
          name: skillName,
          command: expect.any(String),
          description: expect.any(String),
          triggerPhrases: expect.any(Array),
          model: expect.any(String),
          streaming: expect.any(Boolean),
          inputs: expect.any(Array),
          allowedTools: expect.any(Array),
          requiresArtifacts: expect.any(Array),
          artifactPath: expect.any(String),
          nextSkill: expect.any(String),
          outputSchemaVersion: expect.any(String),
          maturity: expect.any(String),
          acceptanceCriteria: expect.any(Array),
          failureCases: expect.any(Array)
        });
      }
    });

    test("unknown skill returns proper error", async () => {
      const data = await makeAuthenticatedRequest('/v1/skills/nonexistent-skill');
      
      expect(data.ok).toBe(false);
      expect(data.error).toMatchObject({
        code: expect.stringMatching('NOT_FOUND|SKILL_NOT_FOUND'),
        message: expect.any(String),
        retryable: false
      });
    });
  });

  describe("Skill Runs Routes", () => {
    test("GET /v1/skill-runs returns []", async () => {
      // Clear existing runs first
      const { RunService } = await import("../../packages/core/src/services/run-service.js");
      const runService = new RunService({ projectRoot });
      await runService.clearRuns();
      
      const data = await makeAuthenticatedRequest('/v1/skill-runs');
      
      expect(data.ok).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data).toHaveLength(0); // Should be empty initially
    });

    test("POST /v1/skill-runs with fake safe skill creates run", async () => {
      const requestBody = {
        skillName: 'list-skills', // This should be a safe skill
        command: 'run',
        inputs: {},
        flags: {
          force: false,
          dryRun: true,
          noStream: true,
          allowSecrets: false
        },
        providerOverride: 'fake' as const,
        modelOverride: 'fake-model',
        requestSource: 'api' as const,
        actor: 'test'
      };

      const data = await makeAuthenticatedRequest('/v1/skill-runs', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      
      expect(data.ok).toBe(true);
      expect(data.data).toMatchObject({
        id: expect.any(String),
        skillName: 'list-skills',
        status: expect.any(String),
        verdict: expect.any(String),
        artifact: expect.any(Object),
        output: expect.any(Object),
        nextSkill: expect.any(String),
        warnings: expect.any(Array),
        blockers: expect.any(Array),
        runtimeStatus: expect.any(Object),
        dryRun: true
      });
    });

    test("GET /v1/skill-runs/:id returns created run", async () => {
      // First create a run
      const requestBody = {
        skillName: 'list-skills',
        command: 'run',
        inputs: {},
        flags: {
          force: false,
          dryRun: true,
          noStream: true,
          allowSecrets: false
        },
        requestSource: 'api' as const,
        actor: 'test'
      };

      const createData = await makeAuthenticatedRequest('/v1/skill-runs', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      
      const runId = createData.data.id;
      
      // Then fetch it
      const data = await makeAuthenticatedRequest(`/v1/skill-runs/${runId}`);
      
      expect(data.ok).toBe(true);
      expect(data.data.id).toBe(runId);
      expect(data.data.skillName).toBe('list-skills');
    });

    test("hidden skill POST rejected", async () => {
      const requestBody = {
        skillName: 'hidden-admin-skill', // This should be a hidden skill
        command: 'run',
        inputs: {},
        flags: {
          force: false,
          dryRun: true,
          noStream: true,
          allowSecrets: false
        },
        requestSource: 'api' as const,
        actor: 'test'
      };

      const data = await makeAuthenticatedRequest('/v1/skill-runs', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      
      expect(data.ok).toBe(false);
      expect(data.error).toMatchObject({
        code: expect.stringMatching('NOT_FOUND|SKILL_NOT_FOUND|HIDDEN_SKILL'),
        message: expect.any(String),
        retryable: false
      });
    });
  });

  describe("Artifacts Routes", () => {
    test("GET /v1/artifacts returns []", async () => {
      const data = await makeAuthenticatedRequest('/v1/artifacts');
      
      expect(data.ok).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data).toHaveLength(0); // Should be empty initially
    });

    test("GET /v1/artifacts/:skillName/latest returns null if missing", async () => {
      const data = await makeAuthenticatedRequest('/v1/artifacts/nonexistent-skill/latest');
      
      expect(data.ok).toBe(true);
      expect(data.data).toBe(null);
    });

    test("GET /v1/artifacts/:skillName/versions returns []", async () => {
      const data = await makeAuthenticatedRequest('/v1/artifacts/nonexistent-skill/versions');
      
      expect(data.ok).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data).toHaveLength(0);
    });

    test("GET /v1/artifacts/:skillName/diff validates missing params", async () => {
      // Test missing fromVersion parameter
      const data = await makeAuthenticatedRequest('/v1/artifacts/test-skill/diff?toVersion=1.1.0');
      
      expect(data.ok).toBe(false);
      expect(data.error).toMatchObject({
        code: expect.stringMatching('VALIDATION_ERROR|MISSING_PARAMETER'),
        message: expect.any(String),
        retryable: false
      });
    });
  });

  describe("Browser Routes", () => {
    test("GET /v1/browser/snapshots returns []", async () => {
      const data = await makeAuthenticatedRequest('/v1/browser/snapshots');
      
      expect(data.ok).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data).toHaveLength(0); // Should be empty initially
    });

    test("GET /v1/browser/snapshots/:session/latest returns null if missing", async () => {
      const data = await makeAuthenticatedRequest('/v1/browser/snapshots/nonexistent-session/latest');
      
      expect(data.ok).toBe(true);
      expect(data.data).toBe(null);
    });

    test("GET /v1/browser/screenshots returns []", async () => {
      const data = await makeAuthenticatedRequest('/v1/browser/screenshots');
      
      expect(data.ok).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data).toHaveLength(0);
    });

    test("GET /v1/browser/logs/:session returns []", async () => {
      const data = await makeAuthenticatedRequest('/v1/browser/logs/nonexistent-session');
      
      expect(data.ok).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data).toHaveLength(0);
    });
  });

  describe("Deploy Routes", () => {
    test("GET /v1/deploy/config returns null if missing", async () => {
      const data = await makeAuthenticatedRequest('/v1/deploy/config');
      
      expect(data.ok).toBe(true);
      expect(data.data).toBe(null); // Should be null if no deploy config
    });

    test("GET /v1/deploy/runs returns []", async () => {
      const data = await makeAuthenticatedRequest('/v1/deploy/runs');
      
      expect(data.ok).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data).toHaveLength(0);
    });

    test("GET /v1/deploy/freeze returns FreezeState", async () => {
      const data = await makeAuthenticatedRequest('/v1/deploy/freeze');
      
      expect(data.ok).toBe(true);
      // Check freeze state structure
      expect(data.data).toHaveProperty('frozen');
      expect(data.data).toHaveProperty('scope');
      expect(data.data).toHaveProperty('reason');
      expect(data.data).toHaveProperty('actor');
      expect(data.data).toHaveProperty('createdAt');
      expect(data.data).toHaveProperty('frozenUntil');
      expect(data.data).toHaveProperty('pathScope');
      
      // Check types
      expect(typeof data.data.frozen).toBe('boolean');
      expect(typeof data.data.scope).toBe('string');
      expect(['string', 'object']).toContain(typeof data.data.reason); // null is 'object'
      expect(['string', 'object']).toContain(typeof data.data.actor);
      expect(['string', 'object']).toContain(typeof data.data.createdAt);
      expect(['string', 'object']).toContain(typeof data.data.frozenUntil);
      expect(['string', 'object']).toContain(typeof data.data.pathScope);
    });

    test("POST /v1/deploy/approve validates missing/wrong hash", async () => {
      // Test missing hash
      const data1 = await makeAuthenticatedRequest('/v1/deploy/approve', {
        method: 'POST',
        body: JSON.stringify({
          environment: 'production'
        })
      });
      
      expect(data1.ok).toBe(false);
      expect(data1.error).toMatchObject({
        code: expect.stringMatching('VALIDATION_ERROR|MISSING_PARAMETER'),
        message: expect.any(String),
        retryable: false
      });

      // Test wrong hash
      const data2 = await makeAuthenticatedRequest('/v1/deploy/approve', {
        method: 'POST',
        body: JSON.stringify({
          environment: 'production',
          confirmHash: 'wrong-hash'
        })
      });
      
      expect(data2.ok).toBe(false);
      expect(data2.error).toMatchObject({
        code: expect.stringMatching('VALIDATION_ERROR|INVALID_HASH'),
        message: expect.any(String),
        retryable: false
      });
    });
  });

  describe("Benchmarks Routes", () => {
    test("GET /v1/benchmarks returns []", async () => {
      const data = await makeAuthenticatedRequest('/v1/benchmarks');
      
      expect(data.ok).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data).toHaveLength(0);
    });

    test("GET /v1/benchmarks/:id missing returns null consistently", async () => {
      const data = await makeAuthenticatedRequest('/v1/benchmarks/nonexistent-id');
      
      expect(data.ok).toBe(true);
      expect(data.data).toBe(null); // Should consistently return null for missing benchmarks
    });
  });
});
