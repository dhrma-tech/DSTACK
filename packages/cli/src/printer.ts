import chalk from "chalk";
import type { SkillManifest, SkillRunResult } from "@dstack/shared";

export function helpText(): string {
  return [
    "DStack CLI",
    "",
    "Usage:",
    "  ds --list-skills",
    "  ds /office-hours --idea \"Build a product\"",
    "  ds /autoplan",
    "  ds /qa --url http://localhost:3000",
    "",
    "Flags:",
    "  --force          Bypass workflow stage gates",
    "  --dry-run        Do not write artifacts",
    "  --model <name>   Override skill model",
    "  --allow-secrets  Allow secret reads where supported"
  ].join("\n");
}
export const versionText = (version: string): string => `ds ${version}`;
export const skillsText = (skills: SkillManifest[]): string => skills.map((skill) => `${chalk.cyan(`/${skill.name}`)} ${skill.description}`).join("\n");
export function resultText(result: SkillRunResult): string {
  return [`${chalk.green("Completed")} /${result.skillName}`, `Status: ${result.status}`, `Verdict: ${result.verdict ?? "n/a"}`, `Artifact: ${result.artifactPath ?? "not written"}`, `Next: ${result.nextSkill ? `/${result.nextSkill}` : "none"}`, "", result.output ? JSON.stringify(result.output, null, 2) : ""].join("\n");
}
export function errorText(error: unknown): string {
  return chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`);
}
