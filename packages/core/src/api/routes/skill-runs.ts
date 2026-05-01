/**
 * Skill Runs API routes
 * Handles skill run listing, creation, and retrieval
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Contracts, JsonValue } from "@dstack/shared";
import { RunService } from "../../services/run-service.js";
import { sendApiSuccess, sendApiError, NotFoundError, ValidationError, HiddenSkillError } from "../errors.js";

export class SkillRunsRoutes {
  private readonly runService: RunService;

  constructor(private projectRoot: string, private options: { allowSecrets?: boolean; allowAbsolutePaths?: boolean } = {}) {
    const serviceOptions: { projectRoot: string; allowSecrets?: boolean; allowAbsolutePaths?: boolean } = {
      projectRoot,
      ...(options.allowSecrets !== undefined && { allowSecrets: options.allowSecrets }),
      ...(options.allowAbsolutePaths !== undefined && { allowAbsolutePaths: options.allowAbsolutePaths })
    };
    this.runService = new RunService(serviceOptions);
  }

  async handleListSkillRuns(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string
  ): Promise<void> {
    try {
      const skillName = url.searchParams.get('skillName');
      const status = url.searchParams.get('status') as Contracts.SkillRunStatus | null;
      const limit = url.searchParams.get('limit');
      const includeResult = url.searchParams.get('includeResult') === 'true';

      // Use the existing RunService methods
      const runs = await this.runService.getSkillRuns(
        skillName || undefined,
        limit ? parseInt(limit, 10) : 10
      );

      // Filter by status if provided
      const filteredRuns = status 
        ? runs.filter(run => run.status === status)
        : runs;

      // Remove result if not requested
      const finalRuns = includeResult 
        ? filteredRuns 
        : filteredRuns.map(run => ({ ...run, result: undefined }));

      sendApiSuccess(res, finalRuns, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }

  async handleGetSkillRun(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string
  ): Promise<void> {
    try {
      const pathParts = url.pathname.split('/');
      const runId = pathParts[pathParts.length - 1];

      if (!runId) {
        throw new ValidationError('Run ID is required');
      }

      const run = await this.runService.getSkillRun(runId);
      if (!run) {
        throw new NotFoundError(`Skill run ${runId} not found`);
      }

      sendApiSuccess(res, run, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }

  async handleCreateSkillRun(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string
  ): Promise<void> {
    try {
      // Parse request body
      const body = await this.parseRequestBody(req);
      
      // Validate request body
      if (!body || typeof body !== 'object') {
        throw new ValidationError('Invalid request body');
      }

      const { skillName, inputs = {}, flags = {}, providerOverride, modelOverride } = body as {
        skillName?: string;
        inputs?: Record<string, JsonValue>;
        flags?: Contracts.SkillRunRequest['flags'];
        providerOverride?: Contracts.SkillRunRequest['providerOverride'];
        modelOverride?: Contracts.SkillRunRequest['modelOverride'];
      };

      if (!skillName || typeof skillName !== 'string') {
        throw new ValidationError('skillName is required and must be a string');
      }

      // Check if skill is hidden
      const HIDDEN_SKILLS = new Set([
        "pair-agent",
        "setup-browser-cookies", 
        "skillify",
        "dstack-upgrade",
        "make-pdf",
        "canary",
        "design-html",
        "hidden-admin-skill"
      ]);

      if (HIDDEN_SKILLS.has(skillName)) {
        throw new HiddenSkillError(`Hidden skill '${skillName}' cannot be executed via API`);
      }

      // Create run request using RunService
      const runRequest = await this.runService.createRunRequest(skillName, inputs);
      
      // Merge flags from request
      const mergedFlags = {
        ...runRequest.flags,
        ...flags,
        noStream: true // Always use noStream for API requests
      };

      // Update the run request with merged flags and provider overrides
      const finalRequest: Contracts.SkillRunRequest = {
        ...runRequest,
        flags: mergedFlags,
        ...(providerOverride && { providerOverride }),
        ...(modelOverride && { modelOverride }),
        requestSource: "api" as const,
        actor: "api-client"
      };

      // Get the run ID from the created run (need to find it in the store)
      const runs = await this.runService.getSkillRuns(skillName, 1);
      const createdRun = runs[0];

      if (!createdRun) {
        throw new Error('Failed to create run record');
      }

      // Update the run record with the final flags (including dryRun)
      // This is needed because createRunRequest creates the record with default flags
      await this.runService.updateRunRecord(createdRun.id, { request: finalRequest });

      // Execute the skill (this will update the run in the store)
      try {
        await this.runService.executeSkill(finalRequest);
      } catch (error) {
        // Execution failed, but the run was created, so return the current state
        console.error('Skill execution failed:', error);
      }

      // Get the updated run using the run ID
      const run = await this.runService.getSkillRun(createdRun.id);
      
      sendApiSuccess(res, run, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }

  private async parseRequestBody(req: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          if (body) {
            resolve(JSON.parse(body));
          } else {
            resolve(null);
          }
        } catch (error) {
          reject(new ValidationError(`Invalid JSON in request body: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      });
      req.on('error', reject);
    });
  }
}
