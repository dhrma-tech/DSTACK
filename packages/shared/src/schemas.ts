import { z } from "zod";
import type { JsonValue } from "./types.js";

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)])
);
export const jsonObjectSchema = z.record(z.string(), jsonValueSchema);

export const skillManifestSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  triggerPhrases: z.array(z.string()),
  model: z.string().min(1),
  streaming: z.boolean(),
  requiresArtifacts: z.array(z.string()),
  allowedTools: z.array(z.string()),
  inputs: z.array(z.object({ name: z.string(), type: z.string(), required: z.boolean(), description: z.string() })),
  outputSchema: jsonObjectSchema,
  artifactPath: z.string().min(1),
  nextSkill: z.string().nullable(),
  failureCases: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
  systemPromptFile: z.string().min(1)
});

export const projectMemorySchema = z.object({
  version: z.literal("1"),
  projectName: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  techStack: z.object({ frontend: z.string(), backend: z.string(), database: z.string(), infra: z.string(), testing: z.string() }),
  goals: z.array(z.string()),
  constraints: z.array(z.string()),
  keyDecisions: z.array(z.object({ decision: z.string(), rationale: z.string(), date: z.string() })),
  domainTerms: z.record(z.string(), z.string()),
  openQuestions: z.array(z.string())
});

export const checkpointSchema = z.object({
  name: z.string(),
  savedAt: z.string(),
  gitHead: z.string(),
  branch: z.string(),
  memorySnapshot: projectMemorySchema.nullable(),
  artifactPointers: z.record(z.string(), z.string()),
  summary: z.string()
});

export const dstackConfigSchema = z.object({
  projectRoot: z.string(),
  dstackDir: z.string(),
  geminiApiKey: z.string().nullable(),
  provider: z.enum(["gemini", "fake"]),
  defaultModel: z.string(),
  proModel: z.string(),
  maxTokens: z.number().int().positive(),
  requestTimeoutMs: z.number().int().positive(),
  maxRetries: z.number().int().nonnegative(),
  retryBaseDelayMs: z.number().int().positive(),
  maxToolCalls: z.number().int().positive(),
  logLevel: z.enum(["debug", "info", "error"]),
  allowSecrets: z.boolean(),
  browserHeadless: z.boolean(),
  defaultBrowserUrl: z.string(),
  requireApprovalForFileOverwrite: z.boolean(),
  requireApprovalForGitCommit: z.boolean(),
  requireApprovalForShellCommands: z.boolean(),
  skillOverrides: z.record(z.string(), z.object({ model: z.string().optional(), streaming: z.boolean().optional(), temperature: z.number().optional() }).partial())
});

export const agentPersonaSchema = z.enum(["CEO", "PM", "DESIGNER", "DEVELOPER", "QA", "CSO", "SECURITY", "HUMAN", "SYSTEM"]);
export const workflowStageSchema = z.enum(["IDLE", "PLANNING", "DESIGNING", "BUILDING", "AUDITING", "SHIPPING"]);

export const workflowTransitionSchema = z.object({
  from: workflowStageSchema,
  to: workflowStageSchema,
  actor: agentPersonaSchema,
  createdAt: z.string(),
  rationale: z.string(),
  assetHash: z.string().nullable(),
  approvalTokenId: z.string().nullable(),
  affectedFiles: z.array(z.string()),
  metadata: z.record(z.string(), jsonValueSchema)
});

export const approvalGateSchema = z.object({
  id: z.string(),
  runId: z.string(),
  stage: workflowStageSchema,
  actor: agentPersonaSchema,
  title: z.string(),
  description: z.string(),
  transition: workflowTransitionSchema.nullable(),
  artifactHash: z.string().nullable(),
  commandImpact: z.array(z.string()),
  fileImpact: z.array(z.string()),
  safetyMode: z.enum(["NORMAL", "CAREFUL", "GUARD"]),
  status: z.enum(["pending", "approved", "denied"]),
  createdAt: z.string()
});

export const codePatchSchema = z.object({
  id: z.string(),
  filePath: z.string(),
  agent: agentPersonaSchema,
  operation: z.enum(["create", "update", "delete"]),
  before: z.string().nullable(),
  after: z.string().nullable(),
  diff: z.array(z.object({
    kind: z.enum(["context", "add", "delete"]),
    lineNumber: z.number().int().nonnegative(),
    text: z.string()
  })),
  contentHash: z.string(),
  createdAt: z.string()
});

export const visualQaFindingSchema = z.object({
  id: z.string(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "BLOCKER"]),
  category: z.enum(["layout", "overflow", "contrast", "accessibility", "copy", "interaction", "responsive"]),
  selector: z.string().nullable(),
  description: z.string(),
  evidence: z.string(),
  recommendedFix: z.string(),
  filePath: z.string().nullable(),
  cssHint: z.string().nullable(),
  screenshotRegion: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number()
  }).nullable()
});

export const workflowStalledSchema = z.object({
  issueHash: z.string(),
  agentPair: z.tuple([agentPersonaSchema, agentPersonaSchema]),
  bounceCount: z.number().int().positive(),
  reason: z.string(),
  lastFinding: z.string(),
  recommendedHumanAction: z.string()
});

export const agentEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("agent_started"), id: z.string(), runId: z.string(), timestamp: z.string(), agent: agentPersonaSchema, title: z.string(), message: z.string() }),
  z.object({ type: z.literal("reasoning_trace"), id: z.string(), runId: z.string(), timestamp: z.string(), agent: agentPersonaSchema, steps: z.array(z.string()), activeStep: z.number().int().nonnegative() }),
  z.object({ type: z.literal("tool_call"), id: z.string(), runId: z.string(), timestamp: z.string(), agent: agentPersonaSchema, toolName: z.string(), args: jsonObjectSchema, permission: z.enum(["ALLOW", "REQUIRE_APPROVAL", "DENY"]) }),
  z.object({ type: z.literal("tool_result"), id: z.string(), runId: z.string(), timestamp: z.string(), toolCallId: z.string(), success: z.boolean(), stdout: z.string(), stderr: z.string(), code: z.number().int() }),
  z.object({ type: z.literal("file_patch"), id: z.string(), runId: z.string(), timestamp: z.string(), patch: codePatchSchema }),
  z.object({ type: z.literal("approval_required"), id: z.string(), runId: z.string(), timestamp: z.string(), gate: approvalGateSchema }),
  z.object({ type: z.literal("artifact_saved"), id: z.string(), runId: z.string(), timestamp: z.string(), skillName: z.string(), artifactPath: z.string(), verdict: z.enum(["PASS", "REVISE", "FAIL"]).nullable(), contentHash: z.string() }),
  z.object({ type: z.literal("preview_ready"), id: z.string(), runId: z.string(), timestamp: z.string(), previewUrl: z.string(), provider: z.string(), health: z.enum(["starting", "ready", "error"]) }),
  z.object({ type: z.literal("visual_qa_result"), id: z.string(), runId: z.string(), timestamp: z.string(), findings: z.array(visualQaFindingSchema), screenshotPath: z.string().nullable() }),
  z.object({ type: z.literal("workflow_stalled"), id: z.string(), runId: z.string(), timestamp: z.string(), stalled: workflowStalledSchema }),
  z.object({ type: z.literal("run_complete"), id: z.string(), runId: z.string(), timestamp: z.string(), verdict: z.enum(["PASS", "REVISE", "FAIL"]), summary: z.string() }),
  z.object({ type: z.literal("run_error"), id: z.string(), runId: z.string(), timestamp: z.string(), message: z.string(), retryable: z.boolean() })
]);

export type AgentPersona = z.infer<typeof agentPersonaSchema>;
export type AgentEvent = z.infer<typeof agentEventSchema>;
export type ApprovalGate = z.infer<typeof approvalGateSchema>;
export type CodePatch = z.infer<typeof codePatchSchema>;
export type VisualQaFinding = z.infer<typeof visualQaFindingSchema>;
export type WorkflowStalled = z.infer<typeof workflowStalledSchema>;
export type WorkflowTransition = z.infer<typeof workflowTransitionSchema>;
