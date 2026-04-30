export type DStackErrorCode = "TOOL_ERROR" | "MODEL_ERROR" | "ARTIFACT_ERROR" | "PERMISSION_ERROR" | "SKILL_ERROR" | "VALIDATION_ERROR" | "CONFIG_ERROR";

export class DStackError extends Error {
  readonly code: DStackErrorCode;
  readonly details: Record<string, unknown>;
  constructor(code: DStackErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "DStackError";
    this.code = code;
    this.details = details;
  }
}

export class ToolError extends DStackError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("TOOL_ERROR", message, details);
    this.name = "ToolError";
  }
}

export class ModelError extends DStackError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("MODEL_ERROR", message, details);
    this.name = "ModelError";
  }
}

export class ArtifactError extends DStackError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("ARTIFACT_ERROR", message, details);
    this.name = "ArtifactError";
  }
}

export class PermissionError extends DStackError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("PERMISSION_ERROR", message, details);
    this.name = "PermissionError";
  }
}

export class SkillError extends DStackError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("SKILL_ERROR", message, details);
    this.name = "SkillError";
  }
}

export class ValidationError extends DStackError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("VALIDATION_ERROR", message, details);
    this.name = "ValidationError";
  }
}

export class ConfigError extends DStackError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("CONFIG_ERROR", message, details);
    this.name = "ConfigError";
  }
}
