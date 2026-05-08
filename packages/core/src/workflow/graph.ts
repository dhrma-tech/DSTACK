/**
 * Strict workflow DAG for DStack's agentic engineering organization.
 *
 * The public buildGraph() method still returns the frontend contract used by the
 * existing UI, but the source of truth is now the immutable stage DAG below.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { type Contracts } from "@dstack/shared";
import { atomicWrite, exists, nowIso, readJsonFile, shortHash } from "../utils.js";

export type WorkflowStageState = "IDLE" | "PLANNING" | "DESIGNING" | "BUILDING" | "AUDITING" | "SHIPPING";
export type AgentPersona = "CEO" | "PM" | "DESIGNER" | "DEVELOPER" | "QA" | "CSO" | "SECURITY" | "HUMAN";

export interface WorkflowGraphOptions {
  dstackDir: string;
  projectRoot: string;
  approvalSecret?: string;
}

export interface SkillManifest {
  name: string;
  description?: string;
  requiresArtifacts?: string[];
  producesArtifacts?: string[];
  nextSkills?: string[];
  dependencies?: string[];
}

export interface ImmutableWorkflowNode {
  readonly id: WorkflowStageState;
  readonly label: string;
  readonly agents: readonly AgentPersona[];
  readonly requiredPayloadKind: "asset-hash-or-human-approval";
}

export interface ImmutableWorkflowEdge {
  readonly from: WorkflowStageState;
  readonly to: WorkflowStageState;
}

export interface HumanApprovalToken {
  tokenId: string;
  payloadHash: string;
  approvedBy: string;
  issuedAt: string;
  expiresAt: string;
  signature: string;
}

export interface StateTransitionPayload {
  from: WorkflowStageState;
  to: WorkflowStageState;
  actor: AgentPersona;
  createdAt: string;
  rationale: string;
  assets?: Record<string, string>;
  assetHash?: string;
  approvalToken?: HumanApprovalToken;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface WorkflowStateSnapshot {
  currentStage: WorkflowStageState;
  transitions: readonly StateTransitionPayload[];
  updatedAt: string;
}

export class WorkflowGateError extends Error {
  constructor(message: string, readonly payload: StateTransitionPayload | null = null) {
    super(message);
    this.name = "WorkflowGateError";
  }
}

export const WORKFLOW_STAGE_ORDER = Object.freeze([
  "IDLE",
  "PLANNING",
  "DESIGNING",
  "BUILDING",
  "AUDITING",
  "SHIPPING"
] as const);

export const STRICT_WORKFLOW_NODES: readonly ImmutableWorkflowNode[] = Object.freeze([
  freezeNode({ id: "IDLE", label: "Idle", agents: ["HUMAN"], requiredPayloadKind: "asset-hash-or-human-approval" }),
  freezeNode({ id: "PLANNING", label: "Planning", agents: ["CEO", "PM"], requiredPayloadKind: "asset-hash-or-human-approval" }),
  freezeNode({ id: "DESIGNING", label: "Designing", agents: ["DESIGNER"], requiredPayloadKind: "asset-hash-or-human-approval" }),
  freezeNode({ id: "BUILDING", label: "Building", agents: ["DEVELOPER"], requiredPayloadKind: "asset-hash-or-human-approval" }),
  freezeNode({ id: "AUDITING", label: "Auditing", agents: ["QA", "CSO", "SECURITY"], requiredPayloadKind: "asset-hash-or-human-approval" }),
  freezeNode({ id: "SHIPPING", label: "Shipping", agents: ["HUMAN"], requiredPayloadKind: "asset-hash-or-human-approval" })
]);

export const STRICT_WORKFLOW_EDGES: readonly ImmutableWorkflowEdge[] = Object.freeze([
  freezeEdge({ from: "IDLE", to: "PLANNING" }),
  freezeEdge({ from: "PLANNING", to: "DESIGNING" }),
  freezeEdge({ from: "DESIGNING", to: "BUILDING" }),
  freezeEdge({ from: "BUILDING", to: "AUDITING" }),
  freezeEdge({ from: "AUDITING", to: "SHIPPING" })
]);

export class WorkflowGraph {
  private readonly statePath: string;

  constructor(private readonly options: WorkflowGraphOptions) {
    this.statePath = path.join(options.dstackDir, "workflow", "state.json");
    assertAcyclic(STRICT_WORKFLOW_NODES, STRICT_WORKFLOW_EDGES);
  }

  async buildGraph(): Promise<Contracts.WorkflowGraph> {
    const projectId = this.generateProjectId();
    const computedAt = nowIso();
    const skillManifests = await this.getSkillManifests();
    const latestArtifacts = await this.getLatestArtifacts();
    const runStatus = await this.getLatestRunStatus();
    const skillNodes = this.buildSkillNodes(skillManifests, latestArtifacts, runStatus);
    const artifactNodes = this.buildArtifactNodes(latestArtifacts);
    const nodes = [...skillNodes, ...artifactNodes];

    return {
      projectId,
      computedAt,
      currentStage: (await this.readState()).currentStage,
      nodes,
      edges: this.buildSkillEdges(skillManifests),
      blockers: this.getBlockers(nodes),
      staleArtifacts: this.getStaleArtifacts(nodes),
      suggestedNextSkills: this.getSuggestedNextSkills(nodes)
    };
  }

  async readState(): Promise<WorkflowStateSnapshot> {
    if (!(await exists(this.statePath))) {
      return freezeState({ currentStage: "IDLE", transitions: [], updatedAt: nowIso() });
    }
    const raw = await readJsonFile<unknown>(this.statePath);
    if (!isRecord(raw) || !isWorkflowStage(raw.currentStage) || !Array.isArray(raw.transitions)) {
      throw new WorkflowGateError("Workflow state file is invalid.");
    }
    const transitions = raw.transitions.map(parseTransitionPayload);
    return freezeState({
      currentStage: raw.currentStage,
      transitions,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : nowIso()
    });
  }

  async transition(payload: StateTransitionPayload): Promise<WorkflowStateSnapshot> {
    const current = await this.readState();
    this.validateTransition(current, payload);
    const next = freezeState({
      currentStage: payload.to,
      transitions: [...current.transitions, freezeTransition(payload)],
      updatedAt: nowIso()
    });
    await atomicWrite(this.statePath, JSON.stringify(next, null, 2));
    return next;
  }

  validateTransition(current: WorkflowStateSnapshot, payload: StateTransitionPayload): void {
    if (payload.from !== current.currentStage) {
      throw new WorkflowGateError(`Transition starts at ${payload.from}, but current stage is ${current.currentStage}.`, payload);
    }
    const expectedNext = nextStage(payload.from);
    if (payload.to !== expectedNext) {
      throw new WorkflowGateError(`Invalid transition ${payload.from} -> ${payload.to}; expected ${payload.from} -> ${expectedNext}.`, payload);
    }
    if (payload.actor !== "HUMAN" && !agentsForStage(payload.to).includes(payload.actor)) {
      throw new WorkflowGateError(`${payload.actor} cannot transition into ${payload.to}.`, payload);
    }
    if (!this.hasVerifiedGatePayload(payload)) {
      throw new WorkflowGateError("State transition requires either a verified asset hash or a valid human approval token.", payload);
    }
  }

  hasVerifiedGatePayload(payload: StateTransitionPayload): boolean {
    if (payload.assets && payload.assetHash) {
      return computeAssetHash(payload.assets) === payload.assetHash;
    }
    if (payload.approvalToken) {
      const payloadHash = computeTransitionHash(payload);
      return verifyApprovalToken(payload.approvalToken, payloadHash, this.approvalSecret());
    }
    return false;
  }

  createApprovalToken(payload: Omit<StateTransitionPayload, "approvalToken">, approvedBy: string, ttlMs = 15 * 60 * 1000): HumanApprovalToken {
    const payloadHash = computeTransitionHash(payload);
    const issuedAt = nowIso();
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    const tokenId = shortHash(`${payloadHash}:${approvedBy}:${issuedAt}`, 16);
    const signature = signApprovalToken({ tokenId, payloadHash, approvedBy, issuedAt, expiresAt }, this.approvalSecret());
    return { tokenId, payloadHash, approvedBy, issuedAt, expiresAt, signature };
  }

  getStrictDag(): { nodes: readonly ImmutableWorkflowNode[]; edges: readonly ImmutableWorkflowEdge[] } {
    return { nodes: STRICT_WORKFLOW_NODES, edges: STRICT_WORKFLOW_EDGES };
  }

  private buildSkillNodes(
    skillManifests: Map<string, SkillManifest>,
    latestArtifacts: Map<string, Contracts.Artifact>,
    runStatus: Map<string, Contracts.SkillRunStatus>
  ): Contracts.WorkflowNode[] {
    const nodes: Contracts.WorkflowNode[] = [];
    for (const [skillName, manifest] of skillManifests) {
      const status = this.determineSkillStatus(skillName, manifest, latestArtifacts, runStatus);
      nodes.push({
        id: `skill:${skillName}`,
        nodeType: "skill",
        label: skillName,
        stage: this.determineSkillStage(skillName),
        status,
        isRequired: true,
        isStale: status === "stale",
        skillName,
        verdict: status === "complete" ? "PASS" : null,
        latestRunId: runStatus.get(skillName) ? shortHash(`${skillName}-${runStatus.get(skillName)}`, 12) : null,
        latestArtifactId: this.getLatestArtifactId(manifest, latestArtifacts),
        nextSkillHint: manifest.nextSkills?.[0] ?? null
      });
    }
    return nodes;
  }

  private buildArtifactNodes(latestArtifacts: Map<string, Contracts.Artifact>): Contracts.WorkflowNode[] {
    return [...latestArtifacts.entries()].map(([artifactId, artifact]): Contracts.WorkflowNode => ({
      id: `artifact:${artifactId}`,
      nodeType: "artifact",
      label: artifact.id,
      stage: "artifact",
      status: "complete",
      isRequired: true,
      isStale: false,
      artifactId,
      verdict: artifact.verdict ?? "PASS",
      latestArtifactId: artifactId
    }));
  }

  private buildSkillEdges(skillManifests: Map<string, SkillManifest>): Contracts.WorkflowEdge[] {
    const edges: Contracts.WorkflowEdge[] = [];
    let edgeCounter = 0;
    for (const [skillName, manifest] of skillManifests) {
      const skillNodeId = `skill:${skillName}`;
      for (const dependency of manifest.dependencies ?? []) {
        edges.push({ id: `skill-edge-${edgeCounter++}`, fromNodeId: `skill:${dependency}`, toNodeId: skillNodeId, edgeType: "prerequisite", required: true });
      }
      for (const artifactId of manifest.requiresArtifacts ?? []) {
        edges.push({ id: `skill-edge-${edgeCounter++}`, fromNodeId: `artifact:${artifactId}`, toNodeId: skillNodeId, edgeType: "prerequisite", required: true });
      }
      for (const artifactId of manifest.producesArtifacts ?? []) {
        edges.push({ id: `skill-edge-${edgeCounter++}`, fromNodeId: skillNodeId, toNodeId: `artifact:${artifactId}`, edgeType: "produces", required: false });
      }
      for (const nextSkill of manifest.nextSkills ?? []) {
        edges.push({ id: `skill-edge-${edgeCounter++}`, fromNodeId: skillNodeId, toNodeId: `skill:${nextSkill}`, edgeType: "recommends", required: false, label: "recommended" });
      }
    }
    return edges;
  }

  private generateProjectId(): string {
    return path.basename(this.options.projectRoot) || "unknown";
  }

  private async getSkillManifests(): Promise<Map<string, SkillManifest>> {
    const manifests = new Map<string, SkillManifest>();
    const skillsDir = path.join(this.options.dstackDir, "skills");
    if (!(await exists(skillsDir))) return manifests;
    try {
      const entries = await fs.readdir(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const manifestPath = path.join(skillsDir, entry.name, "manifest.json");
        if (!(await exists(manifestPath))) continue;
        try {
          const manifest = parseSkillManifest(await readJsonFile<unknown>(manifestPath), entry.name);
          manifests.set(entry.name, manifest);
        } catch {
          continue;
        }
      }
    } catch {
      return manifests;
    }
    return manifests;
  }

  private async getLatestArtifacts(): Promise<Map<string, Contracts.Artifact>> {
    const artifacts = new Map<string, Contracts.Artifact>();
    const artifactsDir = path.join(this.options.dstackDir, "artifacts");
    if (!(await exists(artifactsDir))) return artifacts;
    try {
      const entries = await fs.readdir(artifactsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const latestPath = path.join(artifactsDir, entry.name, "latest.json");
        if (!(await exists(latestPath))) continue;
        try {
          const artifact = await readJsonFile<Contracts.Artifact>(latestPath);
          artifacts.set(entry.name, artifact);
          artifacts.set(artifact.id, artifact);
        } catch {
          continue;
        }
      }
    } catch {
      return artifacts;
    }
    return artifacts;
  }

  private async getLatestRunStatus(): Promise<Map<string, Contracts.SkillRunStatus>> {
    const latestRuns = new Map<string, { status: Contracts.SkillRunStatus; requestedAt: string }>();
    const runsDir = path.join(this.options.dstackDir, "runs");
    if (!(await exists(runsDir))) return new Map();
    try {
      const indexPath = path.join(runsDir, "index.json");
      if (!(await exists(indexPath))) return new Map();
      const index = await readJsonFile<{ runs: Contracts.SkillRun[] }>(indexPath);
      for (const run of index.runs) {
        const existing = latestRuns.get(run.skillName);
        if (!existing || Date.parse(run.requestedAt) > Date.parse(existing.requestedAt)) {
          latestRuns.set(run.skillName, { status: run.status, requestedAt: run.requestedAt });
        }
      }
    } catch {
      return new Map();
    }
    return new Map([...latestRuns.entries()].map(([skillName, run]) => [skillName, run.status]));
  }

  private getBlockers(nodes: Contracts.WorkflowNode[]): string[] {
    return nodes.filter((node) => node.status === "blocked").map((node) => node.id);
  }

  private getStaleArtifacts(nodes: Contracts.WorkflowNode[]): string[] {
    return nodes.filter((node) => node.nodeType === "artifact" && node.isStale).map((node) => node.id);
  }

  private determineSkillStatus(
    skillName: string,
    manifest: SkillManifest,
    latestArtifacts: Map<string, Contracts.Artifact>,
    runStatus: Map<string, Contracts.SkillRunStatus>
  ): Contracts.WorkflowNode["status"] {
    const currentRunStatus = runStatus.get(skillName);
    if (currentRunStatus === "running") return "running";
    if (currentRunStatus === "error" || currentRunStatus === "interrupted") return "error";
    if (!this.arePrerequisitesMet(manifest, latestArtifacts, runStatus)) return "blocked";
    if (currentRunStatus === "complete") return this.areArtifactsStale(manifest, latestArtifacts) ? "stale" : "complete";
    if ((manifest.requiresArtifacts ?? []).length > 0) return "blocked";
    return "ready";
  }

  private determineSkillStage(skillName: string): string {
    if (skillName.includes("office") || skillName.includes("plan")) return "PLANNING";
    if (skillName.includes("design")) return "DESIGNING";
    if (skillName.includes("build") || skillName.includes("implement") || skillName.includes("devex")) return "BUILDING";
    if (skillName.includes("test") || skillName.includes("qa") || skillName.includes("review") || skillName.includes("security")) return "AUDITING";
    if (skillName.includes("ship") || skillName.includes("deploy") || skillName.includes("canary")) return "SHIPPING";
    return "IDLE";
  }

  private arePrerequisitesMet(
    manifest: SkillManifest,
    latestArtifacts: Map<string, Contracts.Artifact>,
    runStatus: Map<string, Contracts.SkillRunStatus>
  ): boolean {
    for (const dependency of manifest.dependencies ?? []) {
      if (runStatus.get(dependency) !== "complete") return false;
    }
    for (const artifactId of manifest.requiresArtifacts ?? []) {
      if (!latestArtifacts.has(artifactId)) return false;
    }
    return true;
  }

  private areArtifactsStale(manifest: SkillManifest, latestArtifacts: Map<string, Contracts.Artifact>): boolean {
    return (manifest.producesArtifacts ?? []).some((artifactId) => !latestArtifacts.has(artifactId));
  }

  private getLatestArtifactId(manifest: SkillManifest, latestArtifacts: Map<string, Contracts.Artifact>): string | null {
    for (const artifactId of manifest.producesArtifacts ?? []) {
      if (latestArtifacts.has(artifactId)) return artifactId;
    }
    return null;
  }

  private getSuggestedNextSkills(nodes: Contracts.WorkflowNode[]): string[] {
    return nodes
      .filter((node) => node.nodeType === "skill" && node.status === "ready" && typeof node.skillName === "string")
      .map((node) => node.skillName as string)
      .sort();
  }

  private approvalSecret(): string {
    return this.options.approvalSecret ?? `dstack:${this.options.projectRoot}`;
  }
}

export function computeAssetHash(assets: Record<string, string>): string {
  const hash = createHash("sha256");
  for (const [filePath, content] of Object.entries(assets).sort(([a], [b]) => a.localeCompare(b))) {
    hash.update(filePath);
    hash.update("\0");
    hash.update(content);
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function computeTransitionHash(payload: Omit<StateTransitionPayload, "approvalToken"> | StateTransitionPayload): string {
  const hashable: Partial<StateTransitionPayload> = { ...payload };
  delete hashable.approvalToken;
  return createHash("sha256").update(JSON.stringify(sortJson(hashable))).digest("hex");
}

export function verifyApprovalToken(token: HumanApprovalToken, payloadHash: string, secret: string): boolean {
  if (token.payloadHash !== payloadHash) return false;
  if (Date.parse(token.expiresAt) <= Date.now()) return false;
  const expected = signApprovalToken(token, secret);
  return safeEqual(expected, token.signature);
}

function signApprovalToken(token: Omit<HumanApprovalToken, "signature">, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${token.tokenId}:${token.payloadHash}:${token.approvedBy}:${token.issuedAt}:${token.expiresAt}`)
    .digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function nextStage(stage: WorkflowStageState): WorkflowStageState {
  const index = stageIndex(stage);
  const next = WORKFLOW_STAGE_ORDER[index + 1];
  if (!next) throw new WorkflowGateError(`${stage} is terminal and cannot transition further.`);
  return next;
}

function stageIndex(stage: WorkflowStageState): number {
  return WORKFLOW_STAGE_ORDER.indexOf(stage);
}

function agentsForStage(stage: WorkflowStageState): readonly AgentPersona[] {
  return STRICT_WORKFLOW_NODES.find((node) => node.id === stage)?.agents ?? [];
}

function assertAcyclic(nodes: readonly ImmutableWorkflowNode[], edges: readonly ImmutableWorkflowEdge[]): void {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const visiting = new Set<WorkflowStageState>();
  const visited = new Set<WorkflowStageState>();
  const adjacency = new Map<WorkflowStageState, WorkflowStageState[]>();
  for (const edge of edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) throw new WorkflowGateError(`Invalid DAG edge ${edge.from} -> ${edge.to}.`);
    adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge.to]);
  }
  const visit = (stage: WorkflowStageState): void => {
    if (visited.has(stage)) return;
    if (visiting.has(stage)) throw new WorkflowGateError(`Workflow DAG contains a cycle at ${stage}.`);
    visiting.add(stage);
    for (const next of adjacency.get(stage) ?? []) visit(next);
    visiting.delete(stage);
    visited.add(stage);
  };
  for (const node of nodes) visit(node.id);
}

function parseTransitionPayload(value: unknown): StateTransitionPayload {
  if (!isRecord(value) || !isWorkflowStage(value.from) || !isWorkflowStage(value.to) || !isAgentPersona(value.actor)) {
    throw new WorkflowGateError("Transition payload is invalid.");
  }
  const payload: StateTransitionPayload = {
    from: value.from,
    to: value.to,
    actor: value.actor,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : nowIso(),
    rationale: typeof value.rationale === "string" ? value.rationale : "No rationale recorded."
  };
  if (isStringRecord(value.assets)) payload.assets = value.assets;
  if (typeof value.assetHash === "string") payload.assetHash = value.assetHash;
  if (isApprovalToken(value.approvalToken)) payload.approvalToken = value.approvalToken;
  if (isMetadata(value.metadata)) payload.metadata = value.metadata;
  return freezeTransition(payload);
}

function parseSkillManifest(value: unknown, fallbackName: string): SkillManifest {
  if (!isRecord(value)) throw new WorkflowGateError("Skill manifest is invalid.");
  return {
    name: typeof value.name === "string" ? value.name : fallbackName,
    ...(typeof value.description === "string" ? { description: value.description } : {}),
    ...(isStringArray(value.requiresArtifacts) ? { requiresArtifacts: value.requiresArtifacts } : {}),
    ...(isStringArray(value.producesArtifacts) ? { producesArtifacts: value.producesArtifacts } : {}),
    ...(isStringArray(value.nextSkills) ? { nextSkills: value.nextSkills } : {}),
    ...(isStringArray(value.dependencies) ? { dependencies: value.dependencies } : {})
  };
}

function freezeNode(node: ImmutableWorkflowNode): ImmutableWorkflowNode {
  return Object.freeze({ ...node, agents: Object.freeze([...node.agents]) });
}

function freezeEdge(edge: ImmutableWorkflowEdge): ImmutableWorkflowEdge {
  return Object.freeze({ ...edge });
}

function freezeTransition(payload: StateTransitionPayload): StateTransitionPayload {
  return Object.freeze({ ...payload });
}

function freezeState(snapshot: WorkflowStateSnapshot): WorkflowStateSnapshot {
  return Object.freeze({ ...snapshot, transitions: Object.freeze([...snapshot.transitions]) });
}

function isWorkflowStage(value: unknown): value is WorkflowStageState {
  return typeof value === "string" && (WORKFLOW_STAGE_ORDER as readonly string[]).includes(value);
}

function isAgentPersona(value: unknown): value is AgentPersona {
  return typeof value === "string" && ["CEO", "PM", "DESIGNER", "DEVELOPER", "QA", "CSO", "SECURITY", "HUMAN"].includes(value);
}

function isApprovalToken(value: unknown): value is HumanApprovalToken {
  return isRecord(value)
    && typeof value.tokenId === "string"
    && typeof value.payloadHash === "string"
    && typeof value.approvedBy === "string"
    && typeof value.issuedAt === "string"
    && typeof value.expiresAt === "string"
    && typeof value.signature === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string");
}

function isMetadata(value: unknown): value is Record<string, string | number | boolean | null> {
  return isRecord(value) && Object.values(value).every((item) => item === null || ["string", "number", "boolean"].includes(typeof item));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, sortJson(child)]));
}
