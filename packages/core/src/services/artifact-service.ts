/**
 * Artifact service for frontend-ready artifact information
 * Provides DTO-compatible data without console output
 */

import path from "node:path";
import { ArtifactStore } from "../artifacts/store.js";
import type { Contracts } from "@dstack/shared";

export interface ServiceOptions {
  projectRoot: string;
  allowSecrets?: boolean;
  allowAbsolutePaths?: boolean;
}

export class ArtifactService {
  private readonly artifactStore: ArtifactStore;

  constructor(private readonly options: ServiceOptions) {
    this.artifactStore = new ArtifactStore({
      dstackDir: path.join(options.projectRoot, ".dstack"),
      projectRoot: options.projectRoot,
      allowAbsolutePaths: options.allowAbsolutePaths ?? false
    });
  }

  /**
   * Get artifact by ID
   */
  async getArtifact(artifactId: string): Promise<Contracts.Artifact | null> {
    return await this.artifactStore.getArtifact(artifactId);
  }

  /**
   * Get artifact versions
   */
  async getArtifactVersions(artifactId: string): Promise<Contracts.ArtifactVersion[]> {
    return await this.artifactStore.getArtifactVersions(artifactId);
  }

  /**
   * Get artifact diff
   */
  async getArtifactDiff(artifactId: string, fromVersion?: string, toVersion?: string): Promise<Contracts.ArtifactDiff | null> {
    return await this.artifactStore.getArtifactDiff(artifactId, fromVersion, toVersion);
  }

  /**
   * List artifacts
   */
  async listArtifacts(limit = 100): Promise<Contracts.Artifact[]> {
    return await this.artifactStore.listArtifacts(limit);
  }

  /**
   * Create artifact
   */
  async createArtifact(name: string, content: unknown): Promise<Contracts.Artifact> {
    // Convert content to JsonObject
    const jsonObject = content as Record<string, unknown>;
    if (typeof jsonObject !== 'object' || jsonObject === null) {
      throw new Error("Artifact content must be a valid JSON object");
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await this.artifactStore.createArtifact("unknown", name, jsonObject as Record<string, unknown> as Record<string, any>);
  }

  /**
   * Update artifact
   */
  async updateArtifact(artifactId: string, updates: Partial<Contracts.Artifact>): Promise<Contracts.Artifact> {
    // For now, create a new version of the artifact
    const existing = await this.artifactStore.getArtifact(artifactId);
    if (!existing) {
      throw new Error(`Artifact ${artifactId} not found`);
    }
    
    // Merge content updates
    const updatedContent = { ...existing.content, ...(updates.content || {}) };
    return await this.artifactStore.createArtifact(existing.skillName, existing.id, updatedContent);
  }

  /**
   * Delete artifact
   */
  async deleteArtifact(): Promise<void> {
    // TODO: Implement artifact deletion - for now just throw error
    throw new Error("Artifact deletion not yet implemented");
  }
}
