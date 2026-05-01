/**
 * Workflow service for frontend-ready workflow information
 * Provides DTO-compatible data without console output
 */

import path from "node:path";
import { WorkflowGraph } from "../workflow/graph.js";
import type { Contracts } from "@dstack/shared";

export interface ServiceOptions {
  projectRoot: string;
  allowSecrets?: boolean;
  allowAbsolutePaths?: boolean;
}

export class WorkflowService {
  private readonly workflowGraph: WorkflowGraph;

  constructor(private readonly options: ServiceOptions) {
    this.workflowGraph = new WorkflowGraph({
      dstackDir: path.join(options.projectRoot, ".dstack"),
      projectRoot: options.projectRoot
    });
  }

  /**
   * Get current workflow stage
   */
  async getCurrentStage(): Promise<string> {
    const graph = await this.workflowGraph.buildGraph();
    return graph.currentStage;
  }

  /**
   * Get workflow history
   */
  async getWorkflowHistory(): Promise<unknown[]> {
    // TODO: Implement workflow history from store
    return [];
  }

  /**
   * Get workflow status
   */
  async getWorkflowStatus(): Promise<Contracts.WorkflowGraph> {
    return await this.workflowGraph.buildGraph();
  }
}
