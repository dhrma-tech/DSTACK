import { describe, expect, it } from "vitest";
import type { SkillManifest, Verdict } from "@dstack/shared";
import { buildSkillPipeline, ConflictScanner, suggestNextSkills } from "@dstack/core";

function manifest(name: string, requiresArtifacts: string[] = [], nextSkill: string | null = null): SkillManifest {
  return {
    name, description: name, triggerPhrases: [], model: "fake", streaming: false, requiresArtifacts, allowedTools: [], inputs: [],
    outputSchema: {}, artifactPath: name, nextSkill, failureCases: [], acceptanceCriteria: [], systemPromptFile: "prompt.md"
  };
}

type Latest = Record<string, { verdict: Verdict | null; createdAt: string }>;

const MANIFESTS = [
  manifest("office-hours", [], "autoplan"),
  manifest("autoplan", ["office-hours"], "review"),
  manifest("review", ["autoplan"], "qa"),
  manifest("qa", ["autoplan"], "ship"),
  manifest("ship", ["qa", "review"]),
  manifest("health")
];

function sources(latest: Latest) {
  return { manifests: MANIFESTS, readLatest: async (skill: string) => latest[skill] ?? null };
}

function statusOf(pipeline: Awaited<ReturnType<typeof buildSkillPipeline>>, skill: string) {
  return pipeline.nodes.find((node) => node.skillName === skill);
}

describe("buildSkillPipeline", () => {
  it("marks skills ready or blocked by their required artifacts", async () => {
    const pipeline = await buildSkillPipeline(sources({}));
    expect(statusOf(pipeline, "office-hours")).toMatchObject({ status: "ready", missing: [] });
    expect(statusOf(pipeline, "autoplan")).toMatchObject({ status: "blocked", missing: ["office-hours"] });
    expect(statusOf(pipeline, "ship")).toMatchObject({ status: "blocked", missing: ["qa", "review"] });
    expect(pipeline.edges).toContainEqual({ from: "qa", to: "ship" });
  });

  it("uses each artifact's own verdict, not a blanket PASS", async () => {
    const pipeline = await buildSkillPipeline(sources({
      "office-hours": { verdict: null, createdAt: "2026-01-01T00:00:00Z" },
      autoplan: { verdict: "PASS", createdAt: "2026-01-02T00:00:00Z" },
      qa: { verdict: "FAIL", createdAt: "2026-01-03T00:00:00Z" }
    }));
    expect(statusOf(pipeline, "office-hours")?.status).toBe("complete");
    expect(statusOf(pipeline, "autoplan")).toMatchObject({ status: "PASS", verdict: "PASS" });
    expect(statusOf(pipeline, "qa")).toMatchObject({ status: "FAIL", verdict: "FAIL" });
    expect(statusOf(pipeline, "review")?.status).toBe("ready");
  });

  it("reports a stale upstream ahead of a failure that depends on it", async () => {
    const pipeline = await buildSkillPipeline(sources({
      "office-hours": { verdict: null, createdAt: "2026-01-05T00:00:00Z" },
      autoplan: { verdict: "PASS", createdAt: "2026-01-02T00:00:00Z" },
      qa: { verdict: "FAIL", createdAt: "2026-01-06T00:00:00Z" }
    }));
    // qa depends on the stale autoplan, so it is stale too; re-running autoplan comes first.
    expect(statusOf(pipeline, "qa")).toMatchObject({ status: "stale", verdict: "FAIL" });
    expect(suggestNextSkills(pipeline)[0]).toMatchObject({ skill: "autoplan", category: "critical" });
  });

  it("propagates staleness more than one level downstream", async () => {
    // office-hours was re-run after everything else, so autoplan is stale, and qa/ship (downstream of autoplan) are stale too.
    const pipeline = await buildSkillPipeline(sources({
      "office-hours": { verdict: null, createdAt: "2026-01-10T00:00:00Z" },
      autoplan: { verdict: "PASS", createdAt: "2026-01-02T00:00:00Z" },
      qa: { verdict: "PASS", createdAt: "2026-01-03T00:00:00Z" },
      review: { verdict: "PASS", createdAt: "2026-01-03T00:00:00Z" },
      ship: { verdict: "PASS", createdAt: "2026-01-04T00:00:00Z" }
    }));
    expect(statusOf(pipeline, "autoplan")).toMatchObject({ status: "stale", staleBecause: ["office-hours"] });
    expect(statusOf(pipeline, "qa")).toMatchObject({ status: "stale", staleBecause: ["autoplan"] });
    expect(statusOf(pipeline, "ship")).toMatchObject({ status: "stale", staleBecause: ["qa", "review"] });
    expect(statusOf(pipeline, "office-hours")?.status).toBe("complete");
  });
});

describe("suggestNextSkills", () => {
  it("puts failures and stale skills first, then the next core step", async () => {
    // qa failed; review ran before the latest autoplan, so it is stale.
    const pipeline = await buildSkillPipeline(sources({
      "office-hours": { verdict: null, createdAt: "2026-01-01T00:00:00Z" },
      autoplan: { verdict: "PASS", createdAt: "2026-01-02T00:00:00Z" },
      review: { verdict: "PASS", createdAt: "2026-01-01T12:00:00Z" },
      qa: { verdict: "FAIL", createdAt: "2026-01-03T00:00:00Z" }
    }));
    const suggestions = suggestNextSkills(pipeline);
    expect(suggestions[0]).toMatchObject({ skill: "qa", category: "critical", priority: 1 });
    expect(suggestions[1]).toMatchObject({ skill: "review", category: "critical", priority: 2 });
    expect(suggestions[1]?.reason).toContain("/autoplan");
    expect(suggestions.map((s) => s.priority)).toEqual(suggestions.map((_, index) => index + 1));
  });

  it("recommends the first core skill on a new project", async () => {
    const suggestions = suggestNextSkills(await buildSkillPipeline(sources({})));
    expect(suggestions[0]).toMatchObject({ skill: "office-hours", category: "recommended" });
    expect(suggestions.find((s) => s.skill === "health")?.category).toBe("optional");
  });
});

describe("ConflictScanner", () => {
  function reader(latest: Latest) {
    return { readLatest: async (skill: string) => latest[skill] ?? null };
  }

  it("flags QA passing while code review failed", async () => {
    const conflicts = await new ConflictScanner(reader({
      qa: { verdict: "PASS", createdAt: "2026-01-02T00:00:00Z" },
      review: { verdict: "FAIL", createdAt: "2026-01-01T00:00:00Z" }
    })).scan();
    expect(conflicts).toEqual([expect.objectContaining({ artifactA: "qa", artifactB: "review", severity: "high" })]);
  });

  it("reports nothing when verdicts agree or artifacts are missing", async () => {
    expect(await new ConflictScanner(reader({ qa: { verdict: "PASS", createdAt: "x" }, review: { verdict: "PASS", createdAt: "x" } })).scan()).toEqual([]);
    expect(await new ConflictScanner(reader({ qa: { verdict: "PASS", createdAt: "x" } })).scan()).toEqual([]);
  });
});
