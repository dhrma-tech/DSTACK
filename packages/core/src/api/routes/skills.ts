/**
 * Skills API routes
 * Handles skill listing and execution with security controls
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Contracts, JsonValue, SkillManifest } from "@dstack/shared";
import { SkillExecutor, SkillRegistry, defaultConfig } from "@dstack/core";
import { sendApiSuccess, sendApiError, NotFoundError, ForbiddenError } from "../errors.js";

interface SkillWithMetadata extends SkillManifest {
  maturity?: "complete" | "partial" | "experimental";
  [key: string]: unknown;
}

// High-risk skills that should be hidden by default
const HIDDEN_SKILLS = new Set([
  "pair-agent",
  "setup-browser-cookies", 
  "skillify",
  "dstack-upgrade",
  "make-pdf",
  "canary",
  "design-html"
]);

export class SkillsRoutes {
  private readonly executor: SkillExecutor;
  private readonly registry: SkillRegistry;

  constructor(private projectRoot: string, options: { allowSecrets?: boolean; allowAbsolutePaths?: boolean } = {}) {
    // Create a proper config using defaultConfig
    const config = defaultConfig(this.projectRoot);
    config.allowSecrets = options.allowSecrets ?? false;
    
    this.executor = new SkillExecutor({ config, interactive: false });
    this.registry = new SkillRegistry();
  }

  async handleListSkills(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string
  ): Promise<void> {
    try {
      const includeHidden = url.searchParams.get('includeHidden') === 'true';
      const includeExperimental = url.searchParams.get('includeExperimental') === 'true';
      
      const skills = await this.executor.listSkills();
      const filteredSkills = this.filterSkills(skills as SkillWithMetadata[], includeHidden, includeExperimental);
      
      // Convert to Skill DTO format
      const skillDtos: Contracts.Skill[] = filteredSkills.map(skill => ({
        name: skill.name,
        command: skill.name,
        description: skill.description,
        stage: "unknown", // TODO: Determine from skill metadata
        maturity: skill.maturity ?? "complete",
        handlerType: "model", // TODO: Determine from skill metadata
        registered: true,
        available: true,
        hidden: HIDDEN_SKILLS.has(skill.name),
        model: "fake", // TODO: Get from skill config
        streaming: false, // TODO: Get from skill config
        allowedTools: [], // TODO: Get from skill metadata
        requiresArtifacts: [], // TODO: Get from skill metadata
        artifactPath: "", // TODO: Get from skill metadata
        hasLatestArtifact: false, // TODO: Check artifact store
        lastRunAt: null // TODO: Get from run store
      }));
      
      sendApiSuccess(res, skillDtos, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }

  async handleRunSkill(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string
  ): Promise<void> {
    try {
      // Parse skill name from URL
      const pathMatch = url.pathname.match(/^\/v1\/skills\/(.+)\/run$/);
      if (!pathMatch) {
        throw new NotFoundError('Invalid skill run endpoint');
      }
      
      const skillName = pathMatch[1];
      
      // Check if skill is hidden
      if (skillName && HIDDEN_SKILLS.has(skillName)) {
        const allowUnsafe = url.searchParams.get('allowUnsafe') === 'true';
        if (!allowUnsafe) {
          throw new ForbiddenError(`Skill '${skillName}' is hidden and requires allowUnsafe flag`);
        }
      }
      
      // Read request body for inputs
      let inputs: Record<string, unknown> = {};
      if (req.method === 'POST') {
        const body = await this.readRequestBody(req);
        const { inputs: parsedInputs } = JSON.parse(body);
        inputs = parsedInputs;
      }
      
      // Execute skill
      const result = await this.executor.run({
        skillName: skillName || '',
        inputs: inputs as Record<string, JsonValue>,
        flags: {
          force: false,
          dryRun: false,
          noStream: true,
          model: null,
          provider: "fake",
          allowSecrets: false,
          jsonEvents: false
        },
        projectRoot: this.projectRoot
      });
      
      // Convert to API format
      const runResult: Contracts.SkillRunResult = {
        runId: `run-${Date.now()}`, // Generate proper run ID
        skillName: result.skillName as string,
        status: result.status as Contracts.SkillRunStatus,
        verdict: result.verdict as "PASS" | "REVISE" | "FAIL" | null,
        artifact: result.artifactPath ? {
          id: result.artifactPath,
          projectId: "temp-project-id",
          skillName: result.skillName as string,
          artifactType: "output",
          schemaVersion: "1.0",
          version: "1.0",
          createdAt: new Date().toISOString(),
          isLatest: true,
          relativePath: result.artifactPath,
          contentHash: "hash",
          warnings: [],
          content: {}
        } : null,
        output: result.output as Record<string, JsonValue> | null,
        nextSkill: result.nextSkill as string | null,
        warnings: (result.warnings as string[]) || [],
        blockers: [],
        runtimeStatus: {
          safetyMode: "NORMAL",
          deployFrozen: false,
          deployFreezeReason: null
        },
        toolCalls: [],
        provider: "fake",
        model: "fake-model"
      };
      
      sendApiSuccess(res, runResult, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }

  async handleGetSkill(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string
  ): Promise<void> {
    try {
      const pathParts = url.pathname.split('/');
      const skillName = pathParts[pathParts.length - 1]; // /v1/skills/:name
      
      if (!skillName) {
        throw new Error('Skill name is required');
      }

      // Get all skills and find the specific one
      const skills = await this.executor.listSkills();
      const skill = (skills as SkillWithMetadata[]).find(s => s.name === skillName);
      
      if (!skill) {
        throw new NotFoundError(`Skill ${skillName} not found`);
      }

      // Check if skill is hidden/experimental and not explicitly allowed
      const includeHidden = url.searchParams.get('includeHidden') === 'true';
      const includeExperimental = url.searchParams.get('includeExperimental') === 'true';
      
      if (!includeHidden && HIDDEN_SKILLS.has(skill.name)) {
        throw new Error(`Skill ${skillName} is hidden`);
      }
      
      if (!includeExperimental && skill.maturity === 'experimental') {
        throw new Error(`Skill ${skillName} is experimental`);
      }

      // Convert to SkillManifestSummary format
      const skillSummary: Contracts.SkillManifestSummary = {
        name: skill.name,
        command: "run", // Default command
        description: skill.description,
        triggerPhrases: skill.triggerPhrases,
        model: skill.model,
        streaming: skill.streaming,
        inputs: skill.inputs,
        allowedTools: skill.allowedTools,
        requiresArtifacts: skill.requiresArtifacts,
        artifactPath: skill.artifactPath || "",
        nextSkill: skill.nextSkill || null,
        outputSchemaVersion: "1.0",
        maturity: skill.maturity || 'complete',
        acceptanceCriteria: [],
        failureCases: []
      };
      
      sendApiSuccess(res, skillSummary, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }

  private filterSkills(
    skills: SkillWithMetadata[],
    includeHidden: boolean, 
    includeExperimental: boolean
  ): SkillWithMetadata[] {
    return skills.filter(skill => {
      // Hide hidden skills unless explicitly requested
      if (!includeHidden && HIDDEN_SKILLS.has(skill.name)) {
        return false;
      }
      
      // Hide experimental skills unless explicitly requested
      if (!includeExperimental && skill.maturity === 'experimental') {
        return false;
      }
      
      return true;
    });
  }

  private async readRequestBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        body += chunk.toString();
      });
      req.on('end', () => {
        resolve(body);
      });
      req.on('error', reject);
    });
  }
}
