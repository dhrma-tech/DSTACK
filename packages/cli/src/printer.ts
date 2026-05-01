import chalk from "chalk";
import type { ProviderName, SkillManifest, SkillRunResult } from "@dstack/shared";
import type { SkillAuditReport } from "@dstack/core";

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
export const skillsText = (skills: SkillManifest[]): string => skills.map((skill) => `${chalk.cyan(`/${skill.name}`)} ${skill.description}`).join("\n");
export function skillCheckText(report: SkillAuditReport): string {
  return [
    "DStack Skill Check",
    `Total skills: ${report.totalSkills}`,
    `Status: ${report.passed ? "PASS" : "FAIL"}`,
    `Manifest validation: ${report.totalSkills}/42 loaded`,
    `Errors: ${report.errors.length}`,
    `Warnings: ${report.warnings.length}`,
    `Phase 2 central shim skills: ${report.centralShimSkills.length > 0 ? report.centralShimSkills.map((skill) => `/${skill}`).join(", ") : "none"}`,
    "",
    ...(report.errors.length > 0 ? ["Errors:", ...report.errors.map((issue) => `- /${issue.skillName} [${issue.check}] ${issue.message}`), ""] : []),
    ...(report.warnings.length > 0 ? ["Warnings:", ...report.warnings.map((issue) => `- /${issue.skillName} [${issue.check}] ${issue.message}`)] : [])
  ].join("\n");
}
export function resultText(result: SkillRunResult, options: { provider: ProviderName; includeOutput: boolean }): string {
  const lines = [
    `${chalk.green("Completed")} /${result.skillName}`,
    `Status: ${result.status}`,
    `Provider: ${options.provider}`,
    ...(result.verdict ? [`Verdict: ${result.verdict}`] : []),
    `Artifact: ${result.artifactPath ?? "not written"}`,
    `Next: ${result.nextSkill ? `ds /${result.nextSkill}` : "none"}`
  ];
  if (options.includeOutput && result.output) {
    lines.push("", "Artifact JSON:", JSON.stringify(result.output, null, 2));
  }
  return lines.join("\n");
}
export function errorText(error: unknown): string {
  return chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`);
}
