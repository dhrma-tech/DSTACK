/**
 * API Authentication Tests
 * Tests for bearer token validation and security
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rm, mkdir } from "node:fs/promises";
import { ApiAuth } from "../../packages/core/src/api/auth.js";
import type { IncomingMessage } from "node:http";

describe("ApiAuth", () => {
  let auth: ApiAuth;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `dstack-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    auth = new ApiAuth({
      tokenFile: "test-token",
      projectRoot: tempDir
    });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("generates token if missing", async () => {
    const token = await auth.generateOrReadToken();
    
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    expect(token.length).toBe(64); // 32 bytes * 2 hex chars
  });

  it("reads existing token", async () => {
    const originalToken = await auth.generateOrReadToken();
    const readToken = await auth.generateOrReadToken();
    
    expect(readToken).toBe(originalToken);
  });

  it("rejects missing Authorization header", async () => {
    const req = {
      headers: {}
    } as IncomingMessage;
    
    const result = await auth.validateToken(req);
    
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.error?.code).toBe("MISSING_TOKEN");
  });

  it("rejects wrong token format", async () => {
    const req = {
      headers: {
        authorization: "Basic dGVzdA=="
      }
    } as IncomingMessage;
    
    const result = await auth.validateToken(req);
    
    expect(result.valid).toBe(false);
    expect(result.error?.error?.code).toBe("INVALID_TOKEN_FORMAT");
  });

  it("rejects invalid token", async () => {
    const req = {
      headers: {
        authorization: "Bearer invalid-token"
      }
    } as IncomingMessage;
    
    const result = await auth.validateToken(req);
    
    expect(result.valid).toBe(false);
    expect(result.error?.error?.code).toBe("INVALID_TOKEN");
  });

  it("accepts correct token", async () => {
    const token = await auth.generateOrReadToken();
    
    const req = {
      headers: {
        authorization: `Bearer ${token}`
      }
    } as IncomingMessage;
    
    const result = await auth.validateToken(req);
    
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns token file relative path", () => {
    const relativePath = auth.getTokenFileRelative();
    expect(relativePath).toBe("test-token");
  });
});
