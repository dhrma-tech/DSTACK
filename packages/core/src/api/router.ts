/**
 * API Router for DStack HTTP API
 * Handles routing and middleware for API endpoints
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { ApiAuth } from "./auth.js";
import type { ConfirmationManager } from "./confirmation.js";
import { SkillsRoutes } from "./routes/skills.js";
import { SkillRunsRoutes } from "./routes/skill-runs.js";
import { ArtifactsRoutes } from "./routes/artifacts.js";
import { BrowserRoutes } from "./routes/browser.js";
import { DeployRoutes } from "./routes/deploy.js";
import { BenchmarksRoutes } from "./routes/benchmarks.js";
import { SettingsRoutes } from "./routes/settings.js";
import { ProjectsRoutes } from "./routes/projects.js";
import { 
  NotFoundError, 
  UnauthorizedError,
  sendApiError, 
  sendApiSuccess, 
  createRequestId 
} from "./errors.js";

export interface RouterOptions {
  auth: ApiAuth;
  allowAbsolutePaths?: boolean;
  projectRoot: string;
  allowExternalOrigins?: boolean;
}

export class ApiRouter {
  private readonly auth: ApiAuth;
  private readonly allowAbsolutePaths: boolean;
  private readonly projectRoot: string;
  private readonly allowExternalOrigins: boolean;
  private readonly skillsRoutes: SkillsRoutes;
  private readonly skillRunsRoutes: SkillRunsRoutes;
  private readonly artifactsRoutes: ArtifactsRoutes;
  private readonly browserRoutes: BrowserRoutes;
  private readonly deployRoutes: DeployRoutes;
  private readonly benchmarksRoutes: BenchmarksRoutes;
  private readonly settingsRoutes: SettingsRoutes;
  private readonly projectsRoutes: ProjectsRoutes;

  constructor(options: RouterOptions) {
    this.auth = options.auth;
    this.allowAbsolutePaths = options.allowAbsolutePaths ?? false;
    this.projectRoot = options.projectRoot;
    this.allowExternalOrigins = options.allowExternalOrigins ?? false;
    
    const routeOptions = {
      allowSecrets: false,
      allowAbsolutePaths: this.allowAbsolutePaths
    };
    
    this.skillsRoutes = new SkillsRoutes(this.projectRoot, {});
    this.skillRunsRoutes = new SkillRunsRoutes(this.projectRoot, routeOptions);
    this.artifactsRoutes = new ArtifactsRoutes(this.projectRoot, routeOptions);
    this.browserRoutes = new BrowserRoutes(this.projectRoot, routeOptions);
    this.deployRoutes = new DeployRoutes(this.projectRoot, {}, {} as ConfirmationManager);
    this.benchmarksRoutes = new BenchmarksRoutes(this.projectRoot, routeOptions);
    this.settingsRoutes = new SettingsRoutes(this.projectRoot, routeOptions);
    this.projectsRoutes = new ProjectsRoutes(this.projectRoot, routeOptions);
  }

  async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const requestId = createRequestId();
    
    try {
      // Set CORS headers for local development
      this.setCorsHeaders(res);
      
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Parse URL and route
      const url = new URL(req.url!, `http://${req.headers.host}`);
      
      // Validate path safety
      if (!this.validatePathSafety(url.pathname)) {
        sendApiError(res, new UnauthorizedError('Invalid path'), requestId);
        return;
      }

      // Check if this is a health endpoint
      const isHealthEndpoint = url.pathname === '/v1/health' && req.method?.toUpperCase() === 'GET';
      
      // Step 1: Validate Origin/Referer policy (applies to all requests)
      if (!this.validateOrigin(req)) {
        sendApiError(res, new UnauthorizedError('Origin not allowed'), requestId);
        return;
      }

      // Step 2: Skip token validation for health endpoint
      if (!isHealthEndpoint) {
        // Step 3: Require valid bearer token for non-health routes
        const authResult = await this.auth.validateToken(req);
        if (!authResult.valid) {
          sendApiError(res, new UnauthorizedError('Authentication failed'), requestId);
          return;
        }
      }

      await this.routeRequest(req, res, url, requestId);
      
    } catch (error) {
      console.error('API Router Error:', error);
      sendApiError(res, error as Error, requestId);
    }
  }

  private setCorsHeaders(res: ServerResponse): void {
    // Restrict to localhost for security
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000,http://127.0.0.1:3000');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  private async routeRequest(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string
  ): Promise<void> {
    const path = url.pathname;
    const method = req.method?.toUpperCase();

    // Health check endpoint
    if (path === '/v1/health' && method === 'GET') {
      await this.handleHealthCheck(req, res, requestId);
      return;
    }

    // Projects endpoints
    if (path.startsWith('/v1/projects/')) {
      await this.handleProjectsRequest(req, res, url, requestId, method);
      return;
    }

    // Skills endpoints
    if (path.startsWith('/v1/skills')) {
      await this.handleSkillsRequest(req, res, url, requestId, method);
      return;
    }

    // Skill runs endpoints
    if (path.startsWith('/v1/skill-runs')) {
      await this.handleSkillRunsRequest(req, res, url, requestId, method);
      return;
    }

    // Artifacts endpoints
    if (path.startsWith('/v1/artifacts')) {
      await this.handleArtifactsRequest(req, res, url, requestId, method);
      return;
    }

    // Browser endpoints
    if (path.startsWith('/v1/browser')) {
      await this.handleBrowserRequest(req, res, url, requestId, method);
      return;
    }

    // Deploy endpoints
    if (path.startsWith('/v1/deploy')) {
      await this.handleDeployRequest(req, res, url, requestId, method);
      return;
    }

    // Benchmarks endpoints
    if (path.startsWith('/v1/benchmarks')) {
      await this.handleBenchmarksRequest(req, res, url, requestId, method);
      return;
    }

    // Settings endpoint
    if (path === '/v1/settings' && method === 'GET') {
      await this.settingsRoutes.handleGetSettings(req, res, requestId);
      return;
    }

    // Default: not found
    throw new NotFoundError(`Route ${method || 'UNKNOWN'} ${path} not found`);
  }

  private async handleSkillRunsRequest(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string,
    method?: string
  ): Promise<void> {
    if (url.pathname === '/v1/skill-runs' && method === 'GET') {
      await this.skillRunsRoutes.handleListSkillRuns(req, res, url, requestId);
      return;
    }

    if (url.pathname.startsWith('/v1/skill-runs/') && method === 'GET') {
      await this.skillRunsRoutes.handleGetSkillRun(req, res, url, requestId);
      return;
    }

    if (url.pathname === '/v1/skill-runs' && method === 'POST') {
      await this.skillRunsRoutes.handleCreateSkillRun(req, res, url, requestId);
      return;
    }

    throw new NotFoundError(`Skill runs route ${method} ${url.pathname} not found`);
  }

  private async handleArtifactsRequest(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string,
    method?: string
  ): Promise<void> {
    if (url.pathname === '/v1/artifacts' && method === 'GET') {
      await this.artifactsRoutes.handleListArtifacts(req, res, url, requestId);
      return;
    }

    if (url.pathname.match(/^\/v1\/artifacts\/[^/]+\/latest$/) && method === 'GET') {
      await this.artifactsRoutes.handleGetLatestArtifact(req, res, url, requestId);
      return;
    }

    if (url.pathname.match(/^\/v1\/artifacts\/[^/]+\/versions$/) && method === 'GET') {
      await this.artifactsRoutes.handleGetArtifactVersions(req, res, url, requestId);
      return;
    }

    if (url.pathname.match(/^\/v1\/artifacts\/[^/]+\/diff$/) && method === 'GET') {
      await this.artifactsRoutes.handleGetArtifactDiff(req, res, url, requestId);
      return;
    }

    throw new NotFoundError(`Artifacts route ${method} ${url.pathname} not found`);
  }

  private async handleBrowserRequest(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string,
    method?: string
  ): Promise<void> {
    if (url.pathname === '/v1/browser/snapshots' && method === 'GET') {
      await this.browserRoutes.handleListSnapshots(req, res, url, requestId);
      return;
    }

    if (url.pathname.match(/^\/v1\/browser\/snapshots\/[^/]+\/latest$/) && method === 'GET') {
      await this.browserRoutes.handleGetLatestSnapshot(req, res, url, requestId);
      return;
    }

    if (url.pathname === '/v1/browser/screenshots' && method === 'GET') {
      await this.browserRoutes.handleListScreenshots(req, res, url, requestId);
      return;
    }

    if (url.pathname.match(/^\/v1\/browser\/logs\/[^/]+$/) && method === 'GET') {
      await this.browserRoutes.handleGetSessionLogs(req, res, url, requestId);
      return;
    }

    throw new NotFoundError(`Browser route ${method} ${url.pathname} not found`);
  }

  private async handleDeployRequest(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string,
    method?: string
  ): Promise<void> {
    if (url.pathname === '/v1/deploy/config' && method === 'GET') {
      await this.deployRoutes.handleGetDeployConfig(req, res, requestId);
      return;
    }

    if (url.pathname === '/v1/deploy/runs' && method === 'GET') {
      await this.deployRoutes.handleListDeployRuns(req, res, url, requestId);
      return;
    }

    if (url.pathname === '/v1/deploy/freeze' && method === 'GET') {
      await this.deployRoutes.handleGetDeployFreeze(req, res, requestId);
      return;
    }

    if (url.pathname === '/v1/deploy/approve' && method === 'POST') {
      await this.deployRoutes.handleApproveDeploy(req, res, url, requestId);
      return;
    }

    throw new NotFoundError(`Deploy route ${method} ${url.pathname} not found`);
  }

  private async handleBenchmarksRequest(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string,
    method?: string
  ): Promise<void> {
    if (url.pathname === '/v1/benchmarks' && method === 'GET') {
      await this.benchmarksRoutes.handleListBenchmarks(req, res, url, requestId);
      return;
    }

    if (url.pathname.match(/^\/v1\/benchmarks\/[^/]+$/) && method === 'GET') {
      await this.benchmarksRoutes.handleGetBenchmark(req, res, url, requestId);
      return;
    }

    throw new NotFoundError(`Benchmarks route ${method} ${url.pathname} not found`);
  }

  private async handleHealthCheck(
    req: IncomingMessage, 
    res: ServerResponse, 
    requestId: string
  ): Promise<void> {
    const healthData = {
      status: 'healthy',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      apiVersion: 'v1'
    };
    
    sendApiSuccess(res, healthData, requestId);
  }

  private async handleProjectsRequest(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string,
    method?: string
  ): Promise<void> {
    if (url.pathname === '/v1/projects/current' && method === 'GET') {
      await this.projectsRoutes.handleGetCurrentProject(req, res, requestId);
      return;
    }

    if (url.pathname === '/v1/projects/current/config' && method === 'GET') {
      await this.projectsRoutes.handleGetProjectConfig(req, res, requestId);
      return;
    }

    if (url.pathname === '/v1/projects/current/workflow' && method === 'GET') {
      await this.projectsRoutes.handleGetWorkflow(req, res, requestId);
      return;
    }

    if (url.pathname === '/v1/projects/current/learnings' && method === 'GET') {
      await this.projectsRoutes.handleGetLearnings(req, res, requestId);
      return;
    }

    if (url.pathname === '/v1/projects/current/taste-profile' && method === 'GET') {
      await this.projectsRoutes.handleGetTasteProfile(req, res, requestId);
      return;
    }

    throw new NotFoundError(`Projects endpoint ${method} ${url.pathname} not found`);
  }

  private async handleSkillsRequest(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string,
    method?: string
  ): Promise<void> {
    if (url.pathname === '/v1/skills' && method === 'GET') {
      await this.skillsRoutes.handleListSkills(req, res, url, requestId);
      return;
    }

    if (url.pathname.match(/^\/v1\/skills\/[^/]+$/) && method === 'GET') {
      await this.skillsRoutes.handleGetSkill(req, res, url, requestId);
      return;
    }

    // Default: not found
    throw new NotFoundError(`Skills route ${method || 'UNKNOWN'} ${url.pathname} not found`);
  }

  private validateOrigin(req: IncomingMessage): boolean {
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    
    // Allow requests without origin/referer (same-origin requests)
    if (!origin && !referer) {
      return true;
    }

    // Local origins that are always allowed
    const localOrigins = [
      'http://localhost:3000',
      'https://localhost:3000',
      'http://127.0.0.1:3000',
      'https://127.0.0.1:3000',
      'http://localhost:4570',
      'https://localhost:4570',
      'http://127.0.0.1:4570',
      'https://127.0.0.1:4570'
    ];

    // Check if origin is a local origin
    if (origin && localOrigins.includes(origin)) {
      return true;
    }

    // Check if referer starts with a local origin
    if (referer && localOrigins.some(localOrigin => referer.startsWith(localOrigin))) {
      return true;
    }

    // If external origins are allowed, check if this is an external origin
    if (this.allowExternalOrigins && origin) {
      // For development: allow any origin when flag is set
      return true;
    }

    // Default: reject external origins
    return false;
  }

  private validatePathSafety(path: string): boolean {
    // Prevent path traversal attacks
    if (path.includes('..') || path.includes('\\')) {
      return false;
    }

    // Only allow API v1 paths
    if (!path.startsWith('/v1/')) {
      return false;
    }

    // Validate path segments
    const segments = path.split('/').filter(Boolean);
    for (const segment of segments) {
      // Reject empty segments, dots, or special characters
      if (segment === '.' || segment === '..' || /[<>:"|?*]/.test(segment)) {
        return false;
      }
    }

    return true;
  }
}
