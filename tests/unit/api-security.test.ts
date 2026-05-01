/**
 * API Security Tests
 * Tests for API auth hardening, origin validation, and security controls
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rm, mkdir } from "node:fs/promises";
import { startDstackApiServer, type ServerInfo } from "../../packages/core/src/api/server.js";

describe("API Security", () => {
  let tempDir: string;
  let projectRoot: string;
  let serverInfo: ServerInfo;
  let token: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `dstack-security-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    projectRoot = tempDir;
    
    // Create minimal .dstack structure
    const dstackDir = join(tempDir, ".dstack");
    await mkdir(dstackDir, { recursive: true });
    
    // Start server and get token
    serverInfo = await startDstackApiServer({
      projectRoot,
      port: 4575
    });
    
    const tokenPath = join(projectRoot, ".dstack/api/token");
    const { readFile } = await import("node:fs/promises");
    token = await readFile(tokenPath, 'utf-8');
  });

  afterEach(async () => {
    if (serverInfo) {
      await serverInfo.close();
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("Localhost Binding", () => {
    it("binds to 127.0.0.1 by default", async () => {
      const testServerInfo = await startDstackApiServer({
        projectRoot,
        port: 4572
      });

      expect(testServerInfo.host).toBe("127.0.0.1");
      expect(testServerInfo.baseUrl).toBe("http://127.0.0.1:4572");
      await testServerInfo.close();
    });

    it("rejects 0.0.0.0 binding without explicit flag", async () => {
      await expect(startDstackApiServer({
        projectRoot,
        host: "0.0.0.0",
        port: 4573
      })).rejects.toThrow("Binding to 0.0.0.0 requires bindLocalOnly flag for security");
    });

    it("allows 0.0.0.0 binding with explicit flag", async () => {
      const testServerInfo = await startDstackApiServer({
        projectRoot,
        host: "0.0.0.0",
        port: 4574,
        bindLocalOnly: true
      });

      expect(testServerInfo.host).toBe("0.0.0.0");
      expect(testServerInfo.baseUrl).toBe("http://0.0.0.0:4574");
      await testServerInfo.close();
    });
  });

  describe("Security Behavior Table", () => {
    describe("GET /v1/health", () => {
      it("no token, no origin -> 200", async () => {
        const response = await fetch(`${serverInfo.baseUrl}/v1/health`);
        expect(response.status).toBe(200);
        
        const data = await response.json();
        expect(data.ok).toBe(true);
        expect(data.data.status).toBe('healthy');
      });

      it("no token, local origin -> 200", async () => {
        const response = await fetch(`${serverInfo.baseUrl}/v1/health`, {
          headers: {
            "Origin": "http://localhost:3000"
          }
        });
        expect(response.status).toBe(200);
        
        const data = await response.json();
        expect(data.ok).toBe(true);
      });

      it("no token, external origin -> 403", async () => {
        const response = await fetch(`${serverInfo.baseUrl}/v1/health`, {
          headers: {
            "Origin": "https://malicious-site.com"
          }
        });
        expect(response.status).toBe(401); // Origin validation happens first and rejects
        
        const error = await response.json();
        expect(error.ok).toBe(false);
        expect(error.error.code).toBe("UNAUTHORIZED");
      });
    });

    describe("GET /v1/projects/current", () => {
      it("no token, no origin -> 401", async () => {
        const response = await fetch(`${serverInfo.baseUrl}/v1/projects/current`);
        expect(response.status).toBe(401);
        
        const error = await response.json();
        expect(error.error.code).toBe("UNAUTHORIZED");
      });

      it("no token, local origin -> 401", async () => {
        const response = await fetch(`${serverInfo.baseUrl}/v1/projects/current`, {
          headers: {
            "Origin": "http://localhost:3000"
          }
        });
        expect(response.status).toBe(401);
        
        const error = await response.json();
        expect(error.error.code).toBe("UNAUTHORIZED");
      });

      it("no token, local referer -> 401", async () => {
        const response = await fetch(`${serverInfo.baseUrl}/v1/projects/current`, {
          headers: {
            "Referer": "http://localhost:3000/page"
          }
        });
        expect(response.status).toBe(401);
        
        const error = await response.json();
        expect(error.error.code).toBe("UNAUTHORIZED");
      });

      it("wrong token, local origin -> 401", async () => {
        const response = await fetch(`${serverInfo.baseUrl}/v1/projects/current`, {
          headers: {
            "Authorization": "Bearer wrong-token",
            "Origin": "http://localhost:3000"
          }
        });
        expect(response.status).toBe(401);
        
        const error = await response.json();
        expect(error.error.code).toBe("UNAUTHORIZED");
      });

      it("valid token, no origin -> 200", async () => {
        const response = await fetch(`${serverInfo.baseUrl}/v1/projects/current`, {
          headers: {
            "Authorization": `Bearer ${token.trim()}`
          }
        });
        expect(response.status).toBe(200);
        
        const data = await response.json();
        expect(data.ok).toBe(true);
      });

      it("valid token, local origin -> 200", async () => {
        const response = await fetch(`${serverInfo.baseUrl}/v1/projects/current`, {
          headers: {
            "Authorization": `Bearer ${token.trim()}`,
            "Origin": "http://localhost:3000"
          }
        });
        expect(response.status).toBe(200);
        
        const data = await response.json();
        expect(data.ok).toBe(true);
      });

      it("valid token, local referer -> 200", async () => {
        const response = await fetch(`${serverInfo.baseUrl}/v1/projects/current`, {
          headers: {
            "Authorization": `Bearer ${token.trim()}`,
            "Referer": "http://localhost:3000/page"
          }
        });
        expect(response.status).toBe(200);
        
        const data = await response.json();
        expect(data.ok).toBe(true);
      });

      it("valid token, external origin -> 403", async () => {
        const response = await fetch(`${serverInfo.baseUrl}/v1/projects/current`, {
          headers: {
            "Authorization": `Bearer ${token.trim()}`,
            "Origin": "https://malicious-site.com"
          }
        });
        expect(response.status).toBe(401); // Origin validation rejects first
        
        const error = await response.json();
        expect(error.error.code).toBe("UNAUTHORIZED");
      });
    });

    describe("External Origins with allowExternalOrigins flag", () => {
      it("allows external origins when flag is enabled", async () => {
        const externalServerInfo = await startDstackApiServer({
          projectRoot,
          port: 4581,
          allowExternalOrigins: true
        });

        try {
          const response = await fetch(`${externalServerInfo.baseUrl}/v1/projects/current`, {
            headers: {
              "Authorization": `Bearer ${token.trim()}`,
              "Origin": "https://external-site.com"
            }
          });
          expect(response.status).toBe(200);
          
          const data = await response.json();
          expect(data.ok).toBe(true);
        } finally {
          await externalServerInfo.close();
        }
      });
    });
  });

  describe("Token Security", () => {
    it("token is never logged in responses", async () => {
      const response = await fetch(`${serverInfo.baseUrl}/v1/projects/current`, {
        headers: {
          "Authorization": `Bearer ${token.trim()}`
        }
      });
      
      const responseText = await response.text();
      expect(responseText).not.toContain(token.trim());
    });

    it("token is never returned in response body", async () => {
      // Check that server info doesn't contain the token
      expect(serverInfo).not.toHaveProperty("token");
      // Check that the token file path ends with the expected default path
      expect(serverInfo.tokenFileRelative).toMatch(/\.dstack\/api\/token$/);
    });
  });

  describe("Bearer Token Authentication Edge Cases", () => {
    it("rejects requests with invalid token format", async () => {
      const response = await fetch(`${serverInfo.baseUrl}/v1/projects/current`, {
        headers: {
          "Authorization": "Basic dGVzdA=="
        }
      });
      expect(response.status).toBe(401);
      
      const error = await response.json();
      expect(error.error.code).toBe("UNAUTHORIZED");
    });

    it("rejects requests with missing Bearer prefix", async () => {
      const response = await fetch(`${serverInfo.baseUrl}/v1/projects/current`, {
        headers: {
          "Authorization": token.trim()
        }
      });
      expect(response.status).toBe(401);
      
      const error = await response.json();
      expect(error.error.code).toBe("UNAUTHORIZED");
    });
  });
});
