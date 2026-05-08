/* ──────────────────────────────────────────────────────
   Mock data for DStack frontend
   Shapes match @dstack/shared contracts exactly.
   Replace with real API calls when backend is connected.
   ────────────────────────────────────────────────────── */

// We define inline types matching contracts to avoid cross-package import issues in Next.js
// These mirror @dstack/shared/contracts 1:1

export interface Project {
  id: string;
  name: string;
  rootDisplayPath: string;
  workflowStage: string;
  updatedAt: string;
  provider: { current: "gemini" | "fake"; geminiConfigured: boolean };
  safetyMode: { mode: "NORMAL" | "CAREFUL" | "GUARD"; reason: string | null };
  freezeState: { frozen: boolean; reason: string | null };
  artifactCounts: { total: number; latest: number; stale: number };
}

export interface Skill {
  id?: string;
  name: string;
  command: string;
  description: string;
  stage: string;
  maturity: "complete" | "partial" | "experimental";
  available: boolean;
  status?: "ready" | "blocked";
  hidden: boolean;
  model: string;
  requiresArtifacts: string[];
  allowedTools: string[];
  hasLatestArtifact: boolean;
  lastRunAt: string | null;
  nextSkill: string | null;
}

export interface SkillRun {
  id: string;
  skillName: string;
  command: string;
  status: "queued" | "running" | "complete" | "error" | "blocked";
  requestedAt: string;
  completedAt: string | null;
  provider: "gemini" | "fake";
  model: string;
  fakeMode: boolean;
  dryRun: boolean;
  warnings: string[];
  verdict: "PASS" | "REVISE" | "FAIL" | null;
  duration: string;
}

export interface Artifact {
  id: string;
  skillName: string;
  artifactType: string;
  version: string;
  createdAt: string;
  isLatest: boolean;
  relativePath: string;
  verdict: "PASS" | "REVISE" | "FAIL" | null;
  summary: string | null;
  warnings: string[];
  content?: any;
}

export interface BenchmarkResult {
  model: string;
  quality: number;
  latency: number;
  cost: number;
}

export interface BenchmarkRun {
  id: string;
  suite: string;
  date: string;
  results: BenchmarkResult[];
}

export interface Learning {
  id: string;
  topic: string;
  insight: string;
  source: string;
  createdAt: string;
}

export interface BrowserSnapshot {
  id: string;
  url: string;
  title: string;
  createdAt: string;
  screenshot: string | null;
  promptInjectionDetected: boolean;
  consoleErrors: number;
}

export interface DeployRun {
  id: string;
  type: string;
  status: string;
  verdict: string;
  environment: string;
  startedAt: string;
  healthCheck: string;
}

export interface WorkflowNode {
  id: string;
  nodeType: "skill" | "artifact" | "gate";
  label: string;
  stage: string;
  status: "not_run" | "ready" | "running" | "complete" | "error" | "blocked" | "stale";
  isRequired: boolean;
  isStale: boolean;
  skillName?: string;
}

export interface WorkflowEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType: "prerequisite" | "produces" | "recommends";
  required: boolean;
}

export interface WorkflowGraph {
  projectId: string;
  currentStage: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  blockers: string[];
  suggestedNextSkills: string[];
}

// ── Mock Data ──

export const MOCK_PROJECT: Project = {
  id: "proj-dstack-demo",
  name: "DStack Demo",
  rootDisplayPath: "~/projects/dstack-demo",
  workflowStage: "design",
  updatedAt: "2026-05-02T10:00:00Z",
  provider: { current: "fake", geminiConfigured: false },
  safetyMode: { mode: "NORMAL", reason: null },
  freezeState: { frozen: false, reason: null },
  artifactCounts: { total: 5, latest: 3, stale: 1 },
};

export const MOCK_SKILLS: Skill[] = [
  { name: "office-hours", command: "office-hours", description: "Brainstorm and refine product ideas with AI-powered market analysis.", stage: "planning", maturity: "complete", available: true, hidden: false, model: "gemini-2.0-flash", requiresArtifacts: [], allowedTools: ["web_search", "read_file"], hasLatestArtifact: true, lastRunAt: "2026-05-02T08:00:00Z", nextSkill: "autoplan" },
  { name: "autoplan", command: "autoplan", description: "Automatically generate project plans and dev tickets from roadmaps.", stage: "planning", maturity: "complete", available: true, hidden: false, model: "gemini-2.0-flash", requiresArtifacts: ["office-hours"], allowedTools: ["read_file", "write_file"], hasLatestArtifact: true, lastRunAt: "2026-05-02T08:30:00Z", nextSkill: "design-consultation" },
  { name: "plan-ceo-review", command: "plan-ceo-review", description: "Executive-level review of the product plan and strategy.", stage: "planning", maturity: "complete", available: true, hidden: false, model: "gemini-2.5-pro", requiresArtifacts: ["autoplan"], allowedTools: ["read_file"], hasLatestArtifact: false, lastRunAt: null, nextSkill: "plan-eng-review" },
  { name: "design-consultation", command: "design-consultation", description: "Get design feedback, UX recommendations, and variant exploration.", stage: "design", maturity: "complete", available: true, hidden: false, model: "gemini-2.0-flash", requiresArtifacts: ["autoplan"], allowedTools: ["read_file", "write_file"], hasLatestArtifact: false, lastRunAt: null, nextSkill: "design-review" },
  { name: "design-review", command: "design-review", description: "Review and score design variants against taste profile.", stage: "design", maturity: "partial", available: false, hidden: false, model: "gemini-2.0-flash", requiresArtifacts: ["design-consultation"], allowedTools: ["read_file"], hasLatestArtifact: false, lastRunAt: null, nextSkill: "review" },
  { name: "review", command: "review", description: "Full project readiness review with artifact staleness detection.", stage: "qa", maturity: "complete", available: true, hidden: false, model: "gemini-2.0-flash", requiresArtifacts: [], allowedTools: ["read_file", "list_directory"], hasLatestArtifact: false, lastRunAt: null, nextSkill: "qa" },
  { name: "qa", command: "qa", description: "Run automated tests, security audits, and browser-based QA checks.", stage: "qa", maturity: "complete", available: true, hidden: false, model: "gemini-2.0-flash", requiresArtifacts: ["review"], allowedTools: ["run_shell", "browser_navigate", "browser_screenshot"], hasLatestArtifact: false, lastRunAt: null, nextSkill: "ship" },
  { name: "ship", command: "ship", description: "Finalize artifacts and prepare for production deployment.", stage: "shipped", maturity: "complete", available: false, hidden: false, model: "gemini-2.0-flash", requiresArtifacts: ["qa"], allowedTools: ["read_file", "write_file", "run_shell"], hasLatestArtifact: false, lastRunAt: null, nextSkill: null },
  { name: "benchmark", command: "benchmark", description: "Benchmark model performance across prompt suites.", stage: "qa", maturity: "partial", available: true, hidden: true, model: "gemini-2.0-flash", requiresArtifacts: [], allowedTools: [], hasLatestArtifact: false, lastRunAt: null, nextSkill: null },
  { name: "context-save", command: "context-save", description: "Save current project context as a checkpoint.", stage: "planning", maturity: "complete", available: true, hidden: true, model: "gemini-2.0-flash", requiresArtifacts: [], allowedTools: ["read_file", "write_file"], hasLatestArtifact: false, lastRunAt: null, nextSkill: null },
];

export const MOCK_RUNS: SkillRun[] = [
  { id: "run-9021", skillName: "office-hours", command: "office-hours", status: "complete", requestedAt: "2026-05-02T08:00:00Z", completedAt: "2026-05-02T08:00:18Z", provider: "fake", model: "gemini-2.0-flash", fakeMode: true, dryRun: false, warnings: [], verdict: "PASS", duration: "18.2s" },
  { id: "run-9020", skillName: "autoplan", command: "autoplan", status: "complete", requestedAt: "2026-05-02T08:30:00Z", completedAt: "2026-05-02T08:31:15Z", provider: "fake", model: "gemini-2.0-flash", fakeMode: true, dryRun: false, warnings: [], verdict: "PASS", duration: "1m 15s" },
  { id: "run-9019", skillName: "review", command: "review", status: "error", requestedAt: "2026-05-02T09:00:00Z", completedAt: "2026-05-02T09:00:05Z", provider: "fake", model: "gemini-2.0-flash", fakeMode: true, dryRun: false, warnings: ["Missing required artifact: design-consultation"], verdict: "FAIL", duration: "5s" },
  { id: "run-9018", skillName: "benchmark", command: "benchmark", status: "complete", requestedAt: "2026-05-01T14:00:00Z", completedAt: "2026-05-01T14:02:30Z", provider: "fake", model: "gemini-2.0-flash", fakeMode: true, dryRun: true, warnings: ["Dry run — quality scores are approximate"], verdict: null, duration: "2m 30s" },
];

export const MOCK_ARTIFACTS: Artifact[] = [
  { 
    id: "art-1", 
    skillName: "office-hours", 
    artifactType: "JSON", 
    version: "v3", 
    createdAt: "2026-05-02T08:00:18Z", 
    isLatest: true, 
    relativePath: ".dstack/artifacts/office-hours/roadmap.json", 
    verdict: "PASS", 
    summary: "Product roadmap for CounselPro SaaS with 3 phases.", 
    warnings: [],
    content: {
      "project": "CounselPro SaaS",
      "version": "1.0.0",
      "roadmap": [
        { "phase": "MVP", "goals": ["User Auth", "College Database"] },
        { "phase": "Alpha", "goals": ["Predictor Engine", "Payment Gateway"] }
      ]
    }
  },
  { 
    id: "art-2", 
    skillName: "autoplan", 
    artifactType: "JSON", 
    version: "v2", 
    createdAt: "2026-05-02T08:31:15Z", 
    isLatest: true, 
    relativePath: ".dstack/artifacts/autoplan/plan.json", 
    verdict: "PASS", 
    summary: "Development plan with 12 tasks across 3 sprints.", 
    warnings: [],
    content: {
      "sprints": [
        { "id": 1, "tasks": ["Setup repo", "Initial schema"] },
        { "id": 2, "tasks": ["API design", "Frontend scaffolding"] }
      ]
    }
  },
  { 
    id: "art-3", 
    skillName: "office-hours", 
    artifactType: "JSON", 
    version: "v2", 
    createdAt: "2026-05-01T12:00:00Z", 
    isLatest: false, 
    relativePath: ".dstack/artifacts/office-hours/roadmap.v2.json", 
    verdict: "PASS", 
    summary: "Previous roadmap iteration.", 
    warnings: [],
    content: { "status": "deprecated", "reason": "superseded by v3" }
  },
  { 
    id: "art-4", 
    skillName: "review", 
    artifactType: "JSON", 
    version: "v1", 
    createdAt: "2026-04-30T10:00:00Z", 
    isLatest: true, 
    relativePath: ".dstack/artifacts/review/review-dashboard.json", 
    verdict: "REVISE", 
    summary: "Review found 2 stale artifacts.", 
    warnings: ["Stale: design-consultation"],
    content: {
      "readiness_score": 75,
      "issues": ["design-consultation is stale", "qa-report missing"]
    }
  },
];

export const MOCK_WORKFLOW: WorkflowGraph = {
  projectId: "proj-dstack-demo",
  currentStage: "planning",
  nodes: [
    { id: "n1", nodeType: "skill", label: "office-hours", stage: "planning", status: "complete", isRequired: true, isStale: false, skillName: "office-hours" },
    { id: "n2", nodeType: "skill", label: "autoplan", stage: "planning", status: "complete", isRequired: true, isStale: false, skillName: "autoplan" },
    { id: "n3", nodeType: "skill", label: "design-consultation", stage: "design", status: "ready", isRequired: true, isStale: false, skillName: "design-consultation" },
    { id: "n4", nodeType: "skill", label: "design-review", stage: "design", status: "not_run", isRequired: false, isStale: false, skillName: "design-review" },
    { id: "n5", nodeType: "skill", label: "review", stage: "qa", status: "not_run", isRequired: true, isStale: false, skillName: "review" },
    { id: "n6", nodeType: "skill", label: "qa", stage: "qa", status: "blocked", isRequired: true, isStale: false, skillName: "qa" },
    { id: "n7", nodeType: "skill", label: "ship", stage: "shipped", status: "blocked", isRequired: true, isStale: false, skillName: "ship" },
  ],
  edges: [
    { id: "e1", fromNodeId: "n1", toNodeId: "n2", edgeType: "prerequisite", required: true },
    { id: "e2", fromNodeId: "n2", toNodeId: "n3", edgeType: "prerequisite", required: true },
    { id: "e3", fromNodeId: "n3", toNodeId: "n4", edgeType: "recommends", required: false },
    { id: "e4", fromNodeId: "n3", toNodeId: "n5", edgeType: "prerequisite", required: true },
    { id: "e5", fromNodeId: "n5", toNodeId: "n6", edgeType: "prerequisite", required: true },
    { id: "e6", fromNodeId: "n6", toNodeId: "n7", edgeType: "prerequisite", required: true },
  ],
  blockers: ["design-consultation has not been run yet"],
  suggestedNextSkills: ["design-consultation"],
};

export const MOCK_BROWSER_SNAPSHOTS = [
  { id: 'snap-1', url: 'https://counselpro.ai/dashboard', title: 'Dashboard - CounselPro', createdAt: '2026-05-02T09:00:00Z', screenshot: null, promptInjectionDetected: false, consoleErrors: 0 },
  { id: 'snap-2', url: 'https://counselpro.ai/login', title: 'Login - CounselPro', createdAt: '2026-05-02T09:05:00Z', screenshot: null, promptInjectionDetected: true, consoleErrors: 2 },
];

export const MOCK_DEPLOY_RUNS = [
  { id: 'dep-1', type: 'dry-run', status: 'complete', verdict: 'PASS', environment: 'production', startedAt: '2026-05-01T10:00:00Z', healthCheck: 'PASS' },
  { id: 'dep-2', type: 'full', status: 'blocked', verdict: 'IN_PROGRESS', environment: 'production', startedAt: '2026-05-02T11:00:00Z', healthCheck: 'SKIPPED' },
];

export const MOCK_BENCHMARK_RUNS = [
  {
    id: 'bench-1',
    suite: 'UI Generation Suite',
    date: '2026-05-01T15:00:00Z',
    results: [
      { model: 'gemini-2.0-flash', quality: 85, latency: 1200, cost: 0.002 },
      { model: 'gemini-1.5-pro', quality: 92, latency: 3500, cost: 0.015 },
      { model: 'claude-3-opus', quality: 94, latency: 5200, cost: 0.045 },
    ]
  }
];

export const MOCK_LEARNINGS = [
  { id: 'learn-1', topic: 'Architecture', insight: 'Prefer server components for data fetching to reduce client bundle size.', source: 'manual', createdAt: '2026-04-28T09:00:00Z' },
  { id: 'learn-2', topic: 'UX Patterns', insight: 'Users prefer explicit confirmation for destructive actions over simple undos.', source: 'retro', createdAt: '2026-04-30T14:00:00Z' },
];

export interface ToolCall {
  id: string;
  tool: 'shell' | 'file' | 'git' | 'browser' | 'skill';
  command: string;
  args: string;
  duration: string;
  status: 'success' | 'error' | 'running';
  gate: 'ALLOW' | 'REQUIRE_APPROVAL' | 'DENY';
  output: string;
}

export interface ExecutionTurn {
  id: string;
  type: 'user' | 'thought' | 'tool_call' | 'approval' | 'artifact';
  content?: string;
  timestamp: string;
  toolCall?: ToolCall;
  artifact?: Artifact;
  approvalRequest?: {
    action: string;
    level: 'EXECUTE' | 'WRITE' | 'DESTRUCTIVE';
    status: 'pending' | 'approved' | 'denied';
  };
}

export const MOCK_EXECUTION_SESSION: ExecutionTurn[] = [
  {
    id: 't1',
    type: 'user',
    content: '/qa --scope auth/',
    timestamp: '10:42 AM'
  },
  {
    id: 't2',
    type: 'thought',
    content: 'I will begin by exploring the authentication logic in the web package. I need to verify if the login and onboarding flows are strictly following the established design tokens.',
    timestamp: '10:42 AM'
  },
  {
    id: 't3',
    type: 'tool_call',
    timestamp: '10:42 AM',
    toolCall: {
      id: 'tc1',
      tool: 'file',
      command: 'read_file',
      args: 'packages/web/src/app/login/page.tsx',
      duration: '45ms',
      status: 'success',
      gate: 'ALLOW',
      output: '// Login page content...\nimport { useApp } from "@/lib/app-context";\n// ...'
    }
  },
  {
    id: 't4',
    type: 'thought',
    content: 'The login page is using the correct context. Now I will check for any console errors or prompt injection vulnerabilities in the current auth state.',
    timestamp: '10:43 AM'
  },
  {
    id: 't5',
    type: 'tool_call',
    timestamp: '10:43 AM',
    toolCall: {
      id: 'tc2',
      tool: 'browser',
      command: 'take_screenshot',
      args: 'http://localhost:3000/login',
      duration: '1.2s',
      status: 'success',
      gate: 'ALLOW',
      output: '[Screenshot Captured]'
    }
  },
  {
    id: 't6',
    type: 'approval',
    timestamp: '10:44 AM',
    approvalRequest: {
      action: 'run_skill /qa --force-override',
      level: 'EXECUTE',
      status: 'pending'
    }
  },
  {
    id: 't7',
    type: 'artifact',
    timestamp: '10:45 AM',
    artifact: {
      id: 'art-fail',
      skillName: 'qa',
      artifactType: 'JSON',
      version: 'v1',
      createdAt: '2026-05-02T10:45:00Z',
      isLatest: true,
      relativePath: '.dstack/artifacts/qa/report.json',
      verdict: 'FAIL',
      summary: '2 critical failures in auth flow validation.',
      warnings: ['Vulnerability: SQL Injection in login field'],
      content: { failures: 2, critical: true }
    }
  }
];
