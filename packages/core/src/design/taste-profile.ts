import path from "node:path";
import { atomicWrite, exists, nowIso, readJsonFile } from "../utils.js";

export interface TasteProfileStoreOptions {
  dstackDir: string;
}

export interface TasteProfileEntry {
  variantName: string;
  verdict: "approved" | "rejected";
  reason: string;
  timestamp: string;
}

export interface TasteProfileWeight {
  variantName: string;
  weight: number;
}

const weeklyDecay = 0.95;

export class TasteProfileStore {
  readonly profilePath: string;

  constructor(options: TasteProfileStoreOptions) {
    this.profilePath = path.join(options.dstackDir, "design", "taste.json");
  }

  async all(): Promise<TasteProfileEntry[]> {
    if (!(await exists(this.profilePath))) return [];
    const raw = await readJsonFile<unknown>(this.profilePath);
    return Array.isArray(raw) ? raw.filter(isTasteProfileEntry) : [];
  }

  async record(input: Omit<TasteProfileEntry, "timestamp"> & Partial<Pick<TasteProfileEntry, "timestamp">>): Promise<TasteProfileEntry> {
    const entry: TasteProfileEntry = { ...input, timestamp: input.timestamp ?? nowIso() };
    await atomicWrite(this.profilePath, JSON.stringify([...(await this.all()), entry], null, 2));
    return entry;
  }

  async getWeights(referenceDate = new Date()): Promise<TasteProfileWeight[]> {
    const weights = new Map<string, number>();
    for (const entry of await this.all()) {
      const ageWeeks = Math.max(0, (referenceDate.getTime() - Date.parse(entry.timestamp)) / (7 * 24 * 60 * 60 * 1000));
      const signal = entry.verdict === "approved" ? 1 : -1;
      weights.set(entry.variantName, (weights.get(entry.variantName) ?? 0) + signal * Math.pow(weeklyDecay, ageWeeks));
    }
    return [...weights.entries()].map(([variantName, weight]) => ({ variantName, weight })).sort((a, b) => b.weight - a.weight);
  }

  async getTopPreferences(limit = 5): Promise<TasteProfileWeight[]> {
    return (await this.getWeights()).filter((entry) => entry.weight > 0).slice(0, limit);
  }
}

function isTasteProfileEntry(value: unknown): value is TasteProfileEntry {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.variantName === "string"
    && (record.verdict === "approved" || record.verdict === "rejected")
    && typeof record.reason === "string"
    && typeof record.timestamp === "string";
}
