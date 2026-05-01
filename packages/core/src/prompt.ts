import { readFile } from "node:fs/promises";
import path from "node:path";
import type { JsonObject, SkillManifest, ToolDefinition } from "@dstack/shared";
import { sanitize } from "./logger.js";
import { git } from "./utils.js";

export interface PromptContext {
  userInputs: JsonObject;
  projectMemory: JsonObject | null;
  artifacts: Record<string, JsonObject>;
  repoState: JsonObject;
  toolResults: JsonObject[];
  learnings?: JsonObject[];
  projectRouting?: JsonObject | null;
}

export class PromptTemplateEngine {
  async render(input: { manifest: SkillManifest; promptFilePath: string; context: PromptContext; tools: ToolDefinition[] }): Promise<{ systemPrompt: string; userMessage: string; tools: ToolDefinition[] }> {
    const basePrompt = await readFile(input.promptFilePath, "utf8");
    return {
      systemPrompt: [
        basePrompt.trim(),
        "Return only valid JSON matching this JSON Schema:",
        JSON.stringify(input.manifest.outputSchema, null, 2),
        "Available tools:",
        input.tools.map((tool) => `- ${tool.name}: ${tool.description}`).join("\n")
      ].join("\n\n"),
      userMessage: JSON.stringify(input.context, null, 2),
      tools: input.tools
    };
  }
}

export async function repoContext(projectRoot: string): Promise<JsonObject> {
  return {
    branch: (await git(["branch", "--show-current"], projectRoot)).stdout.trim(),
    status: (await git(["status", "--porcelain"], projectRoot)).stdout.trim(),
    recentCommits: (await git(["log", "-5", "--pretty=format:%h %s"], projectRoot)).stdout.trim()
  };
}

export async function loadDstackProjectContext(projectRoot: string, maxChars = 12_000): Promise<JsonObject | null> {
  const filePath = path.join(projectRoot, "DSTACK.md");
  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch {
    return null;
  }
  const sanitized = sanitize(content);
  const secretsRedacted = sanitized !== content;
  const truncated = sanitized.length > maxChars;
  const body = truncated
    ? `${sanitized.slice(0, maxChars)}\n\n[TRUNCATED: DSTACK.md exceeded ${maxChars} characters; ${sanitized.length - maxChars} characters were omitted.]`
    : sanitized;
  return {
    source: "DSTACK.md",
    path: filePath,
    content: body,
    truncated,
    originalLength: content.length,
    injectedLength: body.length,
    secretsRedacted,
    notice: truncated ? "DSTACK.md was truncated before prompt injection." : secretsRedacted ? "Potential secret-like content was redacted before prompt injection." : ""
  };
}
