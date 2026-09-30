import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { json, startTestServer, type TestServer } from "../helpers/server";

let ts: TestServer;

beforeAll(async () => {
  ts = await startTestServer();
});

afterAll(async () => {
  await ts.close();
});

async function readStream(url: string): Promise<Array<{ type: string; [key: string]: unknown }>> {
  const res = await fetch(url);
  const text = await res.text();
  return text.split("\n\n").filter((chunk) => chunk.startsWith("data: ")).map((chunk) => JSON.parse(chunk.slice(6)));
}

describe("skill runs through the server (fake provider)", () => {
  it("runs /office-hours end to end, streams events and persists the run", async () => {
    const start = await ts.api("/api/skills/office-hours/run", json({ inputs: { idea: "A habit tracker for teams" }, provider: "fake" }));
    expect(start.status).toBe(200);
    const { runId } = (await start.json()) as { runId: string };
    expect(runId).toMatch(/^run-\d+-[a-z0-9]+$/);

    const { ticket } = (await (await ts.api("/api/stream-tickets", json({ path: `/api/runs/${runId}/stream` }))).json()) as { ticket: string };
    const events = await readStream(`${ts.url}/api/runs/${runId}/stream?ticket=${ticket}`);
    const complete = events.at(-1);
    expect(complete).toMatchObject({ type: "complete", skillName: "office-hours", status: "complete", durationMs: expect.any(Number) });
    // Exactly one `complete`: the runner's, sent after the process exits (the CLI's own copy is not forwarded).
    expect(events.filter((event) => event.type === "complete")).toHaveLength(1);

    // No waiting: the server persists the final record before it broadcasts `complete`.
    const record = await (await ts.api(`/api/runs/${runId}`)).json();
    expect(record).toMatchObject({ id: runId, skillName: "office-hours", status: "complete", provider: "fake" });
    expect(record.events.length).toBeGreaterThan(1);

    const artifact = JSON.parse(await readFile(path.join(ts.root, ".dstack", "artifacts", "office-hours", "latest.json"), "utf-8"));
    expect(JSON.stringify(artifact)).toContain("habit tracker");

    const list = await (await ts.api("/api/runs")).json();
    expect(list.some((run: { id: string }) => run.id === runId)).toBe(true);
  }, 120_000);
});
