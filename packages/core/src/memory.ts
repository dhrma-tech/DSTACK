import { readdir } from "node:fs/promises";
import path from "node:path";
import { ArtifactError, checkpointSchema, projectMemorySchema, type Artifact, type Checkpoint, type JsonObject, type ProjectMemory, type Verdict } from "@dstack/shared";
import { atomicCopy, atomicWrite, ensureDir, exists, fileSafeTimestamp, git, nowIso, readJsonFile, shortHash } from "./utils.js";

export class MemoryStore {
  readonly memoryPath: string;
  constructor(dstackDir: string) {
    this.memoryPath = path.join(dstackDir, "memory.json");
  }
  async read(): Promise<ProjectMemory | null> {
    if (!(await exists(this.memoryPath))) return null;
    const parsed = projectMemorySchema.safeParse(await readJsonFile<unknown>(this.memoryPath));
    if (!parsed.success) throw new ArtifactError("Project memory is invalid", { issues: parsed.error.issues });
    return parsed.data;
  }
  async write(memory: ProjectMemory): Promise<void> {
    const parsed = projectMemorySchema.safeParse(memory);
    if (!parsed.success) throw new ArtifactError("Cannot write invalid project memory", { issues: parsed.error.issues });
    await atomicWrite(this.memoryPath, JSON.stringify(parsed.data, null, 2));
  }
  async seedFromOfficeHours(output: JsonObject): Promise<ProjectMemory> {
    const existing = await this.read();
    const tech = objectValue(output.techStack);
    const now = nowIso();
    const memory: ProjectMemory = {
      version: "1",
      projectName: stringValue(output.projectName, existing?.projectName ?? "DStack Project"),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      techStack: {
        frontend: stringValue(tech.frontend, existing?.techStack.frontend ?? ""),
        backend: stringValue(tech.backend, existing?.techStack.backend ?? ""),
        database: existing?.techStack.database ?? "",
        infra: stringValue(tech.infra, existing?.techStack.infra ?? ""),
        testing: existing?.techStack.testing ?? ""
      },
      goals: stringArray(output.successMetrics, existing?.goals ?? []),
      constraints: stringArray(output.constraints, existing?.constraints ?? []),
      keyDecisions: existing?.keyDecisions ?? [],
      domainTerms: existing?.domainTerms ?? {},
      openQuestions: stringArray(output.openQuestions, existing?.openQuestions ?? [])
    };
    await this.write(memory);
    return memory;
  }
}

export class ArtifactStore {
  readonly artifactRoot: string;
  constructor(dstackDir: string) {
    this.artifactRoot = path.join(dstackDir, "artifacts");
  }
  async write(skillName: string, payload: JsonObject): Promise<Artifact> {
    const skillDir = path.join(this.artifactRoot, skillName);
    await ensureDir(skillDir);
    const generatedAt = typeof payload.generatedAt === "string" && !Number.isNaN(Date.parse(payload.generatedAt)) ? payload.generatedAt : nowIso();
    const body = JSON.stringify({ ...payload, generatedAt }, null, 2);
    const id = `${fileSafeTimestamp()}-${shortHash(body)}`;
    const filePath = path.join(skillDir, `${id}.json`);
    await atomicWrite(filePath, body);
    await atomicCopy(filePath, path.join(skillDir, "latest.json"));
    return { id, skillName, createdAt: nowIso(), filePath, isLatest: true, content: JSON.parse(body) as JsonObject, verdict: extractVerdict(JSON.parse(body) as JsonObject) };
  }
  async readLatest(skillName: string): Promise<Artifact | null> {
    const filePath = path.join(this.artifactRoot, skillName, "latest.json");
    if (!(await exists(filePath))) return null;
    const content = await readJsonFile<JsonObject>(filePath);
    return { id: "latest", skillName, createdAt: stringValue(content.generatedAt, nowIso()), filePath, isLatest: true, content, verdict: extractVerdict(content) };
  }
  async requireLatest(skillName: string): Promise<Artifact> {
    const artifact = await this.readLatest(skillName);
    if (!artifact) throw new ArtifactError(`Missing required artifact: ${skillName}`, { skillName });
    return artifact;
  }
  async list(skillName: string): Promise<Artifact[]> {
    const skillDir = path.join(this.artifactRoot, skillName);
    if (!(await exists(skillDir))) return [];
    const files = (await readdir(skillDir)).filter((file) => file.endsWith(".json") && file !== "latest.json").sort();
    const artifacts: Artifact[] = [];
    for (const file of files) {
      const content = await readJsonFile<JsonObject>(path.join(skillDir, file));
      artifacts.push({ id: file.replace(/\.json$/, ""), skillName, createdAt: stringValue(content.generatedAt, nowIso()), filePath: path.join(skillDir, file), isLatest: false, content, verdict: extractVerdict(content) });
    }
    return artifacts;
  }
  async listSkillsWithArtifacts(): Promise<string[]> {
    if (!(await exists(this.artifactRoot))) return [];
    return (await readdir(this.artifactRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  }
}

export class CheckpointStore {
  readonly checkpointDir: string;
  constructor(private readonly dstackDir: string, private readonly projectRoot: string) {
    this.checkpointDir = path.join(dstackDir, "checkpoints");
  }
  async save(name = fileSafeTimestamp()): Promise<Checkpoint> {
    await ensureDir(this.checkpointDir);
    const artifacts = new ArtifactStore(this.dstackDir);
    const artifactPointers: Record<string, string> = {};
    for (const skillName of await artifacts.listSkillsWithArtifacts()) {
      const latest = (await artifacts.list(skillName)).at(-1);
      if (latest) artifactPointers[skillName] = path.basename(latest.filePath);
    }
    const checkpoint: Checkpoint = {
      name,
      savedAt: nowIso(),
      gitHead: (await git(["rev-parse", "HEAD"], this.projectRoot)).stdout.trim(),
      branch: (await git(["branch", "--show-current"], this.projectRoot)).stdout.trim(),
      memorySnapshot: await new MemoryStore(this.dstackDir).read(),
      artifactPointers,
      summary: `Checkpoint ${name} saved with ${Object.keys(artifactPointers).length} artifacts.`
    };
    await atomicWrite(path.join(this.checkpointDir, `${name}.checkpoint.json`), JSON.stringify(checkpoint, null, 2));
    return checkpoint;
  }
  async restore(name: string): Promise<Checkpoint> {
    const filePath = path.join(this.checkpointDir, `${name}.checkpoint.json`);
    if (!(await exists(filePath))) throw new ArtifactError(`Checkpoint not found: ${name}`);
    const parsed = checkpointSchema.safeParse(await readJsonFile<unknown>(filePath));
    if (!parsed.success) throw new ArtifactError("Checkpoint is corrupted", { issues: parsed.error.issues });
    for (const [skillName, fileName] of Object.entries(parsed.data.artifactPointers)) {
      await atomicCopy(path.join(this.dstackDir, "artifacts", skillName, fileName), path.join(this.dstackDir, "artifacts", skillName, "latest.json"));
    }
    if (parsed.data.memorySnapshot) await new MemoryStore(this.dstackDir).write(parsed.data.memorySnapshot);
    return parsed.data;
  }
}

function extractVerdict(content: JsonObject): Verdict | null {
  const value = content.overallVerdict ?? content.verdict;
  if (value === "PASS" || value === "REVISE" || value === "FAIL") return value;
  if (typeof content.shippable === "boolean") return content.shippable ? "PASS" : "FAIL";
  return null;
}
function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}
function stringArray(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : fallback;
}
function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
