import path from "node:path";
import type { LearningEntry } from "@dstack/shared";
import { atomicWrite, exists, nowIso, readJsonFile, shortHash } from "../utils.js";

export interface LearningStoreOptions {
  dstackDir: string;
  projectId?: string;
}

export type LearningStoreEntry = LearningEntry;

export class LearningStore {
  readonly learningPath: string;
  private readonly projectId: string;

  constructor(private readonly options: LearningStoreOptions) {
    this.learningPath = path.join(options.dstackDir, "memory", "learnings.json");
    this.projectId = options.projectId ?? path.basename(path.dirname(options.dstackDir));
  }

  async all(): Promise<LearningEntry[]> {
    if (!(await exists(this.learningPath))) return [];
    const raw = await readJsonFile<unknown>(this.learningPath);
    if (!Array.isArray(raw)) return [];
    return raw.filter(isLearningEntry);
  }

  async add(entry: Omit<LearningEntry, "id" | "createdAt" | "projectId" | "usedInSkillRuns"> & Partial<Pick<LearningEntry, "id" | "createdAt" | "projectId" | "usedInSkillRuns">>): Promise<LearningEntry> {
    const createdAt = entry.createdAt ?? nowIso();
    const stored: LearningEntry = {
      id: entry.id ?? shortHash(`${entry.topic}:${entry.insight}:${createdAt}`, 12),
      topic: entry.topic,
      insight: entry.insight,
      originalText: entry.originalText,
      wasRephrased: entry.wasRephrased,
      appliesTo: entry.appliesTo,
      source: entry.source,
      createdAt,
      projectId: entry.projectId ?? this.projectId,
      usedInSkillRuns: entry.usedInSkillRuns ?? []
    };
    const entries = await this.all();
    entries.push(stored);
    await this.writeAll(entries);
    return stored;
  }

  async search(query: string): Promise<LearningEntry[]> {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return (await this.all()).filter((entry) => [entry.topic, entry.insight, ...entry.appliesTo].some((value) => value.toLowerCase().includes(needle)));
  }

  async list(tag?: string): Promise<LearningEntry[]> {
    const entries = await this.all();
    if (!tag) return entries;
    return entries.filter((entry) => entry.appliesTo.includes(tag) || entry.topic === tag);
  }

  async prune(olderThan: Date): Promise<number> {
    if (!(olderThan instanceof Date) || Number.isNaN(olderThan.getTime())) throw new TypeError("olderThan must be a valid Date");
    const entries = await this.all();
    const retained = entries.filter((entry) => Date.parse(entry.createdAt) >= olderThan.getTime());
    await this.writeAll(retained);
    return entries.length - retained.length;
  }

  async pruneOlderThanDays(days: number): Promise<number> {
    if (typeof days !== "number" || !Number.isFinite(days)) throw new TypeError("olderThanDays must be a number");
    const cutoff = new Date(Date.now() - Math.max(0, Math.floor(days)) * 24 * 60 * 60 * 1000);
    return this.prune(cutoff);
  }

  async exportMarkdown(): Promise<string> {
    const rows = (await this.all()).map((entry) => `| ${escapeCell(entry.topic)} | ${escapeCell(entry.insight)} | ${escapeCell(entry.appliesTo.join(", "))} | ${escapeCell(entry.source)} | ${escapeCell(entry.createdAt)} |`);
    return ["# DStack Learnings", "", "| Topic | Insight | Applies To | Source | Created At |", "| --- | --- | --- | --- | --- |", ...rows, ""].join("\n");
  }

  private async writeAll(entries: LearningEntry[]): Promise<void> {
    await atomicWrite(this.learningPath, JSON.stringify(entries, null, 2));
  }
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function isLearningEntry(value: unknown): value is LearningEntry {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string"
    && typeof record.topic === "string"
    && typeof record.insight === "string"
    && typeof record.originalText === "string"
    && typeof record.wasRephrased === "boolean"
    && Array.isArray(record.appliesTo)
    && record.appliesTo.every((item) => typeof item === "string")
    && (record.source === "manual" || record.source === "retro" || record.source === "setup-memory")
    && typeof record.createdAt === "string"
    && typeof record.projectId === "string"
    && Array.isArray(record.usedInSkillRuns)
    && record.usedInSkillRuns.every((item) => typeof item === "string");
}
