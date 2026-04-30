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
