/**
 * Deploy API routes
 * Handles deploy configuration, runs, freeze state, and approval
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Contracts } from "@dstack/shared";
import { DeployService } from "../../services/deploy-service.js";
import { sendApiSuccess, sendApiError, BadRequestError, ForbiddenError, NotFoundError, MissingParameterError, InvalidHashError } from "../errors.js";
import type { ConfirmationManager } from "../confirmation.js";
import { validateConfirmationForRequest } from "../confirmation.js";

export class DeployRoutes {
  private readonly deployService: DeployService;
  private readonly confirmationManager: ConfirmationManager;

  constructor(
    private projectRoot: string,
    config: Record<string, unknown>,
    confirmationManager: ConfirmationManager
  ) {
    this.deployService = new DeployService({
      projectRoot,
      allowSecrets: false,
      allowAbsolutePaths: false
    });
    this.confirmationManager = confirmationManager;
  }

  async handleGetDeployConfig(
    req: IncomingMessage, 
    res: ServerResponse, 
    requestId: string
  ): Promise<void> {
    try {
      const config = await this.deployService.getDeployConfig();
      sendApiSuccess(res, config, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }

  async handleListDeployRuns(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string
  ): Promise<void> {
    try {
      const environment = url.searchParams.get('environment');
      const limit = url.searchParams.get('limit');

      const runs = await this.deployService.getDeployRuns();
      
      // Filter by environment if provided
      const filteredRuns = environment 
        ? runs.filter(run => run.environment === environment)
        : runs;

      // Apply limit if provided
      const finalRuns = limit 
        ? filteredRuns.slice(0, parseInt(limit, 10))
        : filteredRuns;

      sendApiSuccess(res, finalRuns, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }

  async handleGetDeployFreeze(
    req: IncomingMessage, 
    res: ServerResponse, 
    requestId: string
  ): Promise<void> {
    try {
      const freezeState = await this.deployService.getFreezeState();
      sendApiSuccess(res, freezeState, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }

  async handleApproveDeploy(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string
  ): Promise<void> {
    try {
      const body = await this.readRequestBody(req);
      const { environment, confirmHash } = JSON.parse(body);

      if (!environment) {
        throw new MissingParameterError('environment is required');
      }

      if (!confirmHash) {
        throw new MissingParameterError('confirmHash is required');
      }

      // Validate deploy hash format
      if (!this.isValidDeployHash(confirmHash)) {
        throw new InvalidHashError('Invalid deploy hash format');
      }

      // Store approval state (basic implementation)
      const approvalResult = await this.storeDeployApproval(environment, confirmHash);

      const apiResult: Contracts.DeployApproval = {
        approvalId: approvalResult.approvalId,
        environment,
        deployHash: confirmHash,
        approvedAt: new Date().toISOString(),
        expiresAt: approvalResult.expiresAt,
        status: 'approved'
      };

      sendApiSuccess(res, apiResult, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }

  async handleDeployRequest(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string
  ): Promise<void> {
    try {
      if (req.method !== 'POST') {
        throw new BadRequestError('Deploy requests must use POST method');
      }

      const body = await this.readRequestBody(req);
      const { environment, deployHash, inputs } = JSON.parse(body);

      if (!environment) {
        throw new BadRequestError('environment is required');
      }

      // Production deploy requires hash confirmation
      if (environment === 'production') {
        if (!deployHash) {
          const approvalError = {
            code: 'DEPLOY_APPROVAL_REQUIRED',
            message: 'Production deploy requires typed hash confirmation',
            requiresHash: true,
            instructions: 'Generate a deploy hash and include it in your request'
          };
          sendApiError(res, new ForbiddenError(approvalError.message), requestId);
          return;
        }

        // Validate deploy hash format
        if (!this.isValidDeployHash(deployHash || '')) {
          throw new BadRequestError('Invalid deploy hash format');
        }

        // Check if confirmation is required for dangerous deploy
        const deployPayload = { environment, deployHash: deployHash || '', inputs };
        const isConfirmed = await validateConfirmationForRequest(
          req,
          res,
          url,
          requestId,
          'deploy-production',
          deployPayload,
          this.confirmationManager
        );

        if (!isConfirmed) {
          return; // Error already sent by validateConfirmationForRequest
        }
      }

      // Execute deploy
      const deployResult = await this.executeDeploy();

      // Convert to API format
      const apiResult: Contracts.DeployResult = {
        deployId: `deploy-${Date.now()}`,
        environment,
        status: deployResult.success ? 'success' : 'failed',
        deployHash: deployHash || null,
        deployedAt: new Date().toISOString(),
        artifacts: (deployResult.artifacts as string[]) || [],
        warnings: (deployResult.warnings as string[]) || [],
        error: (deployResult.error as string | null) || null
      };

      sendApiSuccess(res, apiResult, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }

  async handleDeployApproval(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string
  ): Promise<void> {
    try {
      if (req.method !== 'POST') {
        throw new BadRequestError('Deploy approval requests must use POST method');
      }

      const body = await this.readRequestBody(req);
      const { environment, deployHash, inputs } = JSON.parse(body);

      if (environment !== 'production') {
        throw new BadRequestError('Deploy approval is only required for production environment');
      }

      if (!deployHash) {
        throw new BadRequestError('deployHash is required for approval');
      }

      // Validate deploy hash format
      if (!this.isValidDeployHash(deployHash)) {
        throw new BadRequestError('Invalid deploy hash format');
      }

      // Store approval state
      const approvalResult = await this.storeDeployApproval(environment, deployHash || '', inputs);

      const apiResult: Contracts.DeployApproval = {
        approvalId: approvalResult.approvalId,
        environment,
        deployHash,
        approvedAt: new Date().toISOString(),
        expiresAt: approvalResult.expiresAt,
        status: 'approved'
      };

      sendApiSuccess(res, apiResult, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }

  async handleDeployStatus(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string
  ): Promise<void> {
    try {
      const pathMatch = url.pathname.match(/^\/v1\/deploy\/([^/]+)\/status$/);
      if (!pathMatch) {
        throw new NotFoundError('Invalid deploy status endpoint');
      }

      const deployId = pathMatch[1];
      
      // Get deploy status
      const deployStatus = await this.getDeployStatus(deployId || '');

      if (!deployStatus) {
        throw new NotFoundError(`Deploy ${deployId} not found`);
      }

      const apiResult: Contracts.DeployStatus = {
        deployId: deployId || '',
        environment: deployStatus.environment as string,
        status: deployStatus.status as 'pending' | 'running' | 'success' | 'failed',
        startedAt: deployStatus.startedAt as string | null,
        completedAt: deployStatus.completedAt as string | null,
        progress: (deployStatus.progress as number) || 0,
        artifacts: (deployStatus.artifacts as string[]) || [],
        warnings: (deployStatus.warnings as string[]) || [],
        error: (deployStatus.error as string | null) || null
      };

      sendApiSuccess(res, apiResult, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }

  private async executeDeploy(): Promise<Record<string, unknown>> {
    try {
      // For now, return a mock deploy result since DeployService doesn't have a deploy method
      // TODO: Implement proper deploy execution when DeployService supports it
      return {
        success: true,
        error: null,
        warnings: [],
        artifacts: [`deploy-${Date.now()}.tar.gz`]
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown deploy error',
        warnings: [],
        artifacts: []
      };
    }
  }

  private async storeDeployApproval(
    _environment: string,
    _deployHash: string,
    _inputs?: Record<string, unknown>
  ): Promise<{ approvalId: string; expiresAt: string }> {
    const approvalId = `approval-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    // Store approval in .dstack/deploy-approvals/
    const approvalData = {
      approvalId,
      environment: _environment,
      deployHash: _deployHash,
      inputs: _inputs || {},
      approvedAt: new Date().toISOString(),
      expiresAt
    };

    const { writeFile, mkdir } = await import('node:fs/promises');
    const path = await import('node:path');
    
    const approvalDir = path.join(this.projectRoot, '.dstack', 'deploy-approvals');
    await mkdir(approvalDir, { recursive: true });
    
    const approvalFile = path.join(approvalDir, `${approvalId}.json`);
    await writeFile(approvalFile, JSON.stringify(approvalData, null, 2));

    return { approvalId, expiresAt };
  }

  private async getDeployStatus(_deployId: string): Promise<Record<string, unknown> | null> {
    try {
      const { readFile } = await import('node:fs/promises');
      const path = await import('node:path');
      
      const deployFile = path.join(this.projectRoot, '.dstack', 'deploys', `${_deployId}.json`);
      const data = await readFile(deployFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  private isValidDeployHash(deployHash: string): boolean {
    // Deploy hash should be a SHA-256 hash (64 hex characters)
    return /^[a-f0-9]{64}$/i.test(deployHash);
  }

  private async readRequestBody(req: IncomingMessage): Promise<string> {
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
}
