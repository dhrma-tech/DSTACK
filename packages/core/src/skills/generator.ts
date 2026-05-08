import path from "node:path";
import { ArtifactError, skillManifestSchema, type SkillDefinitionDraft } from "@dstack/shared";
import { atomicWrite, exists, nowIso, shortHash } from "../utils.js";

export interface SkillGeneratorOptions {
  projectRoot: string;
  dstackDir: string;
  installedDefinitionsDir?: string;
}

export type GeneratedSkillDraft = SkillDefinitionDraft;

export interface SkillGenerationRequest {
  name: string;
  description: string;
  model?: string | null;
  tools?: string[];
}

export class SkillGenerator {
  constructor(private readonly options: SkillGeneratorOptions) {}

  async generate(request: SkillGenerationRequest): Promise<GeneratedSkillDraft> {
    const skillName = safeSkillName(request.name);
    if (!skillName) throw new ArtifactError("Skill name must be kebab-case.");
    if (await this.conflicts(skillName)) throw new ArtifactError(`Skill already exists: ${skillName}`);
    const draftDir = path.join(this.options.dstackDir, "generated-skills", skillName);
    const manifestPath = path.join(draftDir, "manifest.yaml");
    const handlerPath = path.join(draftDir, "handler.ts");
    const tools = request.tools ?? ["read_file"];
    const manifest = manifestYaml(skillName, request.description, request.model ?? "gemini-2.5-pro-preview", tools);
    const schemaValid = skillManifestSchema.safeParse(manifestObject(skillName, request.description, request.model ?? "gemini-2.5-pro-preview", tools)).success;
    await atomicWrite(manifestPath, manifest);
    await atomicWrite(handlerPath, handlerStub(skillName));
    return {
      id: shortHash(`${skillName}:${nowIso()}`, 12),
      skillName,
      generatedAt: nowIso(),
      manifestPath,
      handlerPath,
      schemaValid,
      schemaValidationErrors: [],
      generatedModel: request.model ?? "gemini-2.5-pro-preview",
      generatedTools: tools,
      status: "draft",
      installInstructions: `Review ${manifestPath} and ${handlerPath}, then move the directory to packages/core/src/skills/definitions/${skillName}.`,
      warnings: ["Review generated skill before installing. Generated skills can call tools. Verify tool list is appropriate."]
    };
  }

  private async conflicts(skillName: string): Promise<boolean> {
    const installed = this.options.installedDefinitionsDir ?? path.join(this.options.projectRoot, "packages", "core", "src", "skills", "definitions");
    return exists(path.join(installed, skillName));
  }
}

function safeSkillName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

function manifestObject(skillName: string, description: string, model: string, tools: string[]): Record<string, unknown> {
  return {
    name: skillName,
    description,
    triggerPhrases: [skillName],
    model,
    streaming: true,
    requiresArtifacts: [],
    allowedTools: tools,
    inputs: [],
    outputSchema: { type: "object", required: ["summary"], properties: { summary: { type: "string" } } },
    artifactPath: skillName,
    nextSkill: null,
    failureCases: [],
    acceptanceCriteria: ["Produces valid JSON"],
    systemPromptFile: "prompt.md"
  };
}

function manifestYaml(skillName: string, description: string, model: string, tools: string[]): string {
  return `name: ${skillName}
description: ${description}
triggerPhrases: ["${skillName}"]
model: ${model}
streaming: true
requiresArtifacts: []
allowedTools: [${tools.map((tool) => `"${tool}"`).join(", ")}]
inputs: []
outputSchema:
  type: object
  required: ["summary"]
  properties:
    summary: { type: string }
artifactPath: ${skillName}
nextSkill: null
failureCases: []
acceptanceCriteria: ["Produces valid JSON"]
systemPromptFile: prompt.md
`;
}

function handlerStub(skillName: string): string {
  return `import type { SkillHandler } from "../../../skills.js";

const handler: SkillHandler = {
  async buildContext() {
    return {};
  },
  async postProcess(rawOutput) {
    return JSON.parse(rawOutput) as { summary: string };
  }
};

export default handler;
// Review before installing ${skillName}. Generated skills can call tools.
`;
}
