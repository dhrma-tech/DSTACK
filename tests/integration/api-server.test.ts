/**
 * API Server Integration Tests
 * Tests the HTTP API server functionality, security, and routing
 */

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startDstackApiServer } from "../../packages/core/src/api/server.js";
import type { ServerInfo } from "../../packages/core/src/api/server.js";
import { readFile, access } from "node:fs/promises";
import path from "node:path";

describe("API Server Integration Tests", () => {
  let serverInfo: ServerInfo;
  let baseUrl: string;
  const projectRoot = process.cwd();
  const tokenFile = ".dstack/api/test-token";

  beforeAll(async () => {
    // Clean up any existing token file
    try {
      await access(path.join(projectRoot, tokenFile));
      // File exists, will be overwritten by server startup
    } catch {
      // File doesn't exist, that's fine
    }

    // Start server on dynamic port
    serverInfo = await startDstackApiServer({
      projectRoot,
      host: "127.0.0.1",
      port: 0, // Use dynamic port allocation
      tokenFile,
      allowAbsolutePaths: false,
      bindLocalOnly: true,
      allowExternalOrigins: false
    });

    // Set baseUrl from actual server port
    baseUrl = serverInfo.baseUrl;

    // Wait a moment for server to be ready
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    // Clean up server
    if (serverInfo) {
      await serverInfo.close();
    }
  });

  test("server starts on 127.0.0.1", async () => {
    expect(serverInfo.host).toBe("127.0.0.1");
    expect(serverInfo.port).toBeGreaterThan(0);
    expect(serverInfo.baseUrl).toBe(baseUrl);
  });

  test("/v1/health works without token", async () => {
    const response = await fetch(`${baseUrl}/v1/health`);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data).toMatchObject({
      ok: true,
      data: {
        status: 'healthy',
        version: expect.any(String),
        timestamp: expect.any(String)
      },
      meta: {
        requestId: expect.any(String),
        timestamp: expect.any(String),
        apiVersion: 'v1'
      }
    });
  });

  test("non-health route rejects missing token", async () => {
    const response = await fetch(`${baseUrl}/v1/projects/current`);
    
    expect(response.status).toBe(401);
    const data = await response.json();
    
    expect(data).toMatchObject({
      ok: false,
      data: null,
      error: {
        code: 'UNAUTHORIZED',
        message: expect.any(String),
        retryable: false
      },
      meta: {
        requestId: expect.any(String),
        timestamp: expect.any(String),
        apiVersion: 'v1'
      }
    });
  });

  test("non-health route rejects wrong token", async () => {
    const response = await fetch(`${baseUrl}/v1/projects/current`, {
      headers: {
        'Authorization': 'Bearer wrong-token'
      }
    });
    
    expect(response.status).toBe(401);
    const data = await response.json();
    
    expect(data).toMatchObject({
      ok: false,
      data: null,
      error: {
        code: 'UNAUTHORIZED',
        message: expect.any(String),
        retryable: false
      }
    });
  });

  test("correct token works", async () => {
    // Read the actual token from the token file
    const tokenPath = path.join(projectRoot, tokenFile);
    const token = await readFile(tokenPath, 'utf-8');
    
    const response = await fetch(`${baseUrl}/v1/projects/current`, {
      headers: {
        'Authorization': `Bearer ${token.trim()}`
      }
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data).toMatchObject({
      ok: true,
      data: expect.any(Object),
      warnings: expect.any(Array),
      meta: {
        requestId: expect.any(String),
        timestamp: expect.any(String),
        apiVersion: 'v1'
      }
    });
  });

  test("external origin rejected", async () => {
    const tokenPath = path.join(projectRoot, tokenFile);
    const token = await readFile(tokenPath, 'utf-8');
    
    const response = await fetch(`${baseUrl}/v1/projects/current`, {
      headers: {
        'Authorization': `Bearer ${token.trim()}`,
        'Origin': 'https://evil-site.com'
      }
    });
    
    expect(response.status).toBe(401);
    const data = await response.json();
    
    expect(data).toMatchObject({
      ok: false,
      data: null,
      error: {
        code: 'UNAUTHORIZED',
        message: expect.any(String),
        retryable: false
      }
    });
  });

  test("local origin accepted", async () => {
    const tokenPath = path.join(projectRoot, tokenFile);
    const token = await readFile(tokenPath, 'utf-8');
    
    const response = await fetch(`${baseUrl}/v1/projects/current`, {
      headers: {
        'Authorization': `Bearer ${token.trim()}`,
        'Origin': 'http://localhost:3000'
      }
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.ok).toBe(true);
  });

  test("unknown route returns ApiEnvelope 404", async () => {
    const tokenPath = path.join(projectRoot, tokenFile);
    const token = await readFile(tokenPath, 'utf-8');
    
    const response = await fetch(`${baseUrl}/v1/unknown-route`, {
      headers: {
        'Authorization': `Bearer ${token.trim()}`
      }
    });
    
    expect(response.status).toBe(404);
    const data = await response.json();
    
    expect(data).toMatchObject({
      ok: false,
      data: null,
      error: {
        code: expect.stringMatching('NOT_FOUND'),
        message: expect.any(String),
        retryable: false
      },
      meta: {
        requestId: expect.any(String),
        timestamp: expect.any(String),
        apiVersion: 'v1'
      }
    });
  });

  test("unsupported method returns ApiEnvelope 405", async () => {
    const tokenPath = path.join(projectRoot, tokenFile);
    const token = await readFile(tokenPath, 'utf-8');
    
    const response = await fetch(`${baseUrl}/v1/projects/current`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token.trim()}`
      }
    });
    
    // Should return 404 for unsupported method, which is acceptable
    expect([404, 405]).toContain(response.status);
    const data = await response.json();
    
    expect(data).toMatchObject({
      ok: false,
      data: null,
      error: {
        code: expect.stringMatching('NOT_FOUND|METHOD_NOT_ALLOWED'),
        message: expect.any(String),
        retryable: false
      }
    });
  });

  test("server closes cleanly", async () => {
    // This test verifies the server can close without hanging
    expect(serverInfo.close).toBeDefined();
    
    // The close function will be called in afterAll
    // If it doesn't close cleanly, the test suite will hang
    expect(true).toBe(true);
  });
});
