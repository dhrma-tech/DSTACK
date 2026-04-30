import path from "node:path";
import { ArtifactError, type DeployConfig, type DeployRun, type JsonObject } from "@dstack/shared";
import { atomicWrite, ensureDir, exists, fileSafeTimestamp, nowIso, readJsonFile, shortHash } from "../utils.js";

export interface DeployManagerOptions {
  projectRoot: string;
  dstackDir: string;
}

export type DeployManagerConfig = DeployConfig;
export type DeployManagerRun = DeployRun;

export interface DeployFreezeState {
  frozen: boolean;
  frozenAt: string | null;
  reason: string | null;
  frozenUntil: string | null;
}

export class DeployManager {
  readonly configPath: string;
  readonly statePath: string;
  readonly runDir: string;

  constructor(private readonly options: DeployManagerOptions) {
    this.configPath = path.join(options.dstackDir, "deploy.json");
    this.statePath = path.join(options.dstackDir, "deploy-state.json");
    this.runDir = path.join(options.dstackDir, "deploy-runs");
  }

  async readConfig(): Promise<DeployConfig> {
    if (!(await exists(this.configPath))) throw new ArtifactError("Deploy config not found. Run /setup-deploy first.");
    return parseDeployConfig(await readJsonFile<unknown>(this.configPath));
  }

  async writeConfig(config: DeployConfig): Promise<DeployConfig> {
    const parsed = parseDeployConfig(config);
    await atomicWrite(this.configPath, JSON.stringify(parsed, null, 2));
    return parsed;
  }

  async freeze(reason: string | null = null, frozenUntil: string | null = null): Promise<DeployFreezeState> {
    const current = await this.readState();
    if (current.frozen) return current;
    const state: DeployFreezeState = { frozen: true, frozenAt: nowIso(), reason, frozenUntil };
    await atomicWrite(this.statePath, JSON.stringify(state, null, 2));
    return state;
  }

  async unfreeze(): Promise<DeployFreezeState> {
    const current = await this.readState();
    const state: DeployFreezeState = { frozen: false, frozenAt: current.frozenAt, reason: current.reason, frozenUntil: current.frozenUntil };
    await atomicWrite(this.statePath, JSON.stringify(state, null, 2));
    return current;
  }

  async isFrozen(): Promise<boolean> {
    return (await this.readState()).frozen;
  }

  async readState(): Promise<DeployFreezeState> {
    if (!(await exists(this.statePath))) return { frozen: false, frozenAt: null, reason: null, frozenUntil: null };
    const raw = await readJsonFile<unknown>(this.statePath);
    if (!isRecord(raw)) throw new ArtifactError("Deploy state is invalid");
    return {
      frozen: raw.frozen === true,
      frozenAt: typeof raw.frozenAt === "string" ? raw.frozenAt : null,
      reason: typeof raw.reason === "string" ? raw.reason : null,
      frozenUntil: typeof raw.frozenUntil === "string" ? raw.frozenUntil : null
    };
  }

  async recordDeployRun(run: DeployRun): Promise<string> {
    await ensureDir(this.runDir);
    const body = JSON.stringify(run, null, 2);
    const filePath = path.join(this.runDir, `${fileSafeTimestamp()}-${shortHash(body)}.json`);
    await atomicWrite(filePath, body);
    return filePath;
  }
}

export function defaultDeployConfig(now = nowIso()): DeployConfig {
  return {
    platform: "custom",
    environment: "staging",
    deployCommand: "echo dstack deploy",
    dryRunCommand: "echo dstack deploy dry-run",
    canaryCommand: "echo dstack canary",
    healthCheckUrl: null,
    healthCheckIntervalSeconds: 5,
    healthCheckTimeoutSeconds: 120,
    rollbackCommand: null,
    requiredEnvVars: [],
    configVersion: "1",
    createdAt: now,
    updatedAt: now
  };
}

function parseDeployConfig(value: unknown): DeployConfig {
  if (!isRecord(value)) throw new ArtifactError("Deploy config must be an object");
  const now = nowIso();
  return {
    platform: stringValue(value.platform, "custom"),
    environment: stringValue(value.environment, "staging"),
    deployCommand: stringValue(value.deployCommand, "echo dstack deploy"),
    dryRunCommand: stringValue(value.dryRunCommand, "echo dstack deploy dry-run"),
    canaryCommand: nullableString(value.canaryCommand),
    healthCheckUrl: nullableString(value.healthCheckUrl),
    healthCheckIntervalSeconds: numberValue(value.healthCheckIntervalSeconds, 5),
    healthCheckTimeoutSeconds: numberValue(value.healthCheckTimeoutSeconds, 120),
    rollbackCommand: nullableString(value.rollbackCommand),
    requiredEnvVars: stringArray(value.requiredEnvVars),
    configVersion: stringValue(value.configVersion, "1"),
    createdAt: stringValue(value.createdAt, now),
    updatedAt: stringValue(value.updatedAt, now)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
}

export function deployRunToJson(run: DeployRun): JsonObject {
  return run as unknown as JsonObject;
}
