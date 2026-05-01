/**
 * UI Seed Fake Mode Integration Test
 * Tests the full UI seed flow using fake provider mode
 * Ensures no live Gemini calls are made and DTOs are frontend-safe
 */

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startDstackApiServer } from "../../packages/core/src/api/server.js";
import type { ServerInfo } from "../../packages/core/src/api/server.js";
import type { ApiEnvelope, SkillRun, Artifact, WorkflowNode } from "../../packages/shared/src/contracts.js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

describe("UI Seed Fake Mode Integration Test", () => {
  let serverInfo: ServerInfo;
  let tempDir: string;
  const baseUrl = "http://127.0.0.1:4574"; // Use different port
  const tokenFile = ".dstack/api/test-ui-seed-token";

  beforeAll(async () => {
    // Create temporary workspace
    tempDir = path.join(tmpdir(), `dstack-test-${Date.now()}`);
    
    // Create .dstack directory
    await mkdir(path.join(tempDir, '.dstack'), { recursive: true });
    
    // Initialize basic project structure
    await writeFile(path.join(tempDir, '.dstack', 'config.yml'), `
provider: fake
defaultModel: fake-model
proModel: fake-pro-model
maxTokens: 8192
requestTimeoutMs: 30000
maxRetries: 3
retryBaseDelayMs: 1000
maxToolCalls: 10
browserHeadless: true
allowSecrets: false
requireApprovalForFileOverwrite: false
requireApprovalForGitCommit: false
requireApprovalForShellCommands: false
skillOverrides: {}
`);

    serverInfo = await startDstackApiServer({
      projectRoot: tempDir,
      host: "127.0.0.1",
      port: 4574,
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
    // Clean up temp directory
    // Note: In real implementation, you'd want proper cleanup
  });

  async function makeAuthenticatedRequest(endpoint: string, options: RequestInit = {}): Promise<ApiEnvelope<unknown>> {
    const tokenPath = path.join(tempDir, tokenFile);
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

  function validateFrontendSafeDTO(data: ApiEnvelope<unknown>): void {
    // Ensure no absolute paths are exposed
    const dataString = JSON.stringify(data);
    expect(dataString).not.toMatch(/[A-Z]:[/\\]|[/\\]home[/\\]|[/\\]Users[/\\]|[/\\]var[/\\]|[/\\]etc[/\\]/);
    
    // Ensure no secrets are exposed
    expect(dataString).not.toMatch(/password|token|secret|key|credential/i);
    
    // Ensure proper ApiEnvelope structure
    expect(data).toHaveProperty('ok');
    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('warnings');
    expect(data).toHaveProperty('error');
    expect(data).toHaveProperty('meta');
  }

  test("start API server in temp workspace", async () => {
    expect(serverInfo.host).toBe("127.0.0.1");
    expect(serverInfo.port).toBe(4574);
    expect(serverInfo.baseUrl).toBe(baseUrl);
    
    // Verify server is responsive
    const healthResponse = await fetch(`${baseUrl}/v1/health`);
    expect(healthResponse.status).toBe(200);
  });

  test("POST /v1/skill-runs with fake provider for a safe skill", async () => {
    const requestBody = {
      skillName: 'list-skills', // Safe skill that doesn't require external calls
      command: 'run',
      inputs: {},
      flags: {
        force: false,
        dryRun: false,
        noStream: true,
        allowSecrets: false
      },
      requestSource: 'api' as const,
      actor: 'test-ui-seed'
    };

    const data = await makeAuthenticatedRequest('/v1/skill-runs', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    });
    
    expect(data.ok).toBe(true);
    validateFrontendSafeDTO(data);
    
    // Verify skill run was created successfully
    expect(data.data).toMatchObject({
      id: expect.any(String),
      skillName: 'list-skills',
      status: expect.any(String),
      verdict: expect.any(String),
      dryRun: false,
      runtimeStatus: expect.objectContaining({
        safetyMode: expect.any(String),
        deployFrozen: expect.any(Boolean),
        deployFreezeReason: expect.any(String)
      })
    });
    
    // Verify no live Gemini calls were made (would be indicated by provider)
    // In fake mode, everything should be simulated
    expect(data.data).not.toHaveProperty('liveApiCall');
  });

  test("fetch /v1/skill-runs", async () => {
    const data = await makeAuthenticatedRequest('/v1/skill-runs');
    
    expect(data.ok).toBe(true);
    validateFrontendSafeDTO(data);
    
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThan(0); // Should have the run we just created
    
    // Validate skill run DTO structure
    data.data.forEach((run: SkillRun) => {
      expect(run).toMatchObject({
        id: expect.any(String),
        skillName: expect.any(String),
        status: expect.any(String),
        verdict: expect.any(String),
        artifact: expect.any(Object),
        output: expect.any(Object),
        nextSkill: expect.any(String),
        warnings: expect.any(Array),
        blockers: expect.any(Array),
        runtimeStatus: expect.any(Object)
      });
      
      // Ensure no sensitive data
      expect(run).not.toHaveProperty('secrets');
      expect(run).not.toHaveProperty('absolutePaths');
    });
  });

  test("fetch /v1/artifacts", async () => {
    const data = await makeAuthenticatedRequest('/v1/artifacts');
    
    expect(data.ok).toBe(true);
    validateFrontendSafeDTO(data);
    
    expect(Array.isArray(data.data)).toBe(true);
    
    // Validate artifact DTO structure
    data.data.forEach((artifact: Artifact) => {
      expect(artifact).toMatchObject({
        id: expect.any(String),
        projectId: expect.any(String),
        skillName: expect.any(String),
        artifactType: expect.any(String),
        schemaVersion: expect.any(String),
        version: expect.any(String),
        createdAt: expect.any(String),
        isLatest: expect.any(Boolean),
        relativePath: expect.any(String),
        contentHash: expect.any(String),
        warnings: expect.any(Array),
        content: expect.any(Object)
      });
      
      // Ensure no absolute paths
      expect(artifact).not.toHaveProperty('absolutePath');
    });
  });

  test("fetch /v1/projects/current/workflow", async () => {
    const data = await makeAuthenticatedRequest('/v1/projects/current/workflow');
    
    expect(data.ok).toBe(true);
    validateFrontendSafeDTO(data);
    
    expect(data.data).toMatchObject({
      projectId: expect.any(String),
      computedAt: expect.any(String),
      currentStage: expect.any(String),
      nodes: expect.any(Array),
      edges: expect.any(Array),
      suggestedNextSkills: expect.any(Array),
      blockers: expect.any(Array),
      staleArtifacts: expect.any(Array)
    });
    
    // Validate workflow nodes
    data.data.nodes.forEach((node: WorkflowNode) => {
      expect(node).toMatchObject({
        id: expect.any(String),
        type: expect.any(String),
        label: expect.any(String)
      });
      expect(node).not.toHaveProperty('absolutePaths');
    });
  });

  test("fetch /v1/settings", async () => {
    const data = await makeAuthenticatedRequest('/v1/settings');
    
    expect(data.ok).toBe(true);
    validateFrontendSafeDTO(data);
    
    expect(data.data).toMatchObject({
      projectId: expect.any(String),
      projectRootDisplayPath: expect.any(String), // Relative path only
      dstackDirRelative: expect.any(String),
      allowAbsolutePaths: expect.any(Boolean),
      provider: expect.objectContaining({
        current: 'fake', // Should be fake in fake mode
        available: expect.any(Array),
        geminiConfigured: false,
        fakeAvailable: true,
        allowLive: false, // Should be false in fake mode
        defaultProvider: 'fake'
      }),
      model: expect.objectContaining({
        defaultModel: expect.any(String),
        proModel: expect.any(String),
        maxTokens: expect.any(Number),
        requestTimeoutMs: expect.any(Number),
        maxRetries: expect.any(Number),
        retryBaseDelayMs: expect.any(Number),
        maxToolCalls: expect.any(Number),
        skillOverrides: expect.any(Object)
      }),
      browserHeadless: expect.any(Boolean),
      allowSecrets: false, // Should always be false in API responses
      permissionDefaults: expect.objectContaining({
        requireApprovalForFileOverwrite: expect.any(Boolean),
        requireApprovalForGitCommit: expect.any(Boolean),
        requireApprovalForShellCommands: expect.any(Boolean)
      }),
      safetyMode: expect.objectContaining({
        mode: expect.any(String),
        blockedOperations: expect.any(Array),
        gatedOperations: expect.any(Array)
      }),
      freezeState: expect.objectContaining({
        frozen: expect.any(Boolean),
        reason: expect.any(String),
        scope: expect.any(String)
      }),
      apiServer: expect.objectContaining({
        host: expect.any(String),
        port: expect.any(Number),
        tokenFileRelative: expect.any(String),
        bindLocalOnly: expect.any(Boolean)
      })
    });
    
    // Security checks
    expect(data.data.allowSecrets).toBe(false);
    expect(data.data.provider.allowLive).toBe(false);
    expect(data.data.provider.current).toBe('fake');
    
    // Should not have absolute paths
    expect(data.data).not.toHaveProperty('projectRootAbsolutePath');
  });

  test("verify DTOs are frontend-safe", async () => {
    const endpoints = [
      '/v1/projects/current',
      '/v1/projects/current/config',
      '/v1/projects/current/workflow',
      '/v1/settings',
      '/v1/skills',
      '/v1/skill-runs',
      '/v1/artifacts'
    ];

    for (const endpoint of endpoints) {
      const data = await makeAuthenticatedRequest(endpoint);
      
      // Validate ApiEnvelope structure
      expect(data).toHaveProperty('ok');
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('warnings');
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('meta');
      
      // Validate meta structure
      expect(data.meta).toHaveProperty('requestId');
      expect(data.meta).toHaveProperty('timestamp');
      expect(data.meta).toHaveProperty('apiVersion');
      expect(data.meta.apiVersion).toBe('v1');
      
      // Validate frontend safety
      validateFrontendSafeDTO(data);
    }
  });

  test("no live Gemini call", async () => {
    // This test verifies that the fake mode doesn't make any live API calls
    // We can verify this by checking that all operations complete quickly
    // and that the provider is set to 'fake' in settings
    
    const settingsData = await makeAuthenticatedRequest('/v1/settings');
    expect(settingsData.data.provider.current).toBe('fake');
    expect(settingsData.data.provider.allowLive).toBe(false);
    expect(settingsData.data.provider.geminiConfigured).toBe(false);
    
    // Create a skill run and verify it completes quickly (indicating no live API call)
    const startTime = Date.now();
    
    const requestBody = {
      skillName: 'list-skills',
      command: 'run',
      inputs: {},
      flags: {
        force: false,
        dryRun: false,
        noStream: true,
        allowSecrets: false
      },
      requestSource: 'api' as const,
      actor: 'test-no-live-gemini'
    };

    const runData = await makeAuthenticatedRequest('/v1/skill-runs', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    expect(runData.ok).toBe(true);
    // Should complete quickly (under 2 seconds) since no live API call
    expect(duration).toBeLessThan(2000);
    
    // Verify the run data doesn't contain any live API call indicators
    expect(JSON.stringify(runData.data)).not.toMatch(/gemini|live|api.*key/i);
  });
});
