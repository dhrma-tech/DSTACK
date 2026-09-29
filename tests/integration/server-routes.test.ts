import { mkdir, readFile, writeFile } from "node:fs/promises";
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

describe("deploy routes", () => {
  it("returns null config when no deploy.json exists", async () => {
    const res = await ts.api("/api/deploy/config");
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it("freezes and unfreezes deploys", async () => {
    expect(await (await ts.api("/api/deploy/state")).json()).toMatchObject({ frozen: false });
    const frozen = await (await ts.api("/api/deploy/freeze", json({ reason: "release week" }))).json();
    expect(frozen).toMatchObject({ frozen: true, reason: "release week" });
    const unfrozen = await (await ts.api("/api/deploy/unfreeze", { method: "POST" })).json();
    expect(unfrozen).toMatchObject({ frozen: false });
  });

  it("rejects an invalid freeze date", async () => {
    const res = await ts.api("/api/deploy/freeze", json({ until: "not-a-date" }));
    expect(res.status).toBe(400);
  });

  it("lists deploy runs", async () => {
    expect(await (await ts.api("/api/deploy/runs")).json()).toEqual([]);
  });
});

describe("safety routes", () => {
  it("reads and sets the safety mode", async () => {
    expect(await (await ts.api("/api/safety")).json()).toMatchObject({ mode: "NORMAL" });
    const res = await ts.api("/api/safety/mode", json({ mode: "CAREFUL" }));
    expect(await res.json()).toMatchObject({ mode: "CAREFUL" });
    await ts.api("/api/safety/mode", json({ mode: "NORMAL" }));
  });

  it("rejects unknown modes", async () => {
    const res = await ts.api("/api/safety/mode", json({ mode: "YOLO" }));
    expect(res.status).toBe(400);
  });
});

describe("settings routes", () => {
  it("never returns the API key in full", async () => {
    const previous = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "AIzaTESTKEY-secret-value-1234";
    try {
      const body = await (await ts.api("/api/settings")).json();
      expect(body.geminiApiKeyStatus).toBe("unverified");
      expect(body.maskedKey).toMatch(/1234$/);
      expect(JSON.stringify(body)).not.toContain("secret-value");
    } finally {
      if (previous === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = previous;
    }
  });

  it("updates model settings in config.yaml", async () => {
    const res = await ts.api("/api/settings", { method: "PUT", body: JSON.stringify({ defaultModel: "gemini-test-model", maxTokens: 4096 }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ defaultModel: "gemini-test-model", maxTokens: 4096 });
    const file = await readFile(path.join(ts.root, ".dstack", "config.yaml"), "utf-8");
    expect(file).toContain("gemini-test-model");
  });

  it("refuses to write API keys", async () => {
    const res = await ts.api("/api/settings", { method: "PUT", body: JSON.stringify({ geminiApiKey: "AIza-should-not-save" }) });
    expect(res.status).toBe(400);
    const file = await readFile(path.join(ts.root, ".dstack", "config.yaml"), "utf-8").catch(() => "");
    expect(file).not.toContain("should-not-save");
  });

  it("validates numeric settings", async () => {
    const res = await ts.api("/api/settings", { method: "PUT", body: JSON.stringify({ maxTokens: -1 }) });
    expect(res.status).toBe(400);
  });
});

describe("benchmarks and browser routes", () => {
  it("lists benchmarks", async () => {
    expect(await (await ts.api("/api/benchmarks")).json()).toEqual([]);
    expect((await ts.api("/api/benchmarks/missing-run")).status).toBe(404);
  });

  it("lists and serves screenshots", async () => {
    const dir = path.join(ts.root, ".dstack", "browser", "screenshots");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "home.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const list = await (await ts.api("/api/browser/screenshots")).json();
    expect(list).toEqual([expect.objectContaining({ filename: "home.png", url: "/api/browser/screenshots/home.png" })]);
    const image = await ts.api("/api/browser/screenshots/home.png");
    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toContain("image/png");
  });

  it("blocks path traversal and session files", async () => {
    expect((await ts.api("/api/browser/screenshots/..%2F..%2Fconfig.yaml")).status).toBe(404);
    expect((await ts.api("/api/browser/screenshots/..%5Capi%5Ctoken")).status).toBe(404);
    expect((await ts.api("/api/browser/sessions/default/cookies.json")).status).toBe(404);
  });
});

describe("learnings routes", () => {
  it("searches, updates status and deletes learnings", async () => {
    const first = await (await ts.api("/api/learnings/extract", json({ skillName: "qa", pattern: "Run flaky tests twice before failing" }))).json();
    await ts.api("/api/learnings/extract", json({ skillName: "review", pattern: "Prefer small pull requests" }));

    const all = await (await ts.api("/api/learnings")).json();
    expect(all).toHaveLength(2);
    const matches = await (await ts.api("/api/learnings?q=flaky")).json();
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ skillName: "qa", pattern: "Run flaky tests twice before failing", status: "pending" });

    const approved = await (await ts.api(`/api/learnings/${first.id}/status`, json({ status: "approved" }))).json();
    expect(approved.status).toBe("approved");

    expect((await ts.api(`/api/learnings/${first.id}`, { method: "DELETE" })).status).toBe(200);
    expect(await (await ts.api("/api/learnings")).json()).toHaveLength(1);
    expect((await ts.api(`/api/learnings/${first.id}`, { method: "DELETE" })).status).toBe(404);
  });
});

describe("run routes", () => {
  it("returns 404 for unknown and malformed run ids", async () => {
    expect((await ts.api("/api/runs/run-1-abc")).status).toBe(404);
    expect((await ts.api("/api/runs/..%2F..%2Fconfig")).status).toBe(404);
  });

  it("refuses to stop a run that isn't active", async () => {
    expect((await ts.api("/api/runs/run-1-abc/stop", { method: "POST" })).status).toBe(409);
  });

  it("rejects unknown skills", async () => {
    const res = await ts.api("/api/skills/not-a-skill/run", json({ inputs: {} }));
    expect(res.status).toBe(404);
  });

  it("rejects inputs that would become CLI options", async () => {
    for (const key of ["allow-secrets", "serve", "provider", "json-events"]) {
      const res = await ts.api("/api/skills/office-hours/run", json({ inputs: { [key]: "true" } }));
      expect(res.status, key).toBe(400);
    }
  });

  it("rejects malformed inputs", async () => {
    expect((await ts.api("/api/skills/office-hours/run", json({ inputs: { idea: { nested: true } } }))).status).toBe(400);
    expect((await ts.api("/api/skills/office-hours/run", json({ inputs: { "Bad Key": "x" } }))).status).toBe(400);
    expect((await ts.api("/api/skills/office-hours/run", json({ provider: "openai" }))).status).toBe(400);
  });
});
