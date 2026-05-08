import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { GeminiAgentClient, type GeminiCacheResult } from "./gemini-agent.js";

export interface GBrainCacheMetadata {
  cacheName: string | null;
  model: string;
  repoHash: string;
  createdAt: string;
  expiresAt: string | null;
  tokenEstimate: number;
  warning: string | null;
}

export interface GBrainSyncOptions {
  projectRoot: string;
  dstackDir: string;
  model: string;
  ttlSeconds?: number;
  maxInlineBytes?: number;
}

const EXCLUDED_DIRS = new Set([".git", "node_modules", "dist", "build", ".next", "coverage"]);
const EXCLUDED_PREFIXES = [".dstack/browser/sessions"];
const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".mdx", ".css", ".scss", ".html", ".yaml", ".yml", ".toml", ".txt", ".env.example"
]);

export class GBrainSync {
  constructor(private readonly client: GeminiAgentClient) {}

  async sync(options: GBrainSyncOptions): Promise<GBrainCacheMetadata> {
    const bundle = await buildRepositoryBundle(options.projectRoot, options.maxInlineBytes ?? 1_500_000);
    const repoHash = hashText(bundle);
    const metadataPath = path.join(options.dstackDir, "gbrain", "cache.json");
    const existing = await readMetadata(metadataPath);
    if (existing && existing.repoHash === repoHash && !isExpired(existing.expiresAt)) {
      return existing;
    }

    await fs.mkdir(path.dirname(metadataPath), { recursive: true });
    try {
      const cache = await this.client.createContextCache(bundle, options.ttlSeconds ?? 3600, options.model);
      const metadata = toMetadata(cache, repoHash, Math.ceil(bundle.length / 4), null);
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf8");
      return metadata;
    } catch (error) {
      const metadata: GBrainCacheMetadata = {
        cacheName: null,
        model: options.model,
        repoHash,
        createdAt: new Date().toISOString(),
        expiresAt: null,
        tokenEstimate: Math.ceil(bundle.length / 4),
        warning: `Context cache unavailable; using inline trimmed context. ${error instanceof Error ? error.message : String(error)}`
      };
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf8");
      return metadata;
    }
  }
}

export async function buildRepositoryBundle(projectRoot: string, maxBytes: number): Promise<string> {
  const files = await collectTextFiles(projectRoot);
  let total = 0;
  const sections: string[] = [];
  for (const filePath of files.sort()) {
    const absolute = path.join(projectRoot, filePath);
    const content = await fs.readFile(absolute, "utf8");
    const section = `\n\n--- FILE: ${filePath.replace(/\\/g, "/")} ---\n${content}`;
    const bytes = Buffer.byteLength(section, "utf8");
    if (total + bytes > maxBytes) break;
    sections.push(section);
    total += bytes;
  }
  return `DSTACK REPOSITORY BUNDLE\nGenerated: ${new Date().toISOString()}\n${sections.join("")}`;
}

async function collectTextFiles(root: string, relativeDir = ""): Promise<string[]> {
  const absoluteDir = path.join(root, relativeDir);
  const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relative = path.join(relativeDir, entry.name);
    const normalized = relative.replace(/\\/g, "/");
    if (EXCLUDED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) continue;
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      files.push(...await collectTextFiles(root, relative));
      continue;
    }
    if (!entry.isFile()) continue;
    if (entry.name === ".env") continue;
    if (TEXT_EXTENSIONS.has(path.extname(entry.name)) || entry.name === "DSTACK.md" || entry.name === "README.md") {
      files.push(relative);
    }
  }
  return files;
}

function toMetadata(cache: GeminiCacheResult, repoHash: string, tokenEstimate: number, warning: string | null): GBrainCacheMetadata {
  return {
    cacheName: cache.name,
    model: cache.model,
    repoHash,
    createdAt: new Date().toISOString(),
    expiresAt: cache.expiresAt,
    tokenEstimate,
    warning
  };
}

async function readMetadata(filePath: string): Promise<GBrainCacheMetadata | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8")) as Partial<GBrainCacheMetadata>;
    if (typeof parsed.repoHash !== "string" || typeof parsed.model !== "string") return null;
    return {
      cacheName: typeof parsed.cacheName === "string" ? parsed.cacheName : null,
      model: parsed.model,
      repoHash: parsed.repoHash,
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
      expiresAt: typeof parsed.expiresAt === "string" ? parsed.expiresAt : null,
      tokenEstimate: typeof parsed.tokenEstimate === "number" ? parsed.tokenEstimate : 0,
      warning: typeof parsed.warning === "string" ? parsed.warning : null
    };
  } catch {
    return null;
  }
}

function isExpired(expiresAt: string | null): boolean {
  return expiresAt ? Date.parse(expiresAt) <= Date.now() : true;
}

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
