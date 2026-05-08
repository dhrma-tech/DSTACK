import chalk from "chalk";
import type { ProviderName, SkillManifest, SkillRunResult, Contracts } from "@dstack/shared";
import type { SkillAuditReport } from "@dstack/core";
import { randomUUID } from "node:crypto";

export interface RuntimeStatus {
  safetyMode: string;
  deployFrozen: boolean;
  deployFreezeReason: string | null;
}

export function helpText(): string {
  return [
    "DStack CLI",
    "",
    "Usage:",
    "  ds --list-skills",
    "  ds --skill-check",
    "  ds /office-hours --idea \"Build a product\"",
    "  ds /autoplan",
    "  ds /qa --url http://localhost:3000",
    "",
    "Flags:",
    "  --force          Bypass workflow stage gates",
    "  --dry-run        Do not write artifacts",
    "  --model <name>   Override skill model",
    "  --provider <p>   Select provider: gemini or fake",
    "  --json           Print full artifact JSON",
    "  --verbose        Print full artifact JSON",
    "  --allow-secrets  Allow secret reads where supported"
  ].join("\n");
}
export const versionText = (version: string): string => `ds ${version}`;
export const skillsText = (skills: SkillManifest[]): string => skills.map((skill) => `${chalk.cyan(skill.name)} ${skill.description}`).join("\n");
export function skillCheckText(report: SkillAuditReport): string {
  return [
    "DStack Skill Check",
    `Total skills: ${report.totalSkills}`,
    `Status: ${report.passed ? "PASS" : "FAIL"}`,
    `Manifest validation: ${report.totalSkills}/42 loaded`,
    `Errors: ${report.errors.length}`,
    `Warnings: ${report.warnings.length}`,
    `Phase 2 central shim skills: ${report.centralShimSkills.length > 0 ? report.centralShimSkills.join(", ") : "none"}`,
    "",
    ...(report.errors.length > 0 ? ["Errors:", ...report.errors.map((issue) => `- ${issue.skillName} [${issue.check}] ${issue.message}`), ""] : []),
    ...(report.warnings.length > 0 ? ["Warnings:", ...report.warnings.map((issue) => `- ${issue.skillName} [${issue.check}] ${issue.message}`)] : [])
  ].join("\n");
}
// JSON Envelope Functions
export function createApiEnvelope<T>(data: T | null, options: {
  command?: string;
  projectId?: string;
  runId?: string;
  exitCode?: number;
  warnings?: Array<{ code: string; message: string; severity: "info" | "warning" | "error" }>;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
    details?: object | null;
    fieldErrors?: Array<{ field: string; message: string }>;
    approvalRequired?: boolean;
    requiredHash?: string | null;
  };
}): Contracts.ApiEnvelope<T> {
  const requestId = randomUUID();
  const timestamp = new Date().toISOString();
  
  const meta: {
    requestId: string;
    timestamp: string;
    apiVersion: "v1";
    command?: string;
    projectId?: string;
    runId?: string;
    exitCode?: number;
  } = {
    requestId,
    timestamp,
    apiVersion: "v1"
  };
  
  if (options.command) meta.command = options.command;
  if (options.projectId) meta.projectId = options.projectId;
  if (options.runId) meta.runId = options.runId;
  if (options.exitCode !== undefined) meta.exitCode = options.exitCode;

  return {
    ok: !options.error,
    data,
    warnings: options.warnings || [],
    error: options.error ? {
      ...options.error,
      requestId
    } : null,
    meta
  };
}

export function printJsonEnvelope<T>(envelope: Contracts.ApiEnvelope<T>): void {
  // Ensure stdout contains only JSON (no ANSI codes, no extra whitespace)
  console.log(JSON.stringify(envelope, null, 0));
}

export function skillsJson(skills: SkillManifest[]): Contracts.ApiEnvelope<SkillManifest[]> {
  return createApiEnvelope(skills, {
    command: "list-skills"
  });
}

export function skillCheckJson(report: SkillAuditReport): Contracts.ApiEnvelope<SkillAuditReport> {
  return createApiEnvelope(report, {
    command: "skill-check",
    warnings: [
      ...(report.errors.map(err => ({
        code: "MANIFEST_ERROR",
        message: err.message,
        severity: "error" as const
      }))),
      ...(report.warnings.map(warn => ({
        code: "MANIFEST_WARNING", 
        message: warn.message,
        severity: "warning" as const
      })))
    ]
  });
}

export function healthJson(status: RuntimeStatus): Contracts.ApiEnvelope<RuntimeStatus> {
  return createApiEnvelope(status, {
    command: "health"
  });
}

export function resultJson(result: SkillRunResult, options: { 
  provider: ProviderName; 
  includeOutput: boolean; 
  runtimeStatus?: RuntimeStatus;
  projectId?: string;
}): Contracts.ApiEnvelope<SkillRunResult> {
  const envelopeOptions: {
    command: string;
    projectId?: string;
    warnings: Array<{ code: string; message: string; severity: "warning" }>;
  } = {
    command: result.skillName,
    warnings: result.warnings?.map(w => ({
      code: "RUN_WARNING",
      message: w,
      severity: "warning" as const
    })) || []
  };
  
  if (options.projectId) {
    envelopeOptions.projectId = options.projectId;
  }
  
  return createApiEnvelope(result, envelopeOptions);
}

export function resultText(result: SkillRunResult, options: { provider: ProviderName; includeOutput: boolean; runtimeStatus?: RuntimeStatus }): string {
  const status = options.runtimeStatus;
  const lines = [
    `${chalk.green("Completed")} ${result.skillName}`,
    `Status: ${result.status}`,
    `Provider: ${options.provider}`,
    ...(status && status.safetyMode !== "NORMAL" ? [`Safety mode: ${status.safetyMode}`] : []),
    ...(status?.deployFrozen ? [`Deploy status: DEPLOY FROZEN${status.deployFreezeReason ? ` (${status.deployFreezeReason})` : ""}`] : []),
    ...(result.verdict ? [`Verdict: ${result.verdict}`] : []),
    `Artifact: ${result.artifactPath ?? "not written"}`,
    `Next skill: ${result.nextSkill ?? "none"}`
  ];
  if (options.includeOutput && result.output) {
    lines.push("", "Artifact JSON:", JSON.stringify(result.output, null, 2));
  }
  return lines.join("\n");
}
export function errorText(error: unknown): string {
  return chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`);
}
