import path from "node:path";
import { ArtifactError, type SafetyMode, type SafetyModeName } from "@dstack/shared";
import { atomicWrite, exists, readJsonFile } from "../utils.js";

export interface SafetyModeManagerOptions {
  dstackDir: string;
}

export type SafetyModeState = SafetyMode;

export class SafetyModeManager {
  readonly modePath: string;
  constructor(options: SafetyModeManagerOptions) {
    this.modePath = path.join(options.dstackDir, "safety-mode.json");
  }
  async read(): Promise<SafetyMode> {
    if (!(await exists(this.modePath))) return normalMode();
    const parsed = parseSafetyMode(await readJsonFile<unknown>(this.modePath));
    return parsed;
  }
  async setMode(mode: SafetyModeName, activatedBySkill: "careful" | "guard" | null = null, reason: string | null = null): Promise<SafetyMode> {
    const state = mode === "NORMAL" ? normalMode() : {
      mode,
      activatedAt: new Date().toISOString(),
      activatedBySkill,
      reason,
      blockedOperations: mode === "GUARD" ? ["write", "execute", "destructive"] : [],
      gatedOperations: mode === "CAREFUL" ? ["read", "write", "execute", "destructive"] : []
    } satisfies SafetyMode;
    await atomicWrite(this.modePath, JSON.stringify(state, null, 2));
    return state;
  }
  async reset(): Promise<SafetyMode> {
    return this.setMode("NORMAL");
  }
}

export function normalMode(): SafetyMode {
  return { mode: "NORMAL", activatedAt: null, activatedBySkill: null, reason: null, blockedOperations: [], gatedOperations: [] };
}

function parseSafetyMode(value: unknown): SafetyMode {
  if (!isRecord(value)) throw new ArtifactError("Safety mode file is invalid");
  const mode = value.mode;
  if (mode !== "NORMAL" && mode !== "CAREFUL" && mode !== "GUARD") throw new ArtifactError("Safety mode file has an unknown mode");
  return {
    mode,
    activatedAt: typeof value.activatedAt === "string" ? value.activatedAt : null,
    activatedBySkill: value.activatedBySkill === "careful" || value.activatedBySkill === "guard" ? value.activatedBySkill : null,
    reason: typeof value.reason === "string" ? value.reason : null,
    blockedOperations: stringArray(value.blockedOperations),
    gatedOperations: stringArray(value.gatedOperations)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
}
