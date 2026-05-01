import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import yaml from "js-yaml";
import { ArtifactError, SkillError, ValidationError, skillManifestSchema, type DStackConfig, type JsonObject, type JsonValue, type Provider, type SkillInvocation, type SkillManifest, type SkillRunResult, type Verdict } from "@dstack/shared";
import { Logger } from "./logger.js";
import { ArtifactStore, CheckpointStore, MemoryStore } from "./memory.js";
import { LearningStore } from "./memory/learning-store.js";
import { FakeProvider, ModelRouter, StreamHandler } from "./model.js";
import { loadDstackProjectContext, PromptTemplateEngine, repoContext } from "./prompt.js";
import { StalenessDetector } from "./review/staleness.js";
import { ToolExecutor, ToolRegistry } from "./tools.js";

export interface SkillExecutionContext {
  manifest: SkillManifest;
  invocation: SkillInvocation;
  config: DStackConfig;
  artifactStore: ArtifactStore;
  memoryStore: MemoryStore;
  checkpointStore: CheckpointStore;
  toolExecutor: ToolExecutor;
  prerequisiteArtifacts: Record<string, JsonObject>;
  generatedBy: string | null;
}

export interface SkillHandler {
  buildContext(context: SkillExecutionContext): Promise<JsonObject>;
  postProcess(rawOutput: string, context: SkillExecutionContext): Promise<JsonObject>;
  run?(context: SkillExecutionContext): Promise<SkillRunResult>;
}

export class SkillRegistry {
  private readonly manifests = new Map<string, SkillManifest>();
  private loaded = false;
  constructor(private readonly definitionsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "skills", "definitions")) {}
  async load(): Promise<void> {
    if (this.loaded) return;
    for (const entry of await readdir(this.definitionsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const raw = yaml.load(await readFile(path.join(this.definitionsDir, entry.name, "manifest.yaml"), "utf8"));
      const parsed = skillManifestSchema.safeParse(raw);
      if (!parsed.success) throw new SkillError(`Invalid skill manifest: ${entry.name}`, { issues: parsed.error.issues });
      this.manifests.set(parsed.data.name, parsed.data);
    }
    this.loaded = true;
  }
  async resolve(name: string): Promise<SkillManifest> {
    await this.load();
    const normalized = name.replace(/^\//, "");
    const manifest = this.manifests.get(normalized);
    if (!manifest) throw new SkillError(`Unknown skill: ${name}`);
    return manifest;
  }
  async list(): Promise<SkillManifest[]> {
    await this.load();
    return [...this.manifests.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  definitionDirFor(skillName: string): string {
    return path.join(this.definitionsDir, skillName);
  }
}

export class SkillExecutor {
  private readonly registry = new SkillRegistry();
  private readonly artifacts: ArtifactStore;
  private readonly memory: MemoryStore;
  private readonly checkpoints: CheckpointStore;
  private readonly logger: Logger;
  private readonly tools = new ToolRegistry();
  private readonly generatedBy: string | null;
  constructor(private readonly options: { config: DStackConfig; providerOverride?: Provider | null; interactive?: boolean }) {
    this.artifacts = new ArtifactStore(options.config.dstackDir);
    this.memory = new MemoryStore(options.config.dstackDir);
    this.checkpoints = new CheckpointStore(options.config.dstackDir, options.config.projectRoot);
    this.logger = new Logger(options.config.dstackDir, options.config.logLevel);
    this.generatedBy = options.config.provider === "fake" || options.providerOverride instanceof FakeProvider ? "fake-provider" : null;
  }
  async listSkills(): Promise<SkillManifest[]> {
    return this.registry.list();
  }
  async run(invocation: SkillInvocation): Promise<SkillRunResult> {
    const manifest = await this.registry.resolve(invocation.skillName);
    validateInputs(manifest, invocation.inputs);
    const session = await this.logger.createSession(manifest.name);
    try {
      const prerequisiteArtifacts: Record<string, JsonObject> = {};
      for (const required of manifest.requiresArtifacts) {
        const artifact = await this.artifacts.readLatest(required);
        if (!artifact && !invocation.flags.force) throw new ArtifactError(`/${manifest.name} requires /${required}. Run /${required} first or pass --force.`);
        if (artifact) prerequisiteArtifacts[required] = artifact.content;
      }
      await enforceWorkflowGates(manifest, prerequisiteArtifacts, invocation.flags.force, this.options.config.dstackDir);
      const toolExecutor = new ToolExecutor(this.tools, { projectRoot: invocation.projectRoot, config: this.options.config, logger: session, interactive: this.options.interactive ?? true });
      const context: SkillExecutionContext = { manifest, invocation, config: this.options.config, artifactStore: this.artifacts, memoryStore: this.memory, checkpointStore: this.checkpoints, toolExecutor, prerequisiteArtifacts, generatedBy: this.generatedBy };
      const handler = await this.loadHandler(manifest);
      if (handler.run) {
        const direct = await handler.run(context);
        if (direct.output) validateOutputSchema(manifest, direct.output);
        await session.complete("complete");
        return direct;
      }
      const router = new ModelRouter(this.options.config, this.options.providerOverride ?? null);
      const { provider, model } = router.resolve(manifest, invocation.flags.model);
      const toolResults: JsonObject[] = [];
      let rawOutput = "";
      for (let i = 0; i < 8; i += 1) {
        const builtContext = await handler.buildContext(context);
        const rendered = await new PromptTemplateEngine().render({
          manifest,
          promptFilePath: path.join(this.registry.definitionDirFor(manifest.name), manifest.systemPromptFile),
          context: { userInputs: { ...invocation.inputs, ...builtContext }, projectMemory: await this.memory.read() as unknown as JsonObject | null, artifacts: prerequisiteArtifacts, repoState: await repoContext(invocation.projectRoot), toolResults, learnings: await relevantLearnings(this.options.config.dstackDir, manifest.name), projectRouting: await loadDstackProjectContext(invocation.projectRoot) },
          tools: this.tools.definitions(manifest.allowedTools)
        });
        const response = await new StreamHandler().collect(provider.generate({ model, systemPrompt: rendered.systemPrompt, userMessage: rendered.userMessage, tools: rendered.tools, responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: this.options.config.maxTokens }));
        if (response.toolCalls.length === 0) {
          rawOutput = response.text;
          break;
        }
        for (const toolCall of response.toolCalls) toolResults.push((await toolExecutor.dispatch(toolCall)).output);
      }
      if (!rawOutput) throw new SkillError(`/${manifest.name} did not produce final output`);
      const output = markGenerated(context, await handler.postProcess(rawOutput, context));
      if (Object.keys(output).length === 0) throw new ValidationError(`/${manifest.name} produced empty output`);
      validateOutputSchema(manifest, output);
      if (manifest.name === "office-hours") await this.memory.seedFromOfficeHours(output);
      const artifact = invocation.flags.dryRun ? null : await this.artifacts.write(manifest.name, output);
      const verdict = extractVerdict(output);
      const result: SkillRunResult = { skillName: manifest.name, status: "complete", verdict, artifactPath: artifact?.filePath ?? null, output, nextSkill: verdict === "FAIL" && manifest.name === "qa" ? "investigate" : manifest.nextSkill, warnings: invocation.flags.force ? ["Stage gates bypassed with --force."] : [] };
      await session.complete("complete");
      return result;
    } catch (error) {
      await session.complete("error", { message: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }
  private async loadHandler(manifest: SkillManifest): Promise<SkillHandler> {
    const dir = this.registry.definitionDirFor(manifest.name);
    const sourcePath = path.join(dir, "handler.ts");
    const builtPath = path.join(dir, "handler.js");
    const loaded = await import(pathToFileURL(sourcePath).href).catch(async () => import(pathToFileURL(builtPath).href)) as { default?: unknown };
    if (!isHandler(loaded.default)) throw new SkillError(`Invalid handler for /${manifest.name}`);
    return loaded.default;
  }
}

export function createModelSkillHandler(defaultOutput: JsonObject): SkillHandler {
  return {
    async buildContext() { return {}; },
    async postProcess(rawOutput) {
      const trimmed = rawOutput.trim();
      if (!trimmed) return defaultOutput;
      const parsed = JSON.parse(trimmed) as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new ValidationError("Skill output must be a JSON object");
      return parsed as JsonObject;
    }
  };
}

export const contextSaveHandler: SkillHandler = {
  async buildContext() { return {}; },
  async postProcess(raw) { return JSON.parse(raw) as JsonObject; },
  async run(context) {
    const checkpoint = await context.checkpointStore.save(typeof context.invocation.inputs.name === "string" ? context.invocation.inputs.name : undefined);
    const output = markGenerated(context, checkpoint as unknown as JsonObject);
    const artifact = context.invocation.flags.dryRun ? null : await context.artifactStore.write(context.manifest.name, output);
    return { skillName: context.manifest.name, status: "complete", verdict: "PASS", artifactPath: artifact?.filePath ?? null, output, nextSkill: context.manifest.nextSkill, warnings: [] };
  }
};

export const contextRestoreHandler: SkillHandler = {
  async buildContext() { return {}; },
  async postProcess(raw) { return JSON.parse(raw) as JsonObject; },
  async run(context) {
    const name = typeof context.invocation.inputs.name === "string" ? context.invocation.inputs.name : null;
    if (!name) throw new ValidationError("context-restore requires --name");
    const checkpoint = await context.checkpointStore.restore(name);
    const output = markGenerated(context, { checkpointName: checkpoint.name, restoredAt: new Date().toISOString(), artifactsRestored: Object.keys(checkpoint.artifactPointers), gitHeadAtSave: checkpoint.gitHead, note: "Artifact pointers restored. Git state was not modified." });
    const artifact = context.invocation.flags.dryRun ? null : await context.artifactStore.write(context.manifest.name, output);
    return { skillName: context.manifest.name, status: "complete", verdict: "PASS", artifactPath: artifact?.filePath ?? null, output, nextSkill: context.manifest.nextSkill, warnings: [] };
  }
};

function validateInputs(manifest: SkillManifest, inputs: Record<string, unknown>): void {
  const missing = manifest.inputs.filter((input) => input.required && inputs[input.name] === undefined).map((input) => input.name);
  if (missing.length > 0) throw new ValidationError(`Missing required inputs for /${manifest.name}: ${missing.join(", ")}`);
}

async function relevantLearnings(dstackDir: string, skillName: string): Promise<JsonObject[]> {
  return (await new LearningStore({ dstackDir }).list(skillName)).map((entry) => entry as unknown as JsonObject);
}

export function validateOutputSchema(manifest: SkillManifest, output: JsonObject): void {
  const issues = validateJsonSchema(manifest.outputSchema, output, "$");
  if (issues.length > 0) {
    throw new ValidationError(`/${manifest.name} output failed schema validation`, { issues });
  }
}
export function validateJsonSchema(schema: JsonObject, value: JsonValue, pathName: string): string[] {
  const issues: string[] = [];
  const expectedType = typeof schema.type === "string" ? schema.type : null;
  if (expectedType && !matchesType(expectedType, value)) {
    return [`${pathName} expected ${expectedType}`];
  }
  if (expectedType === "object" || (expectedType === null && isObject(value))) {
    if (!isObject(value)) return [`${pathName} expected object`];
    const required = Array.isArray(schema.required) ? schema.required.filter((item): item is string => typeof item === "string") : [];
    for (const field of required) {
      if (value[field] === undefined) issues.push(`${pathName}.${field} is required`);
    }
    const properties = isObject(schema.properties) ? schema.properties : {};
    for (const [field, propertySchema] of Object.entries(properties)) {
      if (value[field] !== undefined && isObject(propertySchema)) {
        issues.push(...validateJsonSchema(propertySchema, value[field]!, `${pathName}.${field}`));
      }
    }
  }
  if (expectedType === "array") {
    if (!Array.isArray(value)) return [`${pathName} expected array`];
    if (isObject(schema.items)) {
      value.forEach((item, index) => issues.push(...validateJsonSchema(schema.items as JsonObject, item, `${pathName}[${index}]`)));
    }
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((item) => JSON.stringify(item) === JSON.stringify(value))) {
    issues.push(`${pathName} must be one of ${schema.enum.join(", ")}`);
  }
  return issues;
}
async function enforceWorkflowGates(manifest: SkillManifest, artifacts: Record<string, JsonObject>, force: boolean, dstackDir: string): Promise<void> {
  if (force) return;
  if (manifest.name === "plan-eng-review" && artifacts["plan-ceo-review"]?.overallVerdict === "FAIL") {
    throw new ArtifactError("/plan-eng-review is blocked because /plan-ceo-review failed. Re-run /autoplan or pass --force.");
  }
  if (manifest.name === "design-consultation" && artifacts["plan-design-review"]?.overallVerdict === "FAIL") {
    throw new ArtifactError("/design-consultation is blocked because /plan-design-review failed. Re-run /autoplan or pass --force.");
  }
  if (manifest.name === "design-consultation" && artifacts["plan-eng-review"]?.overallVerdict === "FAIL") {
    throw new ArtifactError("/design-consultation is blocked because /plan-eng-review failed. Re-run /autoplan or pass --force.");
  }
  if (manifest.name === "ship") {
    if (artifacts.qa?.overallVerdict !== "PASS") {
      throw new ArtifactError("/ship is blocked until /qa has an overallVerdict of PASS.");
    }
    const review = artifacts.review;
    const criticalIssues = Array.isArray(review?.criticalIssues) ? review.criticalIssues : [];
    if (review?.overallVerdict === "FAIL" || criticalIssues.length > 0) {
      throw new ArtifactError("/ship is blocked by unresolved critical review findings.");
    }
    const staleHardGates = (await new StalenessDetector({ dstackDir }).detect()).filter((entry) => entry.skillName === "qa" || entry.skillName === "review");
    if (staleHardGates.length > 0) {
      throw new ArtifactError(`/ship is blocked by stale hard gate artifacts: ${staleHardGates.map((entry) => `/${entry.skillName}`).join(", ")}.`);
    }
  }
}
function matchesType(expectedType: string, value: JsonValue): boolean {
  if (expectedType === "array") return Array.isArray(value);
  if (expectedType === "object") return isObject(value);
  if (expectedType === "integer") return typeof value === "number" && Number.isInteger(value);
  if (expectedType === "number") return typeof value === "number";
  if (expectedType === "string") return typeof value === "string";
  if (expectedType === "boolean") return typeof value === "boolean";
  if (expectedType === "null") return value === null;
  return true;
}
function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isHandler(value: unknown): value is SkillHandler {
  return typeof value === "object" && value !== null && "buildContext" in value && "postProcess" in value;
}
function extractVerdict(output: JsonObject): Verdict | null {
  const value = output.overallVerdict ?? output.verdict;
  if (value === "PASS" || value === "REVISE" || value === "FAIL") return value;
  if (typeof output.shippable === "boolean") return output.shippable ? "PASS" : "FAIL";
  return null;
}
function markGenerated(context: SkillExecutionContext, output: JsonObject): JsonObject {
  return context.generatedBy ? { ...output, generated_by: context.generatedBy } : output;
}
