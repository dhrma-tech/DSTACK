/**
 * Projects API routes
 * Handles project-related endpoints
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Contracts } from "@dstack/shared";
import { ProjectService } from "../../services/project-service.js";
import { WorkflowService } from "../../services/workflow-service.js";
import { LearningStore } from "../../memory/learning-store.js";
import { sendApiSuccess, sendApiError } from "../errors.js";
import path from "node:path";

export class ProjectsRoutes {
  private readonly projectService: ProjectService;
  private readonly workflowService: WorkflowService;
  private readonly learningStore: LearningStore;

  constructor(private projectRoot: string, private options: { allowSecrets?: boolean; allowAbsolutePaths?: boolean } = {}) {
    const serviceOptions: { projectRoot: string; allowSecrets?: boolean; allowAbsolutePaths?: boolean } = {
      projectRoot,
      ...(options.allowSecrets !== undefined && { allowSecrets: options.allowSecrets }),
      ...(options.allowAbsolutePaths !== undefined && { allowAbsolutePaths: options.allowAbsolutePaths })
    };
    this.projectService = new ProjectService(serviceOptions);
    this.workflowService = new WorkflowService(serviceOptions);
    this.learningStore = new LearningStore({ dstackDir: path.join(projectRoot, ".dstack") });
  }

  async handleGetCurrentProject(
    req: IncomingMessage, 
    res: ServerResponse, 
    requestId: string
  ): Promise<void> {
    try {
      const projectData = await this.projectService.getCurrentProject();
      sendApiSuccess(res, projectData, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }

  async handleGetProjectConfig(
    req: IncomingMessage, 
    res: ServerResponse, 
    requestId: string
  ): Promise<void> {
    try {
      const configData = await this.projectService.getProjectConfig();
      sendApiSuccess(res, configData, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }

  async handleGetWorkflow(
    req: IncomingMessage, 
    res: ServerResponse, 
    requestId: string
  ): Promise<void> {
    try {
      const workflowData = await this.workflowService.getWorkflowStatus();
      sendApiSuccess(res, workflowData, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }

  async handleGetLearnings(
    req: IncomingMessage, 
    res: ServerResponse, 
    requestId: string
  ): Promise<void> {
    try {
      const learningsData = await this.learningStore.all();
      sendApiSuccess(res, learningsData, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }

  async handleGetTasteProfile(
    req: IncomingMessage, 
    res: ServerResponse, 
    requestId: string
  ): Promise<void> {
    try {
      // For now, return default taste profile since ProjectService doesn't have taste profile method yet
      // TODO: Implement actual taste profile retrieval when available
      const tasteProfileData: Contracts.TasteProfile = {
        projectId: 'temp-project-id',
        updatedAt: new Date().toISOString(),
        entries: [],
        weights: [],
        topPreferences: []
      };
      
      sendApiSuccess(res, tasteProfileData, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }
}
