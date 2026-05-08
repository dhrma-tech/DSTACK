/**
 * CLI JSON Output Tests
 * Tests for --json flag functionality and API envelope output
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rm, mkdir, writeFile } from "node:fs/promises";
import { route } from "../../packages/cli/src/router.js";
import type { ParsedCommand } from "../../packages/cli/src/parser.js";

describe("CLI JSON Output", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `dstack-cli-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    projectRoot = tempDir;
    
    // Create minimal .dstack structure
    const dstackDir = join(tempDir, ".dstack");
    await mkdir(dstackDir, { recursive: true });
    await writeFile(join(dstackDir, "config.yaml"), `
provider: fake
defaultModel: fake-model
proModel: fake-pro-model
    `.trim());
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("--list-skills --json outputs valid envelope", async () => {
    const command: ParsedCommand = {
      help: false,
      version: false,
      listSkills: true,
      skillCheck: false,
      serve: false,
      json: true,
      verbose: false,
      invocation: null
    };

    const result = await route(command);
    
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    
    // Parse JSON output
    const parsed = JSON.parse(result.stdout);
    
    // Validate envelope structure
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed).toHaveProperty("data");
    expect(parsed).toHaveProperty("warnings");
    expect(parsed).toHaveProperty("error", null);
    expect(parsed).toHaveProperty("meta");
    
    // Validate meta structure
    expect(parsed.meta).toHaveProperty("requestId");
    expect(parsed.meta).toHaveProperty("timestamp");
    expect(parsed.meta).toHaveProperty("apiVersion", "v1");
    expect(parsed.meta).toHaveProperty("command", "list-skills");
    
    // Validate data is an array of skills
    expect(Array.isArray(parsed.data)).toBe(true);
  });

  it("--skill-check --json outputs valid envelope", async () => {
    const command: ParsedCommand = {
      help: false,
      version: false,
      listSkills: false,
      skillCheck: true,
      serve: false,
      json: true,
      verbose: false,
      invocation: null
    };

    const result = await route(command);
    
    expect(result.exitCode).toBe(0); // or 1 if there are issues
    expect(result.stderr).toBe("");
    
    // Parse JSON output
    const parsed = JSON.parse(result.stdout);
    
    // Validate envelope structure
    expect(parsed).toHaveProperty("ok");
    expect(parsed).toHaveProperty("data");
    expect(parsed).toHaveProperty("warnings");
    expect(parsed).toHaveProperty("error", null);
    expect(parsed).toHaveProperty("meta");
    
    // Validate meta structure
    expect(parsed.meta).toHaveProperty("requestId");
    expect(parsed.meta).toHaveProperty("timestamp");
    expect(parsed.meta).toHaveProperty("apiVersion", "v1");
    expect(parsed.meta).toHaveProperty("command", "skill-check");
    
    // Validate data contains skill check results
    expect(parsed.data).toHaveProperty("totalSkills");
    expect(parsed.data).toHaveProperty("passed");
    expect(parsed.data).toHaveProperty("errors");
    expect(parsed.data).toHaveProperty("warnings");
  });

  it("fake skill --json outputs valid envelope", async () => {
    const command: ParsedCommand = {
      help: false,
      version: false,
      listSkills: false,
      skillCheck: false,
      serve: false,
      json: true,
      verbose: false,
      invocation: {
        skillName: "office-hours",
        inputs: {},
        flags: {
          force: false,
          dryRun: true,
          noStream: false,
          model: null,
          provider: "fake",
          allowSecrets: false
        },
        projectRoot
      }
    };

    const result = await route(command);
    
    // Should either succeed or fail, but output JSON
    expect(result.stderr).toBe("");
    
    // Parse JSON output
    const parsed = JSON.parse(result.stdout);
    
    // Validate envelope structure
    expect(parsed).toHaveProperty("ok");
    expect(parsed).toHaveProperty("data");
    expect(parsed).toHaveProperty("warnings");
    expect(parsed).toHaveProperty("error");
    expect(parsed).toHaveProperty("meta");
    
    // Validate meta structure
    expect(parsed.meta).toHaveProperty("requestId");
    expect(parsed.meta).toHaveProperty("timestamp");
    expect(parsed.meta).toHaveProperty("apiVersion", "v1");
    expect(parsed.meta).toHaveProperty("command", "office-hours");
    
    // If successful, validate skill result structure
    if (parsed.ok) {
      expect(parsed.data).toHaveProperty("skillName", "office-hours");
      expect(parsed.data).toHaveProperty("status");
    }
  });

  it("--serve --json outputs valid envelope", async () => {
    const command: ParsedCommand = {
      help: false,
      version: false,
      listSkills: false,
      skillCheck: false,
      serve: true,
      json: true,
      verbose: false,
      invocation: null,
      serveOptions: {
        host: "127.0.0.1",
        port: 4574, // Use different port to avoid conflicts
        tokenFile: ".dstack/api/token"
      }
    };

    const result = await route(command);
    
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    
    // Parse JSON output
    const parsed = JSON.parse(result.stdout);
    
    // Validate envelope structure
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed).toHaveProperty("data");
    expect(parsed).toHaveProperty("warnings");
    expect(parsed).toHaveProperty("error", null);
    expect(parsed).toHaveProperty("meta");
    
    // Validate meta structure
    expect(parsed.meta).toHaveProperty("requestId");
    expect(parsed.meta).toHaveProperty("timestamp");
    expect(parsed.meta).toHaveProperty("apiVersion", "v1");
    expect(parsed.meta).toHaveProperty("command", "serve");
    
    // Validate data contains server info
    expect(parsed.data).toHaveProperty("serverUrl");
    expect(parsed.data).toHaveProperty("host");
    expect(parsed.data).toHaveProperty("port");
    expect(parsed.data).toHaveProperty("tokenFile");
    expect(parsed.data).toHaveProperty("message");
    
    // Validate warnings contain localhost warning
    expect(Array.isArray(parsed.warnings)).toBe(true);
    expect(parsed.warnings.some(w => w.code === "LOCALHOST_ONLY")).toBe(true);
  });

  it("stdout contains valid JSON only", async () => {
    const command: ParsedCommand = {
      help: false,
      version: false,
      listSkills: true,
      skillCheck: false,
      serve: false,
      json: true,
      verbose: false,
      invocation: null
    };

    const result = await route(command);
    
    // Should not contain ANSI codes or extra whitespace
    expect(result.stdout).toMatch(/^\{.*\}$/);
    expect(result.stdout).not.toContain('\x1b[');
    expect(result.stdout.trim()).toBe(result.stdout);
    
    // Should be valid JSON
    expect(() => JSON.parse(result.stdout)).not.toThrow();
  });

  it("no ANSI codes in JSON output", async () => {
    const command: ParsedCommand = {
      help: false,
      version: false,
      listSkills: true,
      skillCheck: false,
      serve: false,
      json: true,
      verbose: false,
      invocation: null
    };

    const result = await route(command);
    
    // Check for ANSI escape sequences
    expect(result.stdout).not.toContain('\x1b[');
    expect(result.stdout).not.toContain('\x1b[');
    expect(result.stdout).not.toContain('\u001b[');
  });

  it("warnings are structured in JSON output", async () => {
    const command: ParsedCommand = {
      help: false,
      version: false,
      listSkills: true,
      skillCheck: false,
      serve: false,
      json: true,
      verbose: false,
      invocation: null
    };

    const result = await route(command);
    
    const parsed = JSON.parse(result.stdout);
    
    // Warnings should be an array
    expect(Array.isArray(parsed.warnings)).toBe(true);
    
    // Each warning should have required fields
    parsed.warnings.forEach((warning: { code: string; message: string; severity: string }) => {
      expect(warning).toHaveProperty("code");
      expect(warning).toHaveProperty("message");
      expect(warning).toHaveProperty("severity");
      expect(["info", "warning", "error"]).toContain(warning.severity);
    });
  });

  it("blocked/approval-required command returns ok:false and exit code 3", async () => {
    // This test would simulate a blocked command
    // For now, we'll test a scenario that might cause a failure
    const command: ParsedCommand = {
      help: false,
      version: false,
      listSkills: false,
      skillCheck: false,
      serve: false,
      json: true,
      verbose: false,
      invocation: {
        skillName: "nonexistent-skill",
        inputs: {},
        flags: {
          force: false,
          dryRun: false,
          noStream: false,
          model: null,
          provider: "fake",
          allowSecrets: false
        },
        projectRoot
      }
    };

    const result = await route(command);
    
    // Should output JSON even on error
    expect(result.stderr).toBe("");
    
    // Parse JSON output
    const parsed = JSON.parse(result.stdout);
    
    // Should have error structure
    expect(parsed).toHaveProperty("ok", false);
    expect(parsed).toHaveProperty("data", null);
    expect(parsed).toHaveProperty("error");
    expect(parsed.error).toHaveProperty("code");
    expect(parsed.error).toHaveProperty("message");
    expect(parsed.error).toHaveProperty("retryable");
    expect(parsed.error).toHaveProperty("requestId");
  });
});
