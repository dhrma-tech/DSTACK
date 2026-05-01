/**
 * Authentication middleware for DStack API
 * Handles bearer token validation and security
 */

import { randomBytes } from "node:crypto";
import { readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage } from "node:http";
import type { Contracts } from "@dstack/shared";

export interface AuthOptions {
  tokenFile: string;
  projectRoot: string;
}

export class ApiAuth {
  private readonly tokenPath: string;
  private readonly tokenFileRelative: string;

  constructor(options: AuthOptions) {
    this.tokenPath = path.resolve(options.projectRoot, options.tokenFile);
    this.tokenFileRelative = options.tokenFile;
  }

  async generateOrReadToken(): Promise<string> {
    // Ensure token directory exists
    const tokenDir = path.dirname(this.tokenPath);
    await this.ensureDirectoryExists(tokenDir);
    
    // Try to read existing token
    let token = await this.readToken();
    if (!token) {
      token = this.generateToken();
      await this.writeToken(token);
    }
    
    return token;
  }

  async validateToken(req: IncomingMessage): Promise<{ valid: boolean; error?: Contracts.ApiEnvelope }> {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return {
        valid: false,
        error: this.createAuthError(401, 'MISSING_TOKEN', 'Authorization Bearer token required')
      };
    }
    
    if (!authHeader.startsWith('Bearer ')) {
      return {
        valid: false,
        error: this.createAuthError(401, 'INVALID_TOKEN_FORMAT', 'Authorization must be in format: Bearer <token>')
      };
    }
    
    const token = authHeader.slice(7); // Remove 'Bearer ' prefix
    const expectedToken = await this.readToken();
    
    if (!expectedToken || token !== expectedToken) {
      return {
        valid: false,
        error: this.createAuthError(401, 'INVALID_TOKEN', 'Invalid or expired token')
      };
    }
    
    return { valid: true };
  }

  private createAuthError(statusCode: number, code: string, message: string): Contracts.ApiEnvelope {
    return {
      ok: false,
      data: null,
      warnings: [],
      error: {
        code,
        message,
        retryable: false,
        requestId: randomBytes(16).toString('hex')
      },
      meta: {
        requestId: randomBytes(16).toString('hex'),
        timestamp: new Date().toISOString(),
        apiVersion: 'v1'
      }
    };
  }

  private async readToken(): Promise<string | null> {
    try {
      await access(this.tokenPath);
      return await readFile(this.tokenPath, 'utf-8');
    } catch {
      // File doesn't exist or can't be read
    }
    return null;
  }

  private async writeToken(token: string): Promise<void> {
    await writeFile(this.tokenPath, token, 'utf-8');
  }

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    const { mkdir } = await import('node:fs/promises');
    try {
      await mkdir(dirPath, { recursive: true });
    } catch {
      // Directory might already exist
    }
  }

  getTokenFileRelative(): string {
    return this.tokenFileRelative;
  }
}
