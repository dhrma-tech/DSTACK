import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type JsonObject, type SkillManifest, ValidationError } from "@dstack/shared";
import { defaultOutputs } from "../default-outputs.js";
import { SkillRegistry, validateJsonSchema } from "../skills.js";
import { ToolRegistry } from "../tools.js";
import { exists } from "../utils.js";

export type SkillAuditSeverity = "error" | "warning";

export interface SkillAuditIssue {
  severity: SkillAuditSeverity;
  skillName: string;
  check: string;
  message: string;
}

export interface SkillAuditReport {
  totalSkills: number;
  errors: SkillAuditIssue[];
  warnings: SkillAuditIssue[];
  checkedAt: string;
  centralShimSkills: string[];
  partialSkills: string[];
  highRiskPartialSkills: string[];
  passed: boolean;
}

const defaultDefinitionsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "definitions");
const phase2SkillNames = new Set([
  "plan-design-review",
  "plan-devex-review",
  "devex-review",
  "design-shotgun",
  "design-html",
  "landing-report",
  "setup-deploy",
  "land-and-deploy",
  "setup-browser-cookies",
  "scrape",
  "pair-agent",
  "health",
  "retro",
  "guard",
  "careful",
  "learn",
  "setup-memory",
  "make-pdf",
  "benchmark",
  "benchmark-models",
  "skillify",
  "codex",
  "cso",
  "freeze",
  "unfreeze",
  "canary",
  "dstack-upgrade",
  "plan-tune"
]);

const highRiskSkills = new Set([
  "land-and-deploy",
  "setup-deploy", 
  "scrape",
  "browse",
  "benchmark",
  "benchmark-models",
  "skillify",
  "pair-agent",
  "setup-browser-cookies",
  "make-pdf",
  "dstack-upgrade"
]);

// Skills known to be partial/experimental
const partialSkills = new Set([
  "pair-agent",
  "benchmark-models",
  "codex",
  "cso",
  "skillify"
]);

export class SkillAuditor {
  private readonly registry: SkillRegistry;
  private readonly tools = new ToolRegistry();

  constructor(private readonly options: { definitionsDir?: string } = {}) {
    this.registry = new SkillRegistry(options.definitionsDir ?? defaultDefinitionsDir);
  }

  async audit(): Promise<SkillAuditReport> {
    const issues: SkillAuditIssue[] = [];
    let skills: SkillManifest[] = [];
    try {
      skills = await this.registry.list();
    } catch (error) {
      issues.push({
        severity: "error",
        skillName: "*",
        check: "manifest-load",
        message: error instanceof Error ? error.message : String(error)
      });
    }

    const centralShimSkills: string[] = [];
    for (const skill of skills) {
      issues.push(...this.validateTools(skill));
      issues.push(...this.validateArtifactPath(skill));
      issues.push(...this.validateOutputSchemaShape(skill));
      issues.push(...this.validateFakeOutput(skill));
      issues.push(...this.validateBehaviorFields(skill));
      const handlerIssues = await this.validateHandler(skill);
      issues.push(...handlerIssues.issues);
      if (handlerIssues.usesCentralShim) centralShimSkills.push(skill.name);
    }

    for (const skillName of centralShimSkills.filter((name) => phase2SkillNames.has(name)).sort()) {
      issues.push({
        severity: "warning",
        skillName,
        check: "phase2-central-shim",
        message: `${skillName} still delegates to phase2SkillHandler; replace with a skill-specific handler when hardening this skill.`
      });
    }

    const errors = issues.filter((issue) => issue.severity === "error");
    const warnings = issues.filter((issue) => issue.severity === "warning");
    
    // Identify partial and high-risk partial skills
    const partialSkillsFound = skills
      .filter(skill => partialSkills.has(skill.name))
      .map(skill => skill.name)
      .sort();
    
    const highRiskPartialSkillsFound = partialSkillsFound
      .filter(skillName => highRiskSkills.has(skillName))
      .sort();
    
    return {
      totalSkills: skills.length,
      errors,
      warnings,
      checkedAt: new Date().toISOString(),
      centralShimSkills: centralShimSkills.sort(),
      partialSkills: partialSkillsFound,
      highRiskPartialSkills: highRiskPartialSkillsFound,
      passed: errors.length === 0
    };
  }

  private validateTools(skill: SkillManifest): SkillAuditIssue[] {
    const issues: SkillAuditIssue[] = [];
    for (const toolName of skill.allowedTools) {
      try {
        this.tools.get(toolName);
      } catch {
        issues.push({ severity: "error", skillName: skill.name, check: "declared-tools", message: `Unknown declared tool: ${toolName}` });
      }
    }
    return issues;
  }

  private validateArtifactPath(skill: SkillManifest): SkillAuditIssue[] {
    const artifactPath = skill.artifactPath;
    if (!artifactPath.trim()) return [{ severity: "error", skillName: skill.name, check: "artifact-path", message: "artifactPath is empty." }];
    if (path.isAbsolute(artifactPath) || artifactPath.split(/[\\/]+/).includes("..")) {
      return [{ severity: "error", skillName: skill.name, check: "artifact-path", message: `artifactPath must stay inside .dstack/artifacts: ${artifactPath}` }];
    }
    if (!/^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)*$/i.test(artifactPath)) {
      return [{ severity: "error", skillName: skill.name, check: "artifact-path", message: `artifactPath contains unsafe characters: ${artifactPath}` }];
    }
    return [];
  }

  private validateOutputSchemaShape(skill: SkillManifest): SkillAuditIssue[] {
    const schema = skill.outputSchema;
    const issues: SkillAuditIssue[] = [];
    if (schema.type !== "object") {
      issues.push({ severity: "error", skillName: skill.name, check: "output-schema", message: "outputSchema.type must be object." });
    }
    const properties = objectValue(schema.properties);
    if (!properties) {
      issues.push({ severity: "error", skillName: skill.name, check: "output-schema", message: "outputSchema.properties must be an object." });
    }
    const required = stringArray(schema.required);
    if (!required) {
      issues.push({ severity: "error", skillName: skill.name, check: "output-schema", message: "outputSchema.required must be a string array." });
    } else if (properties) {
      for (const field of required) {
        if (properties[field] === undefined) {
          issues.push({ severity: "error", skillName: skill.name, check: "output-schema", message: `Required output field "${field}" is not defined in properties.` });
        }
      }
    }
    return issues;
  }

  private validateFakeOutput(skill: SkillManifest): SkillAuditIssue[] {
    const fixture = defaultOutputs[skill.name];
    if (!fixture) {
      return [{ severity: "error", skillName: skill.name, check: "fake-output", message: "No fake-provider/default output fixture exists for this skill." }];
    }
    const issues = validateJsonSchema(skill.outputSchema, fixture, "$");
    return issues.map((issue) => ({ severity: "error" as const, skillName: skill.name, check: "fake-output", message: issue }));
  }

  private validateBehaviorFields(skill: SkillManifest): SkillAuditIssue[] {
    const issues: SkillAuditIssue[] = [];
    
    // Only check high-risk skills for behavior fields
    if (!highRiskSkills.has(skill.name)) {
      return issues;
    }

    const schema = skill.outputSchema;
    const properties = objectValue(schema.properties);
    if (!properties) {
      return issues; // Already caught by schema validation
    }

    // Determine if this skill should be downgraded to warning (manifest not updated yet)
    const shouldDowngrade = partialSkills.has(skill.name) || 
                          skill.name === "browse" || 
                          skill.name === "dstack-upgrade" ||
                          skill.name === "make-pdf" ||
                          skill.name === "pair-agent" ||
                          skill.name === "setup-browser-cookies" ||
                          skill.name === "scrape" ||
                          skill.name === "benchmark-models";

    // Skill-specific behavior field checks
    switch (skill.name) {
      case "land-and-deploy":
        if (!properties.approvalRequired || !properties.deployVerdict || !properties.gitHead) {
          issues.push({
            severity: shouldDowngrade ? "warning" : "error",
            skillName: skill.name,
            check: "behavior-fields",
            message: "land-and-deploy must include approvalRequired, deployVerdict, and gitHead fields for safety"
          });
        }
        break;

      case "scrape":
        if (!properties.robots || !properties.allowed || !properties.scannerFindings) {
          issues.push({
            severity: shouldDowngrade ? "warning" : "error", 
            skillName: skill.name,
            check: "behavior-fields",
            message: "scrape must include robots, allowed, and scannerFindings fields for compliance"
          });
        }
        break;

      case "browse":
        if (!properties.interactiveRefs || !properties.promptInjectionDetected) {
          issues.push({
            severity: "warning", // Always warning for now since browse manifest not updated
            skillName: skill.name,
            check: "behavior-fields", 
            message: "browse must include interactiveRefs and promptInjectionDetected fields for reliability"
          });
        }
        break;

      case "benchmark-models":
        // Check if ANY of the cost control fields are present (OR logic)
        if (!properties.dryRun && !properties.estimate && !properties.liveMode) {
          issues.push({
            severity: shouldDowngrade ? "warning" : "error",
            skillName: skill.name,
            check: "behavior-fields",
            message: "benchmark-models must include dryRun, estimate, or liveMode fields for cost control"
          });
        }
        break;

      case "pair-agent":
        if (!properties.safetyFields || !properties.sessionToken || !properties.explicitSafety) {
          issues.push({
            severity: "warning", // Always warning for now since pair-agent manifest not updated
            skillName: skill.name,
            check: "behavior-fields",
            message: "pair-agent must include safetyFields, sessionToken, and explicitSafety for security"
          });
        }
        break;

      case "setup-browser-cookies":
        if (!properties.manualApproval || !properties.sessionFields) {
          issues.push({
            severity: "warning", // Always warning for now since setup-browser-cookies manifest not updated
            skillName: skill.name,
            check: "behavior-fields",
            message: "setup-browser-cookies must include manualApproval and sessionFields for security"
          });
        }
        break;

      case "dstack-upgrade":
        if (!properties.backup || !properties.verify || !properties.rollback) {
          issues.push({
            severity: "warning", // Always warning for now since dstack-upgrade manifest not updated
            skillName: skill.name,
            check: "behavior-fields",
            message: "dstack-upgrade must include backup, verify, and rollback fields for safety"
          });
        }
        break;

      case "make-pdf":
        if (!properties.outputPath || !properties.renderStatus) {
          issues.push({
            severity: "warning", // Always warning for now since make-pdf manifest not updated
            skillName: skill.name,
            check: "behavior-fields",
            message: "make-pdf must include outputPath and renderStatus for validation"
          });
        }
        break;
    }

    // Add warning for partial skills
    if (partialSkills.has(skill.name)) {
      issues.push({
        severity: "warning",
        skillName: skill.name,
        check: "maturity",
        message: `${skill.name} is marked as partial/experimental - use with caution`
      });
    }

    return issues;
  }

  private async validateHandler(skill: SkillManifest): Promise<{ issues: SkillAuditIssue[]; usesCentralShim: boolean }> {
    const handlerPath = path.join(this.registry.definitionDirFor(skill.name), "handler.ts");
    if (!(await exists(handlerPath))) {
      return { usesCentralShim: false, issues: [{ severity: "error", skillName: skill.name, check: "handler", message: "handler.ts is missing and no explicit fallback is declared." }] };
    }
    const source = await readFile(handlerPath, "utf8");
    const exportsDefault = /\bexport\s+default\b/.test(source);
    const acceptedFallback = /\bcreateModelSkillHandler\b|\bcontextSaveHandler\b|\bcontextRestoreHandler\b|\bphase2SkillHandler\b/.test(source);
    const usesCentralShim = /\bphase2SkillHandler\s*\(/.test(source);
    if (!exportsDefault && !acceptedFallback) {
      return { usesCentralShim, issues: [{ severity: "error", skillName: skill.name, check: "handler", message: "handler.ts does not export a default handler or accepted fallback." }] };
    }
    return { usesCentralShim, issues: [] };
  }
}

function objectValue(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : null;
}

function stringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : null;
}

export function assertSkillAuditPassed(report: SkillAuditReport): void {
  if (!report.passed) {
    throw new ValidationError(`Skill audit failed with ${report.errors.length} error(s).`, { errors: report.errors as unknown as JsonObject[] });
  }
}
