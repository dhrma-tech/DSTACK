/**
 * Artifacts API routes
 * Handles artifact listing, retrieval, and diff operations
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Contracts, JsonValue } from "@dstack/shared";
import { ArtifactService } from "../../services/artifact-service.js";
import { sendApiSuccess, sendApiError, NotFoundError, ValidationError } from "../errors.js";

export class ArtifactsRoutes {
  private readonly artifactService: ArtifactService;

  constructor(private projectRoot: string, private options: { allowSecrets?: boolean; allowAbsolutePaths?: boolean } = {}) {
    const serviceOptions: { projectRoot: string; allowSecrets?: boolean; allowAbsolutePaths?: boolean } = {
      projectRoot,
      ...(options.allowSecrets !== undefined && { allowSecrets: options.allowSecrets }),
      ...(options.allowAbsolutePaths !== undefined && { allowAbsolutePaths: options.allowAbsolutePaths })
    };
    this.artifactService = new ArtifactService(serviceOptions);
  }

  async handleListArtifacts(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string
  ): Promise<void> {
    try {
      const skillName = url.searchParams.get('skillName');
      const limit = url.searchParams.get('limit');
      const includeContent = url.searchParams.get('includeContent') === 'true';
      const includeAbsolutePaths = url.searchParams.get('includeAbsolutePaths') === 'true';

      // Get all artifacts and filter by skill name if provided
      const artifacts = await this.artifactService.listArtifacts(limit ? parseInt(limit, 10) : 100);
      
      let filteredArtifacts = skillName 
        ? artifacts.filter(artifact => artifact.skillName === skillName)
        : artifacts;

      // Filter latest only if requested
      if (url.searchParams.get('latestOnly') === 'true') {
        const latestBySkill = new Map<string, Contracts.Artifact>();
        filteredArtifacts.forEach(artifact => {
          const existing = latestBySkill.get(artifact.skillName);
          if (!existing || new Date(artifact.createdAt) > new Date(existing.createdAt)) {
            latestBySkill.set(artifact.skillName, artifact);
          }
        });
        filteredArtifacts = Array.from(latestBySkill.values());
      }

      // Remove content if not requested
      if (!includeContent) {
        filteredArtifacts = filteredArtifacts.map(artifact => ({
          ...artifact,
          content: {} as Record<string, JsonValue>
        }));
      }

      // Remove absolute paths if not requested
      if (!includeAbsolutePaths) {
        filteredArtifacts = filteredArtifacts.map(artifact => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { absolutePath, ...rest } = artifact;
          return rest;
        });
      }

      sendApiSuccess(res, filteredArtifacts, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }

  async handleGetLatestArtifact(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string
  ): Promise<void> {
    try {
      const pathParts = url.pathname.split('/');
      const skillName = pathParts[pathParts.length - 2]; // /artifacts/:skillName/latest

      if (!skillName) {
        throw new ValidationError('Skill name is required');
      }

      // Get all artifacts for the skill and find the latest one
      const artifacts = await this.artifactService.listArtifacts(100);
      const skillArtifacts = artifacts.filter(artifact => artifact.skillName === skillName);
      
      if (skillArtifacts.length === 0) {
        sendApiSuccess(res, null, requestId);
        return;
      }

      // Find the latest artifact
      const latestArtifact = skillArtifacts.reduce((latest, current) => 
        new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest
      );

      sendApiSuccess(res, latestArtifact, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }

  async handleGetArtifactVersions(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string
  ): Promise<void> {
    try {
      const pathParts = url.pathname.split('/');
      const skillName = pathParts[pathParts.length - 2]; // /artifacts/:skillName/versions

      if (!skillName) {
        throw new ValidationError('Skill name is required');
      }

      // Get all artifacts for the skill and convert to versions
      const artifacts = await this.artifactService.listArtifacts(100);
      const skillArtifacts = artifacts.filter(artifact => artifact.skillName === skillName);
      
      // Convert to ArtifactVersion format
      const versions: Contracts.ArtifactVersion[] = skillArtifacts.map(artifact => {
        const version: Contracts.ArtifactVersion = {
          artifactId: artifact.id,
          skillName: artifact.skillName,
          version: artifact.version,
          createdAt: artifact.createdAt,
          relativePath: artifact.relativePath,
          contentHash: artifact.contentHash,
          sizeBytes: artifact.content ? JSON.stringify(artifact.content).length : null,
          isLatest: artifact.isLatest,
          schemaVersion: artifact.schemaVersion
        };
        
        // Only add absolutePath if it exists
        if (artifact.absolutePath) {
          version.absolutePath = artifact.absolutePath;
        }
        
        // Only add verdict if it exists
        if (artifact.verdict) {
          version.verdict = artifact.verdict;
        }
        
        return version;
      });

      sendApiSuccess(res, versions, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }

  async handleGetArtifactDiff(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string
  ): Promise<void> {
    try {
      const pathParts = url.pathname.split('/');
      const skillName = pathParts[pathParts.length - 2]; // /artifacts/:skillName/diff

      if (!skillName) {
        throw new ValidationError('Skill name is required');
      }

      const fromVersion = url.searchParams.get('from');
      const toVersion = url.searchParams.get('to');

      if (!fromVersion || !toVersion) {
        throw new ValidationError('Both "from" and "to" parameters are required');
      }

      // Get artifacts for the skill
      const artifacts = await this.artifactService.listArtifacts(100);
      const skillArtifacts = artifacts.filter(artifact => artifact.skillName === skillName);
      
      // Find the specific versions
      const fromArtifact = skillArtifacts.find(a => a.version === fromVersion);
      const toArtifact = skillArtifacts.find(a => a.version === toVersion);

      if (!fromArtifact || !toArtifact) {
        throw new NotFoundError('Artifact version not found');
      }

      // Create a simple diff (basic implementation)
      const fromKeys = new Set(Object.keys(fromArtifact.content || {}));
      const toKeys = new Set(Object.keys(toArtifact.content || {}));
      
      const addedKeys = Array.from(toKeys).filter(key => !fromKeys.has(key));
      const removedKeys = Array.from(fromKeys).filter(key => !toKeys.has(key));
      const modifiedKeys = Array.from(fromKeys).filter(key => 
        toKeys.has(key) && 
        JSON.stringify(fromArtifact.content![key]) !== JSON.stringify(toArtifact.content![key])
      );

      const diff: Contracts.ArtifactDiff = {
        skillName,
        fromVersion,
        toVersion,
        changed: addedKeys.length > 0 || removedKeys.length > 0 || modifiedKeys.length > 0,
        summary: `${addedKeys.length} added, ${removedKeys.length} removed, ${modifiedKeys.length} modified`,
        addedKeys,
        removedKeys,
        modifiedKeys,
        patchPreview: [] // TODO: Implement actual patch preview
      };

      sendApiSuccess(res, diff, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }
}
