/**
 * Test helper for API server management
 * Provides utilities for starting and stopping test servers with dynamic ports
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { startDstackApiServer } from "../../packages/core/src/api/server.js";

export interface TestServer {
  baseUrl: string;
  token: string;
  close: () => Promise<void>;
  projectRoot: string;
}

export async function createTestServer(): Promise<TestServer> {
  // Create temporary workspace
  const tempDir = path.join(tmpdir(), `dstack-test-${Date.now()}-${Math.random()}`);
  
  // Create .dstack directory
  await mkdir(path.join(tempDir, '.dstack'), { recursive: true });
  await mkdir(path.join(tempDir, '.dstack', 'api'), { recursive: true });
  
  // Initialize basic project structure
  await writeFile(path.join(tempDir, '.dstack', 'config.yml'), `
provider: fake
defaultModel: fake-model
proModel: fake-pro-model
maxTokens: 1000
requestTimeoutMs: 30000
maxRetries: 3
retryBaseDelayMs: 1000
maxToolCalls: 10
browserHeadless: true
allowSecrets: false
requireApprovalForFileOverwrite: false
requireApprovalForGitCommit: false
requireApprovalForShellCommands: false
`);

  // Create test token
  const tokenFile = path.join(tempDir, '.dstack', 'api', 'token');
  await writeFile(tokenFile, 'test-token-' + Date.now());

  // Start server on dynamic port
  const serverInfo = await startDstackApiServer({
    projectRoot: tempDir,
    host: "127.0.0.1",
    port: 0, // Use dynamic port allocation
    tokenFile: ".dstack/api/token",
    allowAbsolutePaths: false,
    bindLocalOnly: true,
    allowExternalOrigins: false
  });

  // Read the token
  const { readFile } = await import('node:fs/promises');
  const token = await readFile(tokenFile, 'utf-8');

  return {
    baseUrl: serverInfo.baseUrl,
    token,
    close: serverInfo.close,
    projectRoot: tempDir
  };
}
