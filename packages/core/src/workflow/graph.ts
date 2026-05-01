/**
 * WorkflowGraph - Build workflow graph from skill manifests and artifact availability
 * Provides node status and suggested next skills for execution
 */

import path from "node:path";
import fs from "node:fs/promises";
import { exists, readJsonFile, shortHash } from "../utils.js";
import type { Contracts } from "@dstack/shared";

export interface WorkflowGraphOptions {
  dstackDir: string;
  projectRoot: string;
}

export interface SkillManifest {
  name: string;
  description?: string;
  requiresArtifacts?: string[];
  producesArtifacts?: string[];
  nextSkills?: string[];
  dependencies?: string[];
}

export class WorkflowGraph {
  constructor(private readonly options: WorkflowGraphOptions) {}

  /**
   * Build workflow graph from current state
   */
  async buildGraph(): Promise<Contracts.WorkflowGraph> {
    const projectId = this.generateProjectId();
    const computedAt = new Date().toISOString();
    
    // Get skill manifests
    const skillManifests = await this.getSkillManifests();
    
    // Get latest artifacts
    const latestArtifacts = await this.getLatestArtifacts();
    
    // Get latest run status
    const runStatus = await this.getLatestRunStatus();
    
    // Build nodes
    const nodes = this.buildNodes(skillManifests, latestArtifacts, runStatus);
    
    // Determine blockers
    const blockers = this.getBlockers(nodes);
    
    // Determine stale artifacts
    const staleArtifacts = this.getStaleArtifacts(nodes);
    
    // Determine current stage
    const currentStage = this.determineCurrentStage(nodes);
    
    // Get suggested next skills
    const suggestedNextSkills = this.getSuggestedNextSkills(nodes);

    return {
      projectId,
      computedAt,
      currentStage,
      nodes,
      edges: this.buildEdges(skillManifests),
      blockers,
      staleArtifacts,
      suggestedNextSkills
    };
  }


  private generateProjectId(): string {
    // Use project root path to generate stable project ID
    const projectRoot = this.options.projectRoot;
    return projectRoot.split(path.sep).pop() || "unknown";
  }

  private async getSkillManifests(): Promise<Map<string, SkillManifest>> {
    const manifests = new Map<string, SkillManifest>();
    const skillsDir = path.join(this.options.dstackDir, "skills");
    
    if (!(await exists(skillsDir))) {
      return manifests;
    }

    try {
      const entries = await fs.readdir(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const manifestPath = path.join(skillsDir, entry.name, "manifest.json");
          if (await exists(manifestPath)) {
            try {
              const manifest = await readJsonFile<SkillManifest>(manifestPath);
              manifests.set(entry.name, manifest);
            } catch {
              // Skip corrupted manifests
              continue;
            }
          }
        }
      }
    } catch {
      // Directory can't be read
    }

    return manifests;
  }

  private async getLatestArtifacts(): Promise<Map<string, Contracts.Artifact>> {
    const artifacts = new Map<string, Contracts.Artifact>();
    const artifactsDir = path.join(this.options.dstackDir, "artifacts");
    
    if (!(await exists(artifactsDir))) {
      return artifacts;
    }

    try {
      const entries = await fs.readdir(artifactsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const latestPath = path.join(artifactsDir, entry.name, "latest.json");
          if (await exists(latestPath)) {
            try {
              const artifact = await readJsonFile<Contracts.Artifact>(latestPath);
              artifacts.set(artifact.id, artifact);
            } catch {
              // Skip corrupted artifacts
              continue;
            }
          }
        }
      }
    } catch {
      // Directory can't be read
    }

    return artifacts;
  }

  private async getLatestRunStatus(): Promise<Map<string, Contracts.SkillRunStatus>> {
    const runStatus = new Map<string, Contracts.SkillRunStatus>();
    const runsDir = path.join(this.options.dstackDir, "runs");
    
    if (!(await exists(runsDir))) {
      return runStatus;
    }

    try {
      const indexPath = path.join(runsDir, "index.json");
      if (await exists(indexPath)) {
        const index = await readJsonFile<{ runs: Contracts.SkillRun[] }>(indexPath);
        // Get the most recent run for each skill
        for (const run of index.runs) {
          if (!runStatus.has(run.skillName) || 
              new Date(run.requestedAt) > new Date(runStatus.get(run.skillName) || "")) {
            runStatus.set(run.skillName, run.status);
          }
        }
      }
    } catch {
      // Index can't be read
    }

    return runStatus;
  }

  private buildNodes(
    skillManifests: Map<string, SkillManifest>,
    latestArtifacts: Map<string, Contracts.Artifact>,
    runStatus: Map<string, Contracts.SkillRunStatus>
  ): Contracts.WorkflowNode[] {
    const nodes: Contracts.WorkflowNode[] = [];

    // Build skill nodes
    for (const [skillName, manifest] of skillManifests) {
      const status = this.determineSkillStatus(skillName, manifest, latestArtifacts, runStatus);
      const stage = this.determineSkillStage(skillName);
      
      nodes.push({
        id: `skill:${skillName}`,
        nodeType: "skill",
        label: skillName,
        stage,
        status,
        isRequired: true, // TODO: Determine from manifest
        isStale: status === "stale",
        skillName,
        verdict: status === "complete" ? "PASS" : null,
        latestRunId: runStatus.get(skillName) ? shortHash(`${skillName}-${runStatus.get(skillName)}`, 12) : null,
        latestArtifactId: this.getLatestArtifactId(skillName, manifest, latestArtifacts),
        nextSkillHint: manifest.nextSkills?.[0] || null
      });
    }

    // Build artifact nodes
    for (const [artifactId, artifact] of latestArtifacts) {
      nodes.push({
        id: `artifact:${artifactId}`,
        nodeType: "artifact",
        label: artifact.id,
        stage: "complete",
        status: "complete",
        isRequired: true,
        isStale: false,
        artifactId,
        verdict: "PASS",
        latestArtifactId: artifactId
      });
    }

    return nodes;
  }

  private buildEdges(skillManifests: Map<string, SkillManifest>): Contracts.WorkflowEdge[] {
    const edges: Contracts.WorkflowEdge[] = [];
    let edgeCounter = 0;

    for (const [skillName, manifest] of skillManifests) {
      const skillNodeId = `skill:${skillName}`;

      // Prerequisite edges (skills that must run first)
      if (manifest.dependencies) {
        for (const dependency of manifest.dependencies) {
          edges.push({
            id: `edge-${edgeCounter++}`,
            fromNodeId: `skill:${dependency}`,
            toNodeId: skillNodeId,
            edgeType: "prerequisite",
            required: true
          });
        }
      }

      // Artifact prerequisite edges
      if (manifest.requiresArtifacts) {
        for (const artifactId of manifest.requiresArtifacts) {
          edges.push({
            id: `edge-${edgeCounter++}`,
            fromNodeId: `artifact:${artifactId}`,
            toNodeId: skillNodeId,
            edgeType: "prerequisite",
            required: true
          });
        }
      }

      // Produces edges (artifacts this skill creates)
      if (manifest.producesArtifacts) {
        for (const artifactId of manifest.producesArtifacts) {
          edges.push({
            id: `edge-${edgeCounter++}`,
            fromNodeId: skillNodeId,
            toNodeId: `artifact:${artifactId}`,
            edgeType: "produces",
            required: false
          });
        }
      }

      // Recommendation edges (suggested next skills)
      if (manifest.nextSkills) {
        for (const nextSkill of manifest.nextSkills) {
          edges.push({
            id: `edge-${edgeCounter++}`,
            fromNodeId: skillNodeId,
            toNodeId: `skill:${nextSkill}`,
            edgeType: "recommends",
            required: false,
            label: "recommended"
          });
        }
      }
    }

    return edges;
  }

  private getBlockers(nodes: Contracts.WorkflowNode[]): string[] {
    const blockers: string[] = [];
    
    for (const node of nodes) {
      if (node.status === "blocked") {
        blockers.push(node.id);
      }
    }
    
    return blockers;
  }

  private getStaleArtifacts(nodes: Contracts.WorkflowNode[]): string[] {
    const stale: string[] = [];
    
    for (const node of nodes) {
      if (node.nodeType === "artifact" && node.isStale) {
        stale.push(node.id);
      }
    }
    
    return stale;
  }

  private determineSkillStatus(
    skillName: string,
    manifest: SkillManifest,
    latestArtifacts: Map<string, Contracts.Artifact>,
    runStatus: Map<string, Contracts.SkillRunStatus>
  ): Contracts.WorkflowNode["status"] {
    const currentRunStatus = runStatus.get(skillName);
    
    // If currently running, return that status
    if (currentRunStatus === "running") {
      return "running";
    }
    
    // If last run had an error, mark as error
    if (currentRunStatus === "error" || currentRunStatus === "interrupted") {
      return "error";
    }
    
    // Check if prerequisites are met
    if (!this.arePrerequisitesMet(skillName, manifest, latestArtifacts, runStatus)) {
      return "blocked";
    }
    
    // If completed successfully and artifacts are fresh, mark as complete
    if (currentRunStatus === "complete") {
      const artifactsStale = this.areArtifactsStale(skillName, manifest, latestArtifacts);
      if (!artifactsStale) {
        return "complete";
      } else {
        return "stale";
      }
    }
    
    // If no run status but prerequisites are met, ready to run
    return "ready";
  }

  private determineSkillStage(_skillName: string): string {
    // Simple stage determination based on skill name and manifest
    if (_skillName.includes("plan") || _skillName.includes("design")) {
      return "planning";
    }
    if (_skillName.includes("build") || _skillName.includes("implement")) {
      return "build";
    }
    if (_skillName.includes("test") || _skillName.includes("qa")) {
      return "qa";
    }
    return "unknown";
  }

  private arePrerequisitesMet(
    skillName: string,
    manifest: SkillManifest,
    latestArtifacts: Map<string, Contracts.Artifact>,
    runStatus: Map<string, Contracts.SkillRunStatus>
  ): boolean {
    // Check skill dependencies
    if (manifest.dependencies) {
      for (const dependency of manifest.dependencies) {
        const depStatus = runStatus.get(dependency);
        if (depStatus !== "complete") {
          return false;
        }
      }
    }

    // Check artifact dependencies
    if (manifest.requiresArtifacts) {
      for (const artifactId of manifest.requiresArtifacts) {
        if (!latestArtifacts.has(artifactId)) {
          return false;
        }
      }
    }

    return true;
  }

  private areArtifactsStale(
    skillName: string,
    manifest: SkillManifest,
    latestArtifacts: Map<string, Contracts.Artifact>
  ): boolean {
    if (!manifest.producesArtifacts) {
      return false;
    }

    // Check if any produced artifacts are missing
    for (const artifactId of manifest.producesArtifacts) {
      if (!latestArtifacts.has(artifactId)) {
        return true;
      }
    }

    // TODO: Add staleness detection based on timestamps if needed
    return false;
  }

  private getLatestArtifactId(
    skillName: string,
    manifest: SkillManifest,
    latestArtifacts: Map<string, Contracts.Artifact>
  ): string | null {
    if (!manifest.producesArtifacts) {
      return null;
    }

    for (const artifactId of manifest.producesArtifacts) {
      if (latestArtifacts.has(artifactId)) {
        return artifactId;
      }
    }

    return null;
  }

  private determineCurrentStage(nodes: Contracts.WorkflowNode[]): string {
    const completedSkills = nodes.filter(n => n.nodeType === "skill" && n.status === "complete").length;
    const totalSkills = nodes.filter(n => n.nodeType === "skill").length;
    
    if (totalSkills === 0) return "planning";
    if (completedSkills === 0) return "planning";
    if (completedSkills < totalSkills * 0.3) return "design";
    if (completedSkills < totalSkills * 0.7) return "build";
    if (completedSkills < totalSkills) return "qa";
    return "shipped";
  }

  private getSuggestedNextSkills(nodes: Contracts.WorkflowNode[]): string[] {
    const skillNodes = nodes.filter(n => n.nodeType === "skill");
    const suggestions: string[] = [];

    for (const node of skillNodes) {
      if (node.status === "ready") {
        suggestions.push(node.skillName!);
      }
    }

    // Sort by priority (could be enhanced with manifest priority)
    return suggestions.sort();
  }
}
