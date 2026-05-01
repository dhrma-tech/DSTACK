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
  storageStatePath: string;
  metadataPath: string;
  targetUrl: string | null;
  authenticationVerified: boolean;
  authIndicatorsFound: string[];
  lastValidatedAt: string | null;
  expiresAt: string | null;
}

export class BrowserSessionManager {
  readonly sessionsRoot: string;
  private static readonly navigationFailures = new Map<string, number>();

  constructor(private readonly options: BrowserSessionManagerOptions) {
    this.sessionsRoot = path.join(options.dstackDir, "browser", "sessions");
  }

  sessionDir(name: string): string {
    return path.join(this.sessionsRoot, safeSessionName(name));
  }

  cookiePath(name: string): string {
    return path.join(this.sessionDir(name), "cookies.json");
  }

  storageStatePath(name: string): string {
    return path.join(this.sessionDir(name), "storage-state.json");
  }

  metadataPath(name: string): string {
    return path.join(this.sessionDir(name), "metadata.json");
  }

  async saveCookies(name: string, cookies: JsonObject[], metadata: Partial<Omit<BrowserSessionMetadata, "name" | "sessionDir" | "cookieCount" | "storageStatePath" | "metadataPath">> = {}): Promise<BrowserSessionMetadata> {
    const sessionDir = this.sessionDir(name);
    await ensureDir(sessionDir);
    await atomicWrite(this.cookiePath(name), JSON.stringify(cookies, null, 2));
    const stored = await this.writeMetadata(name, {
      targetUrl: metadata.targetUrl ?? null,
      authenticationVerified: metadata.authenticationVerified ?? cookies.length > 0,
      authIndicatorsFound: metadata.authIndicatorsFound ?? [],
      lastValidatedAt: metadata.lastValidatedAt ?? new Date().toISOString(),
      expiresAt: metadata.expiresAt ?? expiresAtFromCookies(cookies)
    });
    return stored;
  }

  async loadCookies(name: string): Promise<JsonObject[]> {
    const filePath = this.cookiePath(name);
    if (!(await exists(filePath))) return [];
    const raw = await readJsonFile<unknown>(filePath);
    return Array.isArray(raw) ? raw.filter(isJsonObject).map(normalizeCookie).filter((cookie): cookie is JsonObject => cookie !== null) : [];
  }

  async metadata(name: string): Promise<BrowserSessionMetadata> {
    const metadataPath = this.metadataPath(name);
    if (await exists(metadataPath)) {
      const raw = await readJsonFile<unknown>(metadataPath);
      if (isJsonObject(raw)) return normalizeMetadata(name, this.sessionDir(name), this.storageStatePath(name), metadataPath, (await this.loadCookies(name)).length, raw);
    }
    return normalizeMetadata(name, this.sessionDir(name), this.storageStatePath(name), metadataPath, (await this.loadCookies(name)).length, {});
  }

  async saveStorageState(name: string, state: JsonObject): Promise<string> {
    const filePath = this.storageStatePath(name);
    await atomicWrite(filePath, JSON.stringify(state, null, 2));
    return filePath;
  }

  async loadStorageState(name: string): Promise<JsonObject | null> {
    const filePath = this.storageStatePath(name);
    if (!(await exists(filePath))) return null;
    const raw = await readJsonFile<unknown>(filePath);
    return isJsonObject(raw) ? raw : null;
  }

  async updateValidation(name: string, targetUrl: string, authIndicatorsFound: string[]): Promise<BrowserSessionMetadata> {
    const existing = await this.metadata(name);
    return this.writeMetadata(name, {
      targetUrl,
      authenticationVerified: authIndicatorsFound.length > 0 || existing.cookieCount > 0,
      authIndicatorsFound,
      lastValidatedAt: new Date().toISOString(),
      expiresAt: existing.expiresAt
    });
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
    const failures = (BrowserSessionManager.navigationFailures.get(origin) ?? 0) + 1;
    BrowserSessionManager.navigationFailures.set(origin, failures);
    return failures >= 3;
  }

  recordNavigationSuccess(url: string): void {
    BrowserSessionManager.navigationFailures.delete(originOf(url));
  }

  cookieSetupLaunchOptions(): { headless: false; userDataDir: string } {
    return { headless: false, userDataDir: this.sessionDir("cookie-setup") };
  }

  private async writeMetadata(name: string, metadata: Pick<BrowserSessionMetadata, "targetUrl" | "authenticationVerified" | "authIndicatorsFound" | "lastValidatedAt" | "expiresAt">): Promise<BrowserSessionMetadata> {
    const normalized = normalizeMetadata(name, this.sessionDir(name), this.storageStatePath(name), this.metadataPath(name), (await this.loadCookies(name)).length, metadata as unknown as JsonObject);
    await atomicWrite(this.metadataPath(name), JSON.stringify(redactedMetadata(normalized), null, 2));
    return normalized;
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

function normalizeMetadata(name: string, sessionDir: string, storageStatePath: string, metadataPath: string, cookieCount: number, raw: JsonObject): BrowserSessionMetadata {
  return {
    name: safeSessionName(name),
    sessionDir,
    cookieCount,
    storageStatePath,
    metadataPath,
    targetUrl: typeof raw.targetUrl === "string" ? raw.targetUrl : null,
    authenticationVerified: raw.authenticationVerified === true,
    authIndicatorsFound: Array.isArray(raw.authIndicatorsFound) && raw.authIndicatorsFound.every((item) => typeof item === "string") ? raw.authIndicatorsFound : [],
    lastValidatedAt: typeof raw.lastValidatedAt === "string" ? raw.lastValidatedAt : null,
    expiresAt: typeof raw.expiresAt === "string" ? raw.expiresAt : null
  };
}

function redactedMetadata(metadata: BrowserSessionMetadata): JsonObject {
  return {
    name: metadata.name,
    sessionDir: metadata.sessionDir,
    cookieCount: metadata.cookieCount,
    storageStatePath: metadata.storageStatePath,
    metadataPath: metadata.metadataPath,
    targetUrl: metadata.targetUrl,
    authenticationVerified: metadata.authenticationVerified,
    authIndicatorsFound: metadata.authIndicatorsFound,
    lastValidatedAt: metadata.lastValidatedAt,
    expiresAt: metadata.expiresAt
  };
}

function expiresAtFromCookies(cookies: JsonObject[]): string | null {
  const expiries = cookies.map((cookie) => typeof cookie.expires === "number" ? cookie.expires : null).filter((value): value is number => typeof value === "number" && value > 0);
  if (expiries.length === 0) return null;
  return new Date(Math.min(...expiries) * 1000).toISOString();
}

function normalizeCookie(cookie: JsonObject): JsonObject | null {
  if (typeof cookie.name !== "string" || typeof cookie.value !== "string") return null;
  if (typeof cookie.url !== "string" && typeof cookie.domain !== "string") return null;
  const normalized: JsonObject = {
    name: cookie.name,
    value: cookie.value
  };
  if (typeof cookie.url === "string") normalized.url = cookie.url;
  if (typeof cookie.domain === "string") normalized.domain = cookie.domain;
  normalized.path = typeof cookie.path === "string" ? cookie.path : "/";
  if (typeof cookie.expires === "number" && cookie.expires > 0) normalized.expires = cookie.expires;
  if (typeof cookie.httpOnly === "boolean") normalized.httpOnly = cookie.httpOnly;
  if (typeof cookie.secure === "boolean") normalized.secure = cookie.secure;
  if (cookie.sameSite === "Strict" || cookie.sameSite === "Lax" || cookie.sameSite === "None") normalized.sameSite = cookie.sameSite;
  return normalized;
}
