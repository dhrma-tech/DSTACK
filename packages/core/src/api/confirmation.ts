/**
 * Confirmation Token System
 * Implements confirmation-token model for dangerous actions
 */

import { randomBytes, createHash } from "node:crypto";
import { readFile, writeFile, access, mkdir, unlink, readdir } from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Contracts } from "@dstack/shared";
import { sendApiError, sendApiSuccess, BadRequestError, ForbiddenError } from "./errors.js";

// Dangerous actions that require confirmation
const DANGEROUS_ACTIONS = new Set([
  "deploy-production",
  "shell-execute",
  "git-write",
  "git-commit",
  "file-overwrite",
  "browser-external",
  "dstack-upgrade",
  "skillify-enable"
]);

export interface ConfirmationRequest {
  actionType: string;
  payloadHash: string;
  expiresAt: string;
  singleUse: boolean;
  createdAt: string;
}

export interface ConfirmationToken {
  id: string;
  actionType: string;
  payloadHash: string;
  expiresAt: string;
  singleUse: boolean;
  createdAt: string;
  usedAt?: string;
}

export class ConfirmationManager {
  private readonly confirmationDir: string;

  constructor(private projectRoot: string) {
    this.confirmationDir = path.join(projectRoot, ".dstack", "confirmations");
  }

  async generateConfirmation(
    actionType: string,
    payload: Record<string, unknown>,
    expiresInMinutes: number = 15
  ): Promise<Contracts.ConfirmationToken> {
    if (!DANGEROUS_ACTIONS.has(actionType)) {
      throw new BadRequestError(`Action '${actionType}' does not require confirmation`);
    }

    await this.ensureConfirmationDir();

    const payloadHash = this.hashPayload(payload);
    const tokenId = this.generateTokenId();
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();
    const createdAt = new Date().toISOString();

    const token: ConfirmationToken = {
      id: tokenId,
      actionType,
      payloadHash,
      expiresAt,
      singleUse: true,
      createdAt
    };

    await this.storeToken(token);

    return {
      tokenId,
      actionType,
      payloadHash,
      expiresAt,
      singleUse: true,
      createdAt,
      message: `Confirmation required for ${actionType}`,
      instructions: `Include this token in your request: ${tokenId}`
    };
  }

  async validateConfirmation(
    tokenId: string,
    actionType: string,
    payload: Record<string, unknown>
  ): Promise<boolean> {
    try {
      const token = await this.loadToken(tokenId);
      if (!token) {
        return false;
      }

      // Check if token is expired
      if (new Date() > new Date(token.expiresAt)) {
        await this.deleteToken(tokenId);
        return false;
      }

      // Check if token is already used
      if (token.usedAt) {
        return false;
      }

      // Check action type matches
      if (token.actionType !== actionType) {
        return false;
      }

      // Check payload hash matches
      const currentPayloadHash = this.hashPayload(payload);
      if (token.payloadHash !== currentPayloadHash) {
        return false;
      }

      // Mark token as used
      token.usedAt = new Date().toISOString();
      await this.storeToken(token);

      return true;
    } catch {
      return false;
    }
  }

  private async ensureConfirmationDir(): Promise<void> {
    try {
      await access(this.confirmationDir);
    } catch {
      await mkdir(this.confirmationDir, { recursive: true });
    }
  }

  private generateTokenId(): string {
    return randomBytes(32).toString('hex');
  }

  private hashPayload(payload: Record<string, unknown>): string {
    const payloadString = JSON.stringify(payload, Object.keys(payload).sort());
    return createHash('sha256').update(payloadString).digest('hex');
  }

  private async storeToken(token: ConfirmationToken): Promise<void> {
    const tokenPath = path.join(this.confirmationDir, `${token.id}.json`);
    await writeFile(tokenPath, JSON.stringify(token, null, 2));
  }

  private async loadToken(tokenId: string): Promise<ConfirmationToken | null> {
    const tokenPath = path.join(this.confirmationDir, `${tokenId}.json`);
    try {
      const data = await readFile(tokenPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  private async deleteToken(tokenId: string): Promise<void> {
    const tokenPath = path.join(this.confirmationDir, `${tokenId}.json`);
    try {
      await unlink(tokenPath);
    } catch {
      // Token file doesn't exist, ignore
    }
  }

  async cleanupExpiredTokens(): Promise<void> {
    try {
      const files = await readdir(this.confirmationDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const tokenPath = path.join(this.confirmationDir, file);
          try {
            const data = await readFile(tokenPath, 'utf-8');
            const token: ConfirmationToken = JSON.parse(data);
            
            if (new Date() > new Date(token.expiresAt)) {
              await unlink(tokenPath);
            }
          } catch {
            // Invalid token file, remove it
            await unlink(tokenPath);
          }
        }
      }
    } catch {
      // Directory doesn't exist or other error, ignore
    }
  }
}

export async function handleConfirmationRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  requestId: string,
  confirmationManager: ConfirmationManager
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new BadRequestError('Confirmation requests must use POST method');
    }

    const body = await readRequestBody(req);
    const { actionType, payload, expiresInMinutes } = JSON.parse(body);

    if (!actionType || !payload) {
      throw new BadRequestError('actionType and payload are required');
    }

    const token = await confirmationManager.generateConfirmation(
      actionType,
      payload,
      expiresInMinutes
    );

    sendApiSuccess(res, token, requestId);
  } catch (error) {
    sendApiError(res, error as Error, requestId);
  }
}

export async function validateConfirmationForRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  requestId: string,
  actionType: string,
  payload: Record<string, unknown>,
  confirmationManager: ConfirmationManager
): Promise<boolean> {
  const tokenId = url.searchParams.get('confirmationToken');
  
  if (!tokenId) {
    sendApiError(res, new ForbiddenError(`Confirmation token required for ${actionType}`), requestId);
    return false;
  }

  const isValid = await confirmationManager.validateConfirmation(tokenId, actionType, payload);
  
  if (!isValid) {
    sendApiError(res, new ForbiddenError('Invalid or expired confirmation token'), requestId);
    return false;
  }

  return true;
}

async function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      resolve(body);
    });
    req.on('error', reject);
  });
}
