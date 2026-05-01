/**
 * API request/response schemas for local HTTP JSON adapter
 * All responses use consistent envelope format
 */

import type { JsonValue } from "./types.js";
import type { 
  Project, 
  ProjectConfig, 
  Skill, 
  SkillManifestSummary, 
  SkillRun, 
  SkillRunRequest,
  Artifact, 
  ArtifactVersion, 
  ArtifactDiff,
  WorkflowGraph,
  BrowserSnapshot, 
  ScreenshotAsset,
  DeployConfig, 
  DeployRun,
  BenchmarkRun,
  Settings,
  LearningEntry,
  TasteProfile,
  FreezeState
} from "./contracts.js";

// API Response Envelope
export interface ApiResponse<T = JsonValue> {
  ok: true;
  data: T;
  warnings: string[];
  meta: {
    requestId: string;
    timestamp: string;
    apiVersion: "v1";
  };
}

export interface ApiError {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, JsonValue> | null;
    retryable: boolean;
    approvalRequired?: boolean;
    requiredHash?: string | null;
    requestId: string;
  };
  warnings: string[];
  meta: {
    requestId: string;
    timestamp: string;
    apiVersion: "v1";
  };
}

// Health Check
export interface HealthCheckResponse {
  backend: {
    status: "healthy" | "degraded" | "unhealthy";
    version: string;
    uptime: number;
    provider: string;
    fakeMode: boolean;
  };
  skillCheck: {
    totalSkills: number;
    errors: number;
    warnings: number;
    centralShimSkills: number;
    partialSkills: number;
    highRiskPartialSkills: string[];
    passed: boolean;
  };
  safety: {
    mode: string;
    activatedAt?: string;
    blockedOperations: string[];
  };
  freeze: {
    frozen: boolean;
    scope: string;
    reason?: string;
  };
  warnings: string[];
}

// Skill Management
export type SkillsResponse = ApiResponse<Skill[]>;

export type SkillResponse = ApiResponse<Skill & SkillManifestSummary>;

export interface SkillRunListRequest {
  skillName?: string;
  status?: string;
  limit?: number;
  includeResult?: boolean;
}

export type SkillRunListResponse = ApiResponse<SkillRun[]>;

export type SkillRunResponse = ApiResponse<SkillRun>;

export type SkillRunCreateRequest = SkillRunRequest;

export type SkillRunCreateResponse = ApiResponse<{ runId: string; status: string }>;

// Artifact Management
export interface ArtifactListRequest {
  skillName?: string;
  latestOnly?: boolean;
  includeContent?: boolean;
  includeAbsolutePaths?: boolean;
}

export type ArtifactListResponse = ApiResponse<Artifact[]>;

export type ArtifactResponse = ApiResponse<Artifact>;

export type ArtifactVersionsResponse = ApiResponse<ArtifactVersion[]>;

export interface ArtifactDiffRequest {
  from: string;
  to: string;
}

export type ArtifactDiffResponse = ApiResponse<ArtifactDiff>;

// Browser Management
export type BrowserSnapshotsResponse = ApiResponse<BrowserSnapshot[]>;

export type BrowserSnapshotResponse = ApiResponse<BrowserSnapshot>;

export type BrowserScreenshotsResponse = ApiResponse<ScreenshotAsset[]>;

export interface BrowserLogsRequest {
  session: string;
}

export type BrowserLogsResponse = ApiResponse<{
  consoleLogs: Array<{
    timestamp: string;
    level: string;
    message: string;
    url?: string;
  }>;
  networkLogs: Array<{
    timestamp: string;
    method: string;
    url: string;
    status: number;
    duration: number;
  }>;
  counts: {
    consoleErrors: number;
    consoleWarnings: number;
    networkErrors: number;
    totalRequests: number;
  };
}>;

// Deploy Management
export type DeployConfigResponse = ApiResponse<DeployConfig | null>;

export type DeployRunsResponse = ApiResponse<DeployRun[]>;

export type DeployFreezeResponse = ApiResponse<FreezeState>;

export interface DeployApproveRequest {
  environment: string;
  confirmHash: string;
}

export type DeployApproveResponse = ApiResponse<{
  approved: boolean;
  artifactId?: string;
  blockers?: string[];
}>;

// Benchmark Management
export type BenchmarkRunsResponse = ApiResponse<BenchmarkRun[]>;

export type BenchmarkResponse = ApiResponse<BenchmarkRun>;

// Project Management
export type ProjectResponse = ApiResponse<Project>;

export type ProjectConfigResponse = ApiResponse<ProjectConfig>;

export type WorkflowResponse = ApiResponse<WorkflowGraph>;

export type LearningsResponse = ApiResponse<LearningEntry[]>;

export type TasteProfileResponse = ApiResponse<TasteProfile>;

export type SettingsResponse = ApiResponse<Settings>;

// Server startup
export interface ServerStartupInfo {
  host: string;
  port: number;
  tokenFileRelative: string;
  bindLocalOnly: boolean;
  projectId: string;
  apiVersion: string;
}

export interface ServerStartupResponse {
  server: ServerStartupInfo;
  status: "started" | "stopped";
  warnings: string[];
}
