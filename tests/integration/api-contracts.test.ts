/**
 * API Contracts Integration Tests
 * Tests that API endpoints return proper ApiEnvelope responses with correct contract types
 */

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createTestServer } from "../helpers/api-server.js";
import type { ApiEnvelope } from "../../packages/shared/src/contracts.js";

describe("API Contracts Integration Tests", () => {
  let testServer: Awaited<ReturnType<typeof createTestServer>>;

  beforeAll(async () => {
    testServer = await createTestServer();
  });

  afterAll(async () => {
    if (testServer) {
      await testServer.close();
    }
  });

  async function makeAuthenticatedRequest(endpoint: string): Promise<ApiEnvelope<unknown>> {
    const response = await fetch(`${testServer.baseUrl}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${testServer.token.trim()}`
      }
    });

    return response.json();
  }

  function validateApiEnvelope(data: ApiEnvelope<unknown>, expectedDataShape?: Record<string, unknown>) {
    expect(data).toHaveProperty('ok');
    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('warnings');
    expect(data).toHaveProperty('error');
    expect(data).toHaveProperty('meta');
    
    expect(data.meta).toHaveProperty('requestId');
    expect(data.meta).toHaveProperty('timestamp');
    expect(data.meta).toHaveProperty('apiVersion');
    expect(data.meta.apiVersion).toBe('v1');
    
    if (expectedDataShape) {
      expect(data.data).toMatchObject(expectedDataShape);
    }
  }

  test("GET /v1/projects/current returns ApiEnvelope<Project>", async () => {
    const data = await makeAuthenticatedRequest('/v1/projects/current');
    
    validateApiEnvelope(data);
    expect(data.ok).toBe(true);
    expect(data.error).toBe(null);
    
    // Validate Project contract structure
    expect(data.data).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      rootDisplayPath: expect.any(String),
      dstackDirRelative: expect.any(String),
      workflowStage: expect.any(String),
      updatedAt: expect.any(String),
      provider: expect.objectContaining({
        current: expect.any(String),
        available: expect.any(Array),
        geminiConfigured: expect.any(Boolean),
        fakeAvailable: expect.any(Boolean),
        allowLive: expect.any(Boolean),
        defaultProvider: expect.any(String)
      }),
      safetyMode: expect.objectContaining({
        mode: expect.any(String),
        blockedOperations: expect.any(Array),
        gatedOperations: expect.any(Array)
      }),
      freezeState: expect.objectContaining({
        frozen: expect.any(Boolean),
        scope: expect.any(String)
      }),
      artifactCounts: expect.objectContaining({
        total: expect.any(Number),
        latest: expect.any(Number),
        stale: expect.any(Number)
      }),
      learningCount: expect.any(Number)
    });
  });

  test("GET /v1/projects/current/config returns ApiEnvelope<ProjectConfig>", async () => {
    const data = await makeAuthenticatedRequest('/v1/projects/current/config');
    
    validateApiEnvelope(data);
    expect(data.ok).toBe(true);
    expect(data.error).toBe(null);
    
    // Validate ProjectConfig contract structure
    expect(data.data).toMatchObject({
      projectId: expect.any(String),
      dstackVersion: expect.any(String),
      providerName: expect.any(String),
      defaultModel: expect.any(String),
      proModel: expect.any(String),
      maxTokens: expect.any(Number),
      requestTimeoutMs: expect.any(Number),
      maxRetries: expect.any(Number),
      retryBaseDelayMs: expect.any(Number),
      maxToolCalls: expect.any(Number),
      browserHeadless: expect.any(Boolean),
      allowSecrets: expect.any(Boolean),
      requireApprovalForFileOverwrite: expect.any(Boolean),
      requireApprovalForGitCommit: expect.any(Boolean),
      requireApprovalForShellCommands: expect.any(Boolean),
      skillOverrides: expect.any(Object),
      apiServer: expect.objectContaining({
        host: expect.any(String),
        port: expect.any(Number),
        tokenFileRelative: expect.any(String),
        bindLocalOnly: expect.any(Boolean)
      })
    });
  });

  test("GET /v1/projects/current/workflow returns ApiEnvelope<WorkflowGraph>", async () => {
    const data = await makeAuthenticatedRequest('/v1/projects/current/workflow');
    
    validateApiEnvelope(data);
    expect(data.ok).toBe(true);
    expect(data.error).toBe(null);
    
    // Validate WorkflowGraph contract structure
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
  });

  test("GET /v1/projects/current/learnings returns ApiEnvelope<LearningEntry[]>", async () => {
    const data = await makeAuthenticatedRequest('/v1/projects/current/learnings');
    
    validateApiEnvelope(data);
    expect(data.ok).toBe(true);
    expect(data.error).toBe(null);
    
    // Should be an array (possibly empty)
    expect(Array.isArray(data.data)).toBe(true);
    
    // If there are entries, validate their structure
    if (data.data.length > 0) {
      expect(data.data[0]).toMatchObject({
        id: expect.any(String),
        timestamp: expect.any(String),
        type: expect.any(String),
        content: expect.any(Object)
      });
    }
  });

  test("GET /v1/projects/current/taste-profile returns ApiEnvelope<TasteProfile>", async () => {
    const data = await makeAuthenticatedRequest('/v1/projects/current/taste-profile');
    
    validateApiEnvelope(data);
    expect(data.ok).toBe(true);
    expect(data.error).toBe(null);
    
    // Validate TasteProfile contract structure
    expect(data.data).toMatchObject({
      projectId: expect.any(String),
      updatedAt: expect.any(String),
      entries: expect.any(Array),
      weights: expect.any(Array),
      topPreferences: expect.any(Array)
    });
  });

  test("GET /v1/settings returns ApiEnvelope<Settings>", async () => {
    const data = await makeAuthenticatedRequest('/v1/settings');
    
    validateApiEnvelope(data);
    expect(data.ok).toBe(true);
    expect(data.error).toBe(null);
    
    // Validate Settings contract structure
    expect(data.data).toMatchObject({
      projectId: expect.any(String),
      projectRootDisplayPath: expect.any(String),
      dstackDirRelative: expect.any(String),
      allowAbsolutePaths: expect.any(Boolean),
      provider: expect.objectContaining({
        current: expect.any(String),
        available: expect.any(Array),
        geminiConfigured: expect.any(Boolean),
        fakeAvailable: expect.any(Boolean),
        allowLive: expect.any(Boolean),
        defaultProvider: expect.any(String)
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
      allowSecrets: expect.any(Boolean), // Should be false for security
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
        scope: expect.any(String)
      }),
      apiServer: expect.objectContaining({
        host: expect.any(String),
        port: expect.any(Number),
        tokenFileRelative: expect.any(String),
        bindLocalOnly: expect.any(Boolean)
      })
    });
    
    // Security check: allowSecrets should be false in API responses
    expect(data.data.allowSecrets).toBe(false);
  });

  test("All responses include required ApiEnvelope fields", async () => {
    const endpoints = [
      '/v1/projects/current',
      '/v1/projects/current/config',
      '/v1/projects/current/workflow',
      '/v1/projects/current/learnings',
      '/v1/projects/current/taste-profile',
      '/v1/settings'
    ];

    for (const endpoint of endpoints) {
      const data = await makeAuthenticatedRequest(endpoint);
      
      // Validate all required ApiEnvelope fields
      expect(data).toHaveProperty('ok');
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('warnings');
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('meta');
      
      // Validate meta fields
      expect(data.meta).toHaveProperty('requestId');
      expect(data.meta).toHaveProperty('timestamp');
      expect(data.meta).toHaveProperty('apiVersion');
      expect(data.meta.apiVersion).toBe('v1');
      
      // Validate timestamp format
      expect(new Date(data.meta.timestamp)).toBeInstanceOf(Date);
      
      // Validate requestId format
      expect(typeof data.meta.requestId).toBe('string');
      expect(data.meta.requestId.length).toBeGreaterThan(0);
    }
  });
});
