import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import type { JsonValue, SkillInvocation } from "@dstack/shared";

export interface ParsedCommand {
  help: boolean;
  version: boolean;
  listSkills: boolean;
  invocation: SkillInvocation | null;
}

export async function parseArgv(argv = hideBin(process.argv), projectRoot = process.cwd()): Promise<ParsedCommand> {
  const parsed = await yargs(argv)
    .scriptName("ds")
    .help(false)
    .version(false)
    .option("help", { type: "boolean" })
    .option("version", { type: "boolean" })
    .option("list-skills", { type: "boolean" })
    .option("force", { type: "boolean", default: false })
    .option("dry-run", { type: "boolean", default: false })
    .option("no-stream", { type: "boolean", default: false })
    .option("model", { type: "string" })
    .option("allow-secrets", { type: "boolean", default: false })
    .parse();
  const skillName = parsed._.map(String)[0] ?? null;
  const reserved = new Set(["_", "$0", "help", "version", "list-skills", "force", "dry-run", "no-stream", "model", "allow-secrets"]);
  const inputs: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!reserved.has(key) && isJsonValue(value)) inputs[key] = value;
  }
  return {
    help: parsed.help === true || (!skillName && parsed["list-skills"] !== true && parsed.version !== true),
    version: parsed.version === true,
    listSkills: parsed["list-skills"] === true,
    invocation: skillName
      ? {
          skillName,
          inputs,
          flags: { force: parsed.force === true, dryRun: parsed["dry-run"] === true, noStream: parsed["no-stream"] === true, model: typeof parsed.model === "string" ? parsed.model : null, allowSecrets: parsed["allow-secrets"] === true },
          projectRoot
        }
      : null
  };
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  return false;
}
