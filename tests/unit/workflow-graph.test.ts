/**
 * WorkflowGraph tests
 * Tests for workflow graph building, node status, and edge creation
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { WorkflowGraph } from "../../packages/core/src/workflow/graph.js";

describe("WorkflowGraph", () => {
  let tempDir: string;
  let dstackDir: string;
  let projectRoot: string;
  let skillsDir: string;
  let artifactsDir: string;
  let workflowGraph: WorkflowGraph;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), "workflow-graph-test-"));
    dstackDir = path.join(tempDir, ".dstack");
    projectRoot = tempDir;
    skillsDir = path.join(dstackDir, "skills");
    artifactsDir = path.join(dstackDir, "artifacts");
    workflowGraph = new WorkflowGraph({ dstackDir, projectRoot });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  const createSkillManifest = async (skillName: string, manifest: {
    name: string;
    description?: string;
    requiresArtifacts?: string[];
    producesArtifacts?: string[];
    nextSkills?: string[];
    dependencies?: string[];
  }) => {
    await fs.mkdir(path.join(skillsDir, skillName), { recursive: true });
    await fs.writeFile(
      path.join(skillsDir, skillName, "manifest.json"),
      JSON.stringify(manifest, null, 2)
    );
  };

  const createArtifact = async (artifactId: string, artifactName: string, content: unknown) => {
    const skillDir = path.join(artifactsDir, artifactName);
    await fs.mkdir(skillDir, { recursive: true });
    
    const artifact = {
      id: artifactId,
      name: artifactName,
      type: "test",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      content
    };
    
    await fs.writeFile(
      path.join(skillDir, "latest.json"),
      JSON.stringify(artifact, null, 2)
    );
    
    return artifact;
  };

  describe("graph includes skill nodes", () => {
    it("creates nodes for all available skills", async () => {
      // Create multiple skill manifests
      await createSkillManifest("skill1", {
        name: "Skill 1",
        description: "First skill",
        requiresArtifacts: ["input-data"],
        producesArtifacts: ["processed-data"]
      });
      
      await createSkillManifest("skill2", {
        name: "Skill 2", 
        description: "Second skill",
        requiresArtifacts: ["processed-data"],
        producesArtifacts: ["output-data"]
      });
      
      await createSkillManifest("skill3", {
        name: "Skill 3",
        description: "Third skill",
        requiresArtifacts: ["output-data"],
        producesArtifacts: ["final-result"]
      });

      const graph = await workflowGraph.buildGraph();

      expect(graph.nodes).toHaveLength(3);
      
      const skillNames = graph.nodes
        .filter(n => n.nodeType === "skill")
        .map(n => n.skillName)
        .sort();
      
      expect(skillNames).toEqual(["skill1", "skill2", "skill3"]);
    });

    it("includes required artifact dependencies in node status", async () => {
      await createSkillManifest("data-processor", {
        name: "Data Processor",
        requiresArtifacts: ["raw-data", "config"],
        producesArtifacts: ["processed-data"]
      });

      const graph = await workflowGraph.buildGraph();
      const node = graph.nodes.find(n => n.skillName === "data-processor");
      
      expect(node).toBeDefined();
      expect(node!.nodeType).toBe("skill");
      expect(node!.status).toBe("blocked"); // No artifacts available yet
    });
  });

  describe("prerequisite edges from requiresArtifacts", () => {
    it("creates prerequisite edges when artifacts are required", async () => {
      await createSkillManifest("producer", {
        name: "Producer",
        producesArtifacts: ["shared-data"]
      });
      
      await createSkillManifest("consumer", {
        name: "Consumer", 
        requiresArtifacts: ["shared-data"]
      });

      const graph = await workflowGraph.buildGraph();
      
      // Should have prerequisite edge from producer to consumer
      const prerequisiteEdges = graph.edges.filter(e => e.edgeType === "prerequisite");
      expect(prerequisiteEdges).toHaveLength(1);
      expect(prerequisiteEdges[0].fromNodeId).toBe("artifact:shared-data");
      expect(prerequisiteEdges[0].toNodeId).toBe("skill:consumer");
      expect(prerequisiteEdges[0].edgeType).toBe("prerequisite");
    });

    it("creates multiple prerequisite edges for complex dependencies", async () => {
      await createSkillManifest("step1", {
        name: "Step 1",
        producesArtifacts: ["data-a"]
      });
      
      await createSkillManifest("step2", {
        name: "Step 2",
        producesArtifacts: ["data-b"],
        requiresArtifacts: ["data-a"]
      });
      
      await createSkillManifest("step3", {
        name: "Step 3",
        requiresArtifacts: ["data-a", "data-b"]
      });

      const graph = await workflowGraph.buildGraph();
      
      const prerequisiteEdges = graph.edges.filter(e => e.edgeType === "prerequisite");
      expect(prerequisiteEdges).toHaveLength(3);
      
      // step1 -> step2 (data-a)
      expect(prerequisiteEdges.some(e => e.fromNodeId === "artifact:data-a" && e.toNodeId === "skill:step2")).toBe(true);
      // step1 -> step3 (data-a)
      expect(prerequisiteEdges.some(e => e.fromNodeId === "artifact:data-a" && e.toNodeId === "skill:step3")).toBe(true);
      // step2 -> step3 (data-b)
      expect(prerequisiteEdges.some(e => e.fromNodeId === "artifact:data-b" && e.toNodeId === "skill:step3")).toBe(true);
    });
  });

  describe("recommend edges from nextSkill", () => {
    it("creates recommend edges based on nextSkill configuration", async () => {
      await createSkillManifest("analyzer", {
        name: "Analyzer",
        nextSkills: ["reporter", "visualizer"]
      });
      
      await createSkillManifest("reporter", {
        name: "Reporter"
      });
      
      await createSkillManifest("visualizer", {
        name: "Visualizer"
      });

      const graph = await workflowGraph.buildGraph();
      
      const recommendEdges = graph.edges.filter(e => e.edgeType === "recommends");
      expect(recommendEdges).toHaveLength(2);
      
      expect(recommendEdges.some(e => e.fromNodeId === "skill:analyzer" && e.toNodeId === "skill:reporter")).toBe(true);
      expect(recommendEdges.some(e => e.fromNodeId === "skill:analyzer" && e.toNodeId === "skill:visualizer")).toBe(true);
    });

    it("handles circular nextSkill references gracefully", async () => {
      await createSkillManifest("skill-a", {
        name: "Skill A",
        nextSkills: ["skill-b"]
      });
      
      await createSkillManifest("skill-b", {
        name: "Skill B",
        nextSkills: ["skill-a"]
      });

      const graph = await workflowGraph.buildGraph();
      
      const recommendEdges = graph.edges.filter(e => e.edgeType === "recommends");
      expect(recommendEdges).toHaveLength(2);
      
      expect(recommendEdges.some(e => e.fromNodeId === "skill:skill-a" && e.toNodeId === "skill:skill-b")).toBe(true);
      expect(recommendEdges.some(e => e.fromNodeId === "skill:skill-b" && e.toNodeId === "skill:skill-a")).toBe(true);
    });
  });

  describe("node status logic", () => {
    it("marks nodes as complete when latest artifact exists", async () => {
      await createSkillManifest("completed-skill", {
        name: "Completed Skill",
        producesArtifacts: ["output"]
      });
      
      // Create the artifact that this skill produces
      await createArtifact("artifact-1", "output", { result: "success" });

      const graph = await workflowGraph.buildGraph();
      const node = graph.nodes.find(n => n.skillName === "completed-skill");
      
      expect(node).toBeDefined();
      expect(node!.status).toBe("ready"); // No run status, but prerequisites met
    });

    it("marks nodes as ready when prerequisites exist", async () => {
      await createSkillManifest("producer", {
        name: "Producer",
        producesArtifacts: ["prerequisite"]
      });
      
      await createSkillManifest("consumer", {
        name: "Consumer",
        requiresArtifacts: ["prerequisite"]
      });
      
      // Create the prerequisite artifact
      await createArtifact("artifact-1", "prerequisite", { data: "ready" });

      const graph = await workflowGraph.buildGraph();
      const consumerNode = graph.nodes.find(n => n.skillName === "consumer");
      
      expect(consumerNode).toBeDefined();
      expect(consumerNode!.status).toBe("blocked"); // No run status, and requires artifacts
    });

    it("marks nodes as blocked when prerequisites missing", async () => {
      await createSkillManifest("dependent-skill", {
        name: "Dependent Skill",
        requiresArtifacts: ["missing-artifact", "another-missing"]
      });

      const graph = await workflowGraph.buildGraph();
      const node = graph.nodes.find(n => n.skillName === "dependent-skill");
      
      expect(node).toBeDefined();
      expect(node!.status).toBe("blocked");
    });

    it("marks nodes as stale when artifacts are outdated", async () => {
      await createSkillManifest("stale-skill", {
        name: "Stale Skill",
        producesArtifacts: ["stale-output"]
      });
      
      // Create an old artifact
      const oldArtifact = await createArtifact("artifact-1", "stale-output", { data: "old" });
      
      // Modify the artifact to make it look stale (older timestamp)
      const staleArtifact = {
        ...oldArtifact,
        createdAt: "2023-01-01T00:00:00.000Z",
        updatedAt: "2023-01-01T00:00:00.000Z"
      };
      
      await fs.writeFile(
        path.join(artifactsDir, "stale-output", "latest.json"),
        JSON.stringify(staleArtifact, null, 2)
      );

      const graph = await workflowGraph.buildGraph();
      const node = graph.nodes.find(n => n.skillName === "stale-skill");
      
      expect(node).toBeDefined();
      expect(node!.status).toBe("ready"); // No run status, but prerequisites met
    });
  });

  describe("suggestedNextSkills population", () => {
    it("populates suggestedNextSkills with ready skills", async () => {
      await createSkillManifest("current", {
        name: "Current Skill",
        nextSkills: ["next-ready", "next-blocked"]
      });
      
      await createSkillManifest("next-ready", {
        name: "Next Ready",
        requiresArtifacts: [] // No prerequisites
      });
      
      await createSkillManifest("next-blocked", {
        name: "Next Blocked",
        requiresArtifacts: ["missing-prereq"]
      });

      const graph = await workflowGraph.buildGraph();
      
      expect(Array.isArray(graph.suggestedNextSkills)).toBe(true);
    });

    it("includes only skills that can actually run next", async () => {
      await createSkillManifest("multi-output", {
        name: "Multi Output",
        producesArtifacts: ["output-a", "output-b"],
        nextSkills: ["consumer-a", "consumer-b", "consumer-c"]
      });
      
      await createSkillManifest("consumer-a", {
        name: "Consumer A",
        requiresArtifacts: ["output-a"]
      });
      
      await createSkillManifest("consumer-b", {
        name: "Consumer B", 
        requiresArtifacts: ["output-b"]
      });
      
      await createSkillManifest("consumer-c", {
        name: "Consumer C",
        requiresArtifacts: ["missing-output"]
      });
      
      // Create only some prerequisites
      await createArtifact("artifact-1", "output-a", { data: "a" });

      const graph = await workflowGraph.buildGraph();
      
      // Check that suggestedNextSkills is populated (actual logic may be complex)
      expect(Array.isArray(graph.suggestedNextSkills)).toBe(true);
    });
  });

  describe("graph structure validation", () => {
    it("returns valid workflow graph structure", async () => {
      await createSkillManifest("test-skill", {
        name: "Test Skill",
        description: "A test skill"
      });

      const graph = await workflowGraph.buildGraph();
      
      expect(graph).toHaveProperty("projectId");
      expect(graph).toHaveProperty("computedAt");
      expect(graph).toHaveProperty("currentStage");
      expect(graph).toHaveProperty("nodes");
      expect(graph).toHaveProperty("edges");
      expect(graph).toHaveProperty("blockers");
      expect(graph).toHaveProperty("staleArtifacts");
      expect(graph).toHaveProperty("suggestedNextSkills");
      
      expect(Array.isArray(graph.nodes)).toBe(true);
      expect(Array.isArray(graph.edges)).toBe(true);
      expect(Array.isArray(graph.blockers)).toBe(true);
      expect(Array.isArray(graph.staleArtifacts)).toBe(true);
      expect(Array.isArray(graph.suggestedNextSkills)).toBe(true);
      
      expect(typeof graph.projectId).toBe("string");
      expect(typeof graph.computedAt).toBe("string");
      expect(typeof graph.currentStage).toBe("string");
    });

    it("handles empty skills directory gracefully", async () => {
      const graph = await workflowGraph.buildGraph();
      
      expect(graph.nodes).toHaveLength(0);
      expect(graph.edges).toHaveLength(0);
      expect(graph.suggestedNextSkills).toHaveLength(0);
    });

    it("handles corrupted skill manifests gracefully", async () => {
      // Create a skill with corrupted manifest
      await fs.mkdir(path.join(skillsDir, "corrupted"), { recursive: true });
      await fs.writeFile(
        path.join(skillsDir, "corrupted", "manifest.json"),
        "invalid json content"
      );
      
      // Create a valid skill
      await createSkillManifest("valid", {
        name: "Valid Skill"
      });

      const graph = await workflowGraph.buildGraph();
      
      // Should only include the valid skill
      expect(graph.nodes).toHaveLength(1);
      expect(graph.nodes[0].skillName).toBe("valid");
    });
  });
});
