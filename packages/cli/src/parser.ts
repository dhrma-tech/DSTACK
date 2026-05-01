import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import type { JsonValue, ProviderName, SkillInvocation } from "@dstack/shared";

export interface ParsedCommand {
  help: boolean;
  version: boolean;
  listSkills: boolean;
  skillCheck: boolean;
  serve: boolean;
  json: boolean;
  verbose: boolean;
  invocation: SkillInvocation | null;
  serveOptions?: {
    host?: string;
    port?: number;
    tokenFile?: string;
    allowAbsolutePaths?: boolean;
  };
}

export async function parseArgv(argv = hideBin(process.argv), projectRoot = process.cwd()): Promise<ParsedCommand> {
  const parsed = await yargs(argv)
    .scriptName("ds")
    .help(false)
    .version(false)
    .option("help", { type: "boolean" })
    .option("version", { type: "boolean" })
    .option("list-skills", { type: "boolean" })
    .option("skill-check", { type: "boolean" })
    .option("serve", { type: "boolean" })
    .option("host", { type: "string" })
    .option("port", { type: "number" })
    .option("token-file", { type: "string" })
    .option("allow-absolute-paths", { type: "boolean" })
    .option("force", { type: "boolean", default: false })
    .option("dry-run", { type: "boolean", default: false })
    .option("no-stream", { type: "boolean", default: false })
    .option("model", { type: "string" })
    .option("provider", { type: "string", choices: ["gemini", "fake"] })
    .option("json", { type: "boolean", default: false })
    .option("verbose", { type: "boolean", default: false })
    .option("allow-secrets", { type: "boolean", default: false })
    .parse();
  const skillName = parsed._.map(String)[0] ?? null;
  const reserved = new Set(["_", "$0", "help", "version", "list-skills", "skill-check", "serve", "host", "port", "token-file", "allow-absolute-paths", "force", "dry-run", "no-stream", "model", "provider", "json", "verbose", "allow-secrets"]);
  const inputs: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!reserved.has(key) && isJsonValue(value)) inputs[key] = value;
  }
  return {
    help: parsed.help === true || (!skillName && parsed["list-skills"] !== true && parsed["skill-check"] !== true && parsed.serve !== true && parsed.version !== true),
    version: parsed.version === true,
    listSkills: parsed["list-skills"] === true,
    skillCheck: parsed["skill-check"] === true,
    serve: parsed.serve === true,
    json: parsed.json === true,
    verbose: parsed.verbose === true,
    invocation: skillName
      ? {
          skillName,
          inputs,
          flags: {
            force: parsed.force === true,
            dryRun: parsed["dry-run"] === true,
            noStream: parsed["no-stream"] === true,
            model: typeof parsed.model === "string" ? parsed.model : null,
            provider: isProviderName(parsed.provider) ? parsed.provider : null,
            allowSecrets: parsed["allow-secrets"] === true
          },
          projectRoot
        }
      : null,
    ...(parsed.serve ? {
      serveOptions: (() => {
        const options: {
          host?: string;
          port?: number;
          tokenFile?: string;
          allowAbsolutePaths?: boolean;
        } = {};
        
        if (parsed.host !== undefined) options.host = parsed.host;
        if (parsed.port !== undefined) options.port = parsed.port;
        if (parsed["token-file"] !== undefined) options.tokenFile = parsed["token-file"];
        if (parsed["allow-absolute-paths"] !== undefined) options.allowAbsolutePaths = parsed["allow-absolute-paths"];
        
        return options;
      })()
    } : {})
  };
}

function isProviderName(value: unknown): value is ProviderName {
  return value === "gemini" || value === "fake";
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  return false;
}
