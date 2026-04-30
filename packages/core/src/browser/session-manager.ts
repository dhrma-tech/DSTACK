import path from "node:path";
import { readdir, rm } from "node:fs/promises";
import type { JsonObject } from "@dstack/shared";
import { atomicWrite, ensureDir, exists, readJsonFile } from "../utils.js";

export interface BrowserSessionManagerOptions {
  projectRoot: string;
  dstackDir: string;
}

export interface BrowserSessionMetadata {
  name: string;
  sessionDir: string;
  cookieCount: number;
}

export class BrowserSessionManager {
  readonly sessionsRoot: string;
  private readonly navigationFailures = new Map<string, number>();

  constructor(private readonly options: BrowserSessionManagerOptions) {
    this.sessionsRoot = path.join(options.dstackDir, "browser", "sessions");
  }

  sessionDir(name: string): string {
    return path.join(this.sessionsRoot, safeSessionName(name));
  }

  cookiePath(name: string): string {
    return path.join(this.sessionDir(name), "cookies.json");
  }

  async saveCookies(name: string, cookies: JsonObject[]): Promise<BrowserSessionMetadata> {
    const sessionDir = this.sessionDir(name);
    await ensureDir(sessionDir);
    await atomicWrite(this.cookiePath(name), JSON.stringify(cookies, null, 2));
    return { name: safeSessionName(name), sessionDir, cookieCount: cookies.length };
  }

  async loadCookies(name: string): Promise<JsonObject[]> {
    const filePath = this.cookiePath(name);
    if (!(await exists(filePath))) return [];
    const raw = await readJsonFile<unknown>(filePath);
    return Array.isArray(raw) ? raw.filter(isJsonObject) : [];
  }

  async metadata(name: string): Promise<BrowserSessionMetadata> {
    return { name: safeSessionName(name), sessionDir: this.sessionDir(name), cookieCount: (await this.loadCookies(name)).length };
  }

  async list(): Promise<BrowserSessionMetadata[]> {
    if (!(await exists(this.sessionsRoot))) return [];
    const entries = await readdir(this.sessionsRoot, { withFileTypes: true });
    return Promise.all(entries.filter((entry) => entry.isDirectory()).map((entry) => this.metadata(entry.name)));
  }

  async delete(name: string): Promise<boolean> {
    const dir = this.sessionDir(name);
    if (!(await exists(dir))) return false;
    await rm(dir, { recursive: true, force: true });
    return true;
  }

  recordNavigationFailure(url: string): boolean {
    const origin = originOf(url);
    const failures = (this.navigationFailures.get(origin) ?? 0) + 1;
    this.navigationFailures.set(origin, failures);
    return failures >= 3;
  }

  cookieSetupLaunchOptions(): { headless: false; userDataDir: string } {
    return { headless: false, userDataDir: this.sessionDir("cookie-setup") };
  }
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "unknown";
  }
}

function safeSessionName(name: string): string {
  const safe = name.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return safe || "default";
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
