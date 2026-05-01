/**
 * ArtifactStore - Storage and indexing for artifact files
 * Reads existing .dstack/artifacts/<skill>/latest.json and timestamped versions
 */

import path from "node:path";
import fs from "node:fs/promises";
import { ensureDir, exists, readJsonFile, fileSafeTimestamp, shortHash, nowIso } from "../utils.js";
import type { Contracts } from "@dstack/shared";
import type { JsonValue, JsonObject } from "@dstack/shared";

export interface ArtifactStoreOptions {
  dstackDir: string;
  projectRoot: string;
  allowAbsolutePaths?: boolean;
}

export interface LatestArtifact {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  content: JsonObject;
  metadata?: Record<string, unknown>;
  checksum?: string;
}

export class ArtifactStore {
  private readonly artifactsDir: string;

  constructor(private readonly options: ArtifactStoreOptions) {
    this.artifactsDir = path.join(options.dstackDir, "artifacts");
  }

  /**
   * Get all artifacts across all skills
   */
  async listArtifacts(limit = 100): Promise<Contracts.Artifact[]> {
    if (!(await exists(this.artifactsDir))) {
      return [];
    }

    const skillDirs = await this.getSkillDirectories();
    const artifacts: Contracts.Artifact[] = [];

    for (const skillDir of skillDirs) {
      const skillArtifacts = await this.getArtifactsForSkill(skillDir);
      artifacts.push(...skillArtifacts);
    }

    // Sort by createdAt descending and limit
    artifacts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return artifacts.slice(0, limit);
  }

  /**
   * Get artifacts for a specific skill
   */
  async listArtifactsBySkill(skillName: string, limit = 50): Promise<Contracts.Artifact[]> {
    const skillDir = path.join(this.artifactsDir, skillName);
    if (!(await exists(skillDir))) {
      return [];
    }

    const artifacts = await this.getArtifactsForSkill(skillDir);
    artifacts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return artifacts.slice(0, limit);
  }

  /**
   * Get artifact by ID
   */
  async getArtifact(artifactId: string): Promise<Contracts.Artifact | null> {
    const artifacts = await this.listArtifacts();
    return artifacts.find(a => a.id === artifactId) || null;
  }

  /**
   * Get artifact versions
   */
  async getArtifactVersions(artifactId: string): Promise<Contracts.ArtifactVersion[]> {
    if (!(await exists(this.artifactsDir))) {
      return [];
    }

    const skillDirs = await this.getSkillDirectories();
    
    for (const skillDir of skillDirs) {
      const latestPath = path.join(skillDir, "latest.json");
      if (!(await exists(latestPath))) continue;

      try {
        const latest = await readJsonFile<LatestArtifact>(latestPath);
        if (latest.id === artifactId) {
          // Find version files
          const versions = await this.getVersionFiles(skillDir, latest.name);
          return versions.map(v => this.versionToContract(v, artifactId, path.basename(skillDir)));
        }
      } catch {
        // Skip corrupted files
        continue;
      }
    }

    return [];
  }

  /**
   * Get artifact diff between two versions
   */
  async getArtifactDiff(artifactId: string, fromVersion?: string, toVersion?: string): Promise<Contracts.ArtifactDiff | null> {
    const versions = await this.getArtifactVersions(artifactId);
    if (versions.length === 0) {
      return null;
    }

    const from = fromVersion ? versions.find(v => v.version === fromVersion) : versions[versions.length - 2];
    const to = toVersion ? versions.find(v => v.version === toVersion) : versions[versions.length - 1];

    if (!from || !to) {
      return null;
    }

    try {
      const fromContent = await this.readVersionContent(from);
      const toContent = await this.readVersionContent(to);

      return this.computeDiff(fromContent, toContent, path.basename(from.relativePath).split('/')[0] || "unknown");
    } catch {
      return null;
    }
  }

  /**
   * Create or update an artifact
   */
  async createArtifact(skillName: string, name: string, content: JsonObject, metadata?: Record<string, unknown>): Promise<Contracts.Artifact> {
    await ensureDir(this.artifactsDir);
    const skillDir = path.join(this.artifactsDir, skillName);
    await ensureDir(skillDir);

    const timestamp = fileSafeTimestamp();
    const artifactId = shortHash(`${skillName}-${name}-${timestamp}`, 12);
    const versionId = shortHash(`${artifactId}-${timestamp}`, 8);

    // Create version file
    const versionPath = path.join(skillDir, `${name}.${timestamp}.json`);
    const versionData = {
      content,
      metadata,
      timestamp: nowIso()
    };

    await fs.writeFile(versionPath, JSON.stringify(versionData, null, 2));

    // Update latest.json
    const latestPath = path.join(skillDir, "latest.json");
    const latestData: LatestArtifact = {
      id: artifactId,
      name,
      type: this.detectArtifactType(content),
      createdAt: timestamp,
      updatedAt: timestamp,
      content,
      metadata: metadata || {},
      checksum: this.computeChecksum(content)
    };

    await fs.writeFile(latestPath, JSON.stringify(latestData, null, 2));

    return this.artifactToContract(artifactId, name, skillName, latestData, versionId);
  }

  private async getSkillDirectories(): Promise<string[]> {
    const skillDirs: string[] = [];
    
    try {
      const entries = await fs.readdir(this.artifactsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          skillDirs.push(path.join(this.artifactsDir, entry.name));
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
      return [];
    }

    return skillDirs;
  }

  private async getArtifactsForSkill(skillDir: string): Promise<Contracts.Artifact[]> {
    const artifacts: Contracts.Artifact[] = [];
    const latestPath = path.join(skillDir, "latest.json");

    if (!(await exists(latestPath))) {
      return artifacts;
    }

    try {
      const latest = await readJsonFile<LatestArtifact>(latestPath);
      const skillName = path.basename(skillDir);
      const versionId = shortHash(`${latest.id}-${latest.createdAt}`, 8);
      
      artifacts.push(this.artifactToContract(latest.id, latest.name, skillName, latest, versionId));
    } catch {
      // Skip corrupted files
    }

    return artifacts;
  }

  private async getVersionFiles(skillDir: string, artifactName: string): Promise<Contracts.ArtifactVersion[]> {
    const versions: Contracts.ArtifactVersion[] = [];
    
    try {
      const entries = await fs.readdir(skillDir);
      const versionFiles = entries
        .filter(entry => entry.startsWith(`${artifactName}.`) && entry.endsWith('.json'))
        .filter(entry => entry !== 'latest.json')
        .sort()
        .reverse(); // Newest first

      for (const file of versionFiles) {
        const filePath = path.join(skillDir, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const data = JSON.parse(content);
          
          // Extract timestamp from filename
          const timestamp = file.slice(artifactName.length + 1, -6); // Remove .json extension
          
          versions.push({
            artifactId: data.id || shortHash(`${artifactName}-${timestamp}`, 12),
            skillName: path.basename(skillDir),
            version: data.versionId || shortHash(`${data.id}-${timestamp}`, 8),
            createdAt: timestamp,
            relativePath: path.relative(this.options.projectRoot, filePath).replace(/\\/g, '/'),
            absolutePath: this.options.allowAbsolutePaths ? path.resolve(filePath) : null,
            contentHash: data.checksum || this.computeChecksum(data.content || {}),
            sizeBytes: content.length,
            isLatest: false,
            schemaVersion: "1.0"
          } as Contracts.ArtifactVersion);
        } catch {
          // Skip corrupted version files
          continue;
        }
      }
    } catch {
      // Index can't be read
    }

    return versions;
  }

  private async readVersionContent(version: Contracts.ArtifactVersion): Promise<JsonObject> {
    const filePath = path.join(this.options.projectRoot, version.relativePath);
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    return data.content || {};
  }

  private artifactToContract(id: string, name: string, skillName: string, latest: LatestArtifact, versionId: string): Contracts.Artifact {
    const artifact: Contracts.Artifact = {
      id,
      projectId: "unknown", // TODO: Get from project config
      skillName,
      artifactType: latest.type,
      schemaVersion: "1.0",
      version: versionId,
      createdAt: latest.createdAt,
      isLatest: true,
      relativePath: path.join("artifacts", skillName, "latest.json").replace(/\\/g, '/'),
      contentHash: latest.checksum || "",
      content: latest.content,
      warnings: []
    };

    if (this.options.allowAbsolutePaths) {
      artifact.absolutePath = path.join(this.options.projectRoot, "artifacts", skillName, "latest.json");
    }

    return artifact;
  }

  private versionToContract(version: Contracts.ArtifactVersion, artifactId: string, skillName: string): Contracts.ArtifactVersion {
    const contract: Contracts.ArtifactVersion = {
      artifactId,
      skillName,
      version: version.version,
      createdAt: version.createdAt,
      relativePath: version.relativePath,
      contentHash: version.contentHash,
      sizeBytes: version.sizeBytes || null,
      isLatest: false,
      schemaVersion: version.schemaVersion
    };

    if (version.absolutePath) {
      contract.absolutePath = version.absolutePath;
    }

    return contract;
  }

  private computeDiff(fromContent: JsonObject, toContent: JsonObject, skillName: string): Contracts.ArtifactDiff {
    const fromKeys = new Set(Object.keys(fromContent));
    const toKeys = new Set(Object.keys(toContent));
    
    const addedKeys = [...toKeys].filter(key => !fromKeys.has(key));
    const removedKeys = [...fromKeys].filter(key => !toKeys.has(key));
    const modifiedKeys: string[] = [];
    
    for (const key of fromKeys) {
      if (toKeys.has(key) && JSON.stringify(fromContent[key]) !== JSON.stringify(toContent[key])) {
        modifiedKeys.push(key);
      }
    }

    const changed = addedKeys.length > 0 || removedKeys.length > 0 || modifiedKeys.length > 0;
    
    const diff: Contracts.ArtifactDiff = {
      skillName,
      fromVersion: "unknown",
      toVersion: "unknown",
      changed,
      summary: `${addedKeys.length} added, ${removedKeys.length} removed, ${modifiedKeys.length} modified`,
      addedKeys,
      removedKeys,
      modifiedKeys
    };

    if (changed) {
      diff.patchPreview = [{ key: "diff", value: { from: fromContent, to: toContent } as JsonValue }] as Record<string, JsonValue>[];
    }

    return diff;
  }

  private detectArtifactType(content: JsonObject): string {
    if (content && typeof content === 'object') {
      if ('type' in content && typeof content.type === 'string') {
        return content.type;
      }
      if ('design' in content || 'layout' in content || 'components' in content) {
        return 'design';
      }
      if ('code' in content || 'implementation' in content) {
        return 'code';
      }
      if ('test' in content || 'tests' in content) {
        return 'test';
      }
    }
    return 'json';
  }

  private computeChecksum(content: JsonObject): string {
    return shortHash(JSON.stringify(content), 16);
  }
}
