import { readFile } from "node:fs/promises";
import type { JsonObject, SkillManifest, ToolDefinition } from "@dstack/shared";
import { git } from "./utils.js";

export interface PromptContext {
  userInputs: JsonObject;
  projectMemory: JsonObject | null;
  artifacts: Record<string, JsonObject>;
  repoState: JsonObject;
  toolResults: JsonObject[];
  learnings?: JsonObject[];
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
