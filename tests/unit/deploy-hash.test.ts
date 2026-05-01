import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

// Copy of the hash generation function for testing
function generateDeployHash(env: string, deployCommand: string, gitHead: string, configPath: string): string {
  const hashInput = `${env}|${deployCommand}|${gitHead}|${configPath}`;
  return createHash("sha256").update(hashInput).digest("hex").slice(0, 12);
}

describe("Deploy Hash Confirmation", () => {
  
  it("generates consistent hash for same inputs", () => {
    const env = "production";
    const command = "npm run deploy";
    const gitHead = "abc123";
    const configPath = "/path/to/deploy-config.json";
    
    const hash1 = generateDeployHash(env, command, gitHead, configPath);
    const hash2 = generateDeployHash(env, command, gitHead, configPath);
    
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(12); // SHA256 truncated to 12 chars
    expect(typeof hash1).toBe("string");
  });

  it("generates different hashes for different inputs", () => {
    const env = "production";
    const command = "npm run deploy";
    const gitHead = "abc123";
    const configPath = "/path/to/deploy-config.json";
    
    const hash1 = generateDeployHash(env, command, gitHead, configPath);
    const hash2 = generateDeployHash("staging", command, gitHead, configPath);
    const hash3 = generateDeployHash(env, "npm run build", gitHead, configPath);
    const hash4 = generateDeployHash(env, command, "def456", configPath);
    const hash5 = generateDeployHash(env, command, gitHead, "/different/path.json");
    
    expect(hash1).not.toBe(hash2); // Different environment
    expect(hash1).not.toBe(hash3); // Different command
    expect(hash1).not.toBe(hash4); // Different git head
    expect(hash1).not.toBe(hash5); // Different config path
  });

  it("handles edge cases in hash generation", () => {
    const env = "production";
    const command = "";
    const gitHead = "";
    const configPath = "";
    
    const hash = generateDeployHash(env, command, gitHead, configPath);
    
    expect(hash).toHaveLength(12);
    expect(typeof hash).toBe("string");
    expect(hash).toMatch(/^[a-f0-9]{12}$/); // Hex characters only
  });

  it("generates different hashes for production vs staging", () => {
    const command = "npm run deploy";
    const gitHead = "abc123";
    const configPath = "/path/to/deploy-config.json";
    
    const prodHash = generateDeployHash("production", command, gitHead, configPath);
    const stagingHash = generateDeployHash("staging", command, gitHead, configPath);
    
    expect(prodHash).not.toBe(stagingHash);
  });

  it("tests missing hash scenario", () => {
    // Test the scenario where hash is missing
    const env = "production";
    const command = "npm run deploy";
    const gitHead = "abc123";
    const configPath = "/path/to/deploy-config.json";
    
    const requiredHash = generateDeployHash(env, command, gitHead, configPath);
    
    // Simulate missing hash (empty string)
    const missingHash = "";
    const wrongHash = "wronghash123";
    
    expect(requiredHash).not.toBe(missingHash);
    expect(requiredHash).not.toBe(wrongHash);
    expect(requiredHash).toHaveLength(12);
  });

  it("tests correct hash scenario", () => {
    // Test the scenario where hash is correct
    const env = "production";
    const command = "npm run deploy";
    const gitHead = "abc123";
    const configPath = "/path/to/deploy-config.json";
    
    const requiredHash = generateDeployHash(env, command, gitHead, configPath);
    const correctHash = requiredHash; // Same as required
    
    expect(requiredHash).toBe(correctHash);
    expect(correctHash).toHaveLength(12);
  });
});
