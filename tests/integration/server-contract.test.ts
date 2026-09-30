import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestServer, type TestServer } from "../helpers/server";

// Every call made by packages/web/src/lib/api.ts. Keep this list in sync with that file:
// a route missing on the server shows up here as ROUTE_NOT_FOUND.
const WEB_CALLS: Array<[method: string, path: string, body?: unknown]> = [
  ["GET", "/api/project"],
  ["GET", "/api/project/health"],
  ["GET", "/api/skills"],
  ["GET", "/api/skills/market"],
  ["GET", "/api/skills/qa"],
  ["GET", "/api/runs"],
  ["GET", "/api/runs/run-1-abc"],
  ["POST", "/api/runs/run-1-abc/stop"],
  ["POST", "/api/approvals/run-1-abc/respond", { decision: "approve" }],
  ["GET", "/api/artifacts"],
  ["GET", "/api/artifacts/qa"],
  ["GET", "/api/artifacts/qa/latest"],
  ["GET", "/api/workflow/graph"],
  ["GET", "/api/workflow/suggestions"],
  ["GET", "/api/workflow/conflicts"],
  ["GET", "/api/history"],
  ["GET", "/api/templates"],
  ["GET", "/api/templates/scaffold"],
  ["GET", "/api/deploy/config"],
  ["GET", "/api/deploy/state"],
  ["GET", "/api/deploy/runs"],
  ["GET", "/api/safety"],
  ["GET", "/api/learnings"],
  ["GET", "/api/benchmarks"],
  ["GET", "/api/benchmarks/missing"],
  ["GET", "/api/browser/screenshots"],
  ["GET", "/api/settings"],
  ["POST", "/api/workflows/runs/run-1-abc/approvals", { decision: "deny" }]
];

let ts: TestServer;

beforeAll(async () => {
  ts = await startTestServer();
});

afterAll(async () => {
  await ts.close();
});

// Checks values, not field names: a field called maxTokens is fine; a value that is
// an absolute path, the API token, or a Gemini key is not.
const ABSOLUTE_PATH = /^[A-Za-z]:[\\/]|^\\\\|^\/(home|Users|var|etc|tmp|private|root)\//;
const GEMINI_KEY = /AIza[0-9A-Za-z_-]{20,}/;

function leakedValues(value: unknown, token: string, root: string, trail = "$"): string[] {
  if (typeof value === "string") {
    const leaks: string[] = [];
    if (ABSOLUTE_PATH.test(value) || value.includes(root)) leaks.push(`${trail}: absolute path`);
    if (value.includes(token)) leaks.push(`${trail}: API token`);
    if (GEMINI_KEY.test(value)) leaks.push(`${trail}: API key`);
    return leaks;
  }
  if (Array.isArray(value)) return value.flatMap((item, index) => leakedValues(item, token, root, `${trail}[${index}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([key, item]) => leakedValues(item, token, root, `${trail}.${key}`));
  return [];
}

describe("server responses are frontend-safe", () => {
  it("never returns absolute paths, the API token or API keys", async () => {
    // Seed data so list endpoints return real rows.
    await ts.api("/api/learnings/extract", { method: "POST", body: JSON.stringify({ skillName: "qa", pattern: "Seeded learning" }) });
    const run = await ts.api("/api/skills/office-hours/run", { method: "POST", body: JSON.stringify({ inputs: { idea: "Seed" }, provider: "fake" }) });
    const { runId } = (await run.json()) as { runId: string };
    for (let i = 0; i < 120; i++) {
      const record = await ts.api(`/api/runs/${runId}`);
      if (record.ok && ((await record.json()) as { status: string }).status !== "running") break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const leaks: string[] = [];
    for (const [method, apiPath] of [...WEB_CALLS.filter(([m]) => m === "GET"), ["GET", `/api/runs/${runId}`], ["GET", "/api/artifacts/office-hours/latest"]] as const) {
      const res = await ts.api(apiPath, { method });
      if (!res.headers.get("content-type")?.includes("json")) continue;
      leaks.push(...leakedValues(await res.json(), ts.token, ts.root, `${method} ${apiPath}`));
    }
    expect(leaks).toEqual([]);
  }, 120_000);
});

describe("web client ↔ server contract", () => {
  it.each(WEB_CALLS)("%s %s has a server route", async (method, apiPath, body) => {
    const res = await ts.api(apiPath, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const payload = res.headers.get("content-type")?.includes("json") ? ((await res.json()) as { code?: string } | null) : null;
    expect(payload?.code, `${method} ${apiPath} → ${res.status}`).not.toBe("ROUTE_NOT_FOUND");
    expect(res.status, `${method} ${apiPath}`).toBeLessThan(500);
  });
});
