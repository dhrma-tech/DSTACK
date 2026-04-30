import { readFile } from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import { ConfigError, dstackConfigSchema, type DStackConfig } from "@dstack/shared";
import { exists } from "./utils.js";

export function defaultConfig(projectRoot: string): DStackConfig {
  return {
    projectRoot,
    dstackDir: path.join(projectRoot, ".dstack"),
    geminiApiKey: null,
    provider: "gemini",
    defaultModel: "gemini-2.0-flash-001",
    proModel: "gemini-2.5-pro-preview",
    maxTokens: 8192,
    requestTimeoutMs: 120000,
    maxRetries: 3,
    retryBaseDelayMs: 1000,
    maxToolCalls: 40,
    logLevel: "info",
    allowSecrets: false,
    browserHeadless: false,
    defaultBrowserUrl: "http://localhost:3000",
    requireApprovalForFileOverwrite: true,
    requireApprovalForGitCommit: true,
    requireApprovalForShellCommands: true,
    skillOverrides: {}
  };
}

type ConfigFile = Partial<Omit<DStackConfig, "projectRoot" | "dstackDir">>;

export class ConfigManager {
  static async load(options: { projectRoot: string; cliModel?: string | null; cliProvider?: DStackConfig["provider"] | null; allowSecrets?: boolean }): Promise<DStackConfig> {
    const projectRoot = path.resolve(options.projectRoot);
    const base = defaultConfig(projectRoot);
    const configPath = path.join(base.dstackDir, "config.yaml");
    const fileConfig = await readConfigFile(configPath);
    const merged: DStackConfig = {
      ...base,
      ...fileConfig,
      geminiApiKey: process.env.GEMINI_API_KEY ?? fileConfig.geminiApiKey ?? null,
      provider: options.cliProvider ?? readProviderEnv() ?? fileConfig.provider ?? base.provider,
      defaultModel: options.cliModel ?? process.env.DSTACK_DEFAULT_MODEL ?? fileConfig.defaultModel ?? base.defaultModel,
      proModel: process.env.DSTACK_PRO_MODEL ?? fileConfig.proModel ?? base.proModel,
      maxTokens: readInt("DSTACK_MAX_TOKENS") ?? fileConfig.maxTokens ?? base.maxTokens,
      requestTimeoutMs: readInt("DSTACK_REQUEST_TIMEOUT_MS") ?? fileConfig.requestTimeoutMs ?? base.requestTimeoutMs,
      maxRetries: readInt("DSTACK_MAX_RETRIES") ?? fileConfig.maxRetries ?? base.maxRetries,
      retryBaseDelayMs: readInt("DSTACK_RETRY_BASE_DELAY_MS") ?? fileConfig.retryBaseDelayMs ?? base.retryBaseDelayMs,
      allowSecrets: options.allowSecrets ?? fileConfig.allowSecrets ?? base.allowSecrets
    };
    const parsed = dstackConfigSchema.safeParse(merged);
    if (!parsed.success) throw new ConfigError("Invalid DStack configuration", { issues: parsed.error.issues });
    return Object.freeze(parsed.data) as DStackConfig;
  }
}

function readProviderEnv(): DStackConfig["provider"] | undefined {
  const value = process.env.DSTACK_PROVIDER;
  if (!value) return undefined;
  if (value === "gemini" || value === "fake") return value;
  throw new ConfigError("DSTACK_PROVIDER must be either 'gemini' or 'fake'");
}

async function readConfigFile(configPath: string): Promise<ConfigFile> {
  if (!(await exists(configPath))) return {};
  const parsed = yaml.load(await readFile(configPath, "utf8"));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new ConfigError("Config YAML must be an object");
  return parsed as ConfigFile;
}

function readInt(name: string): number | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) throw new ConfigError(`${name} must be an integer`);
  return parsed;
}
