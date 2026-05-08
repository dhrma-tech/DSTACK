import { createHash } from "node:crypto";
import type { AgentPersona, WorkflowStalled } from "@dstack/shared";

export class WorkflowStalledError extends Error {
  constructor(readonly stalled: WorkflowStalled) {
    super(stalled.reason);
    this.name = "WorkflowStalledError";
  }
}

export interface IterationRecord {
  issueHash: string;
  agentPair: readonly [AgentPersona, AgentPersona];
  bounceCount: number;
  lastFinding: string;
  updatedAt: string;
}

export interface IterationTrackerOptions {
  maxBounces?: number;
}

export class IterationTracker {
  private readonly records = new Map<string, IterationRecord>();
  private readonly maxBounces: number;

  constructor(options: IterationTrackerOptions = {}) {
    this.maxBounces = options.maxBounces ?? 3;
  }

  recordBounce(input: {
    issue: string;
    fromAgent: AgentPersona;
    toAgent: AgentPersona;
    finding: string;
    recommendedHumanAction?: string;
  }): IterationRecord {
    const issueHash = normalizeIssueHash(input.issue);
    const agentPair = normalizeAgentPair(input.fromAgent, input.toAgent);
    const key = `${issueHash}:${agentPair.join(">")}`;
    const existing = this.records.get(key);
    const record: IterationRecord = {
      issueHash,
      agentPair,
      bounceCount: (existing?.bounceCount ?? 0) + 1,
      lastFinding: input.finding,
      updatedAt: new Date().toISOString()
    };
    this.records.set(key, record);

    if (record.bounceCount > this.maxBounces) {
      throw new WorkflowStalledError({
        issueHash,
        agentPair: [agentPair[0], agentPair[1]],
        bounceCount: record.bounceCount,
        reason: `Workflow stalled: ${agentPair[0]} and ${agentPair[1]} bounced the same issue ${record.bounceCount} times.`,
        lastFinding: input.finding,
        recommendedHumanAction: input.recommendedHumanAction ?? "Clarify the requirement or manually edit the disputed code before resuming."
      });
    }

    return record;
  }

  getRecords(): IterationRecord[] {
    return [...this.records.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  reset(issue?: string): void {
    if (!issue) {
      this.records.clear();
      return;
    }
    const issueHash = normalizeIssueHash(issue);
    for (const key of this.records.keys()) {
      if (key.startsWith(`${issueHash}:`)) this.records.delete(key);
    }
  }
}

export function normalizeIssueHash(issue: string): string {
  return createHash("sha256")
    .update(issue.trim().toLowerCase().replace(/\s+/g, " "))
    .digest("hex")
    .slice(0, 16);
}

function normalizeAgentPair(left: AgentPersona, right: AgentPersona): readonly [AgentPersona, AgentPersona] {
  return [left, right].sort() as [AgentPersona, AgentPersona];
}
