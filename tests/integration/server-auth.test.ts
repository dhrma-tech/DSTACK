import { request } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { json, startTestServer, type TestServer } from "../helpers/server";

let ts: TestServer;

beforeAll(async () => {
  ts = await startTestServer();
});

afterAll(async () => {
  await ts.close();
});

function rawGet(url: string, headers: Record<string, string>): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: "GET", headers }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on("error", reject);
    req.end();
  });
}

async function openStream(url: string): Promise<number> {
  const controller = new AbortController();
  const res = await fetch(url, { signal: controller.signal });
  controller.abort();
  return res.status;
}

describe("server authentication", () => {
  it("serves /health without a token", async () => {
    const res = await fetch(`${ts.url}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("rejects API calls without a token", async () => {
    const res = await fetch(`${ts.url}/api/skills`);
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "MISSING_TOKEN" });
  });

  it("rejects API calls with the wrong token", async () => {
    const res = await fetch(`${ts.url}/api/skills`, { headers: { Authorization: "Bearer not-the-token" } });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "INVALID_TOKEN" });
  });

  it("accepts API calls with the token", async () => {
    const res = await ts.api("/api/skills");
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  it("rejects sandbox commands without a token", async () => {
    const res = await fetch(`${ts.url}/api/sandbox/commands`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command: "echo hi" }) });
    expect(res.status).toBe(401);
  });

  it("rejects requests addressed to a foreign host (DNS rebinding)", async () => {
    const status = await rawGet(`${ts.url}/health`, { Host: "evil.example.com" });
    expect(status).toBe(403);
  });

  it("opens a stream with a single-use ticket", async () => {
    const ticketRes = await ts.api("/api/stream-tickets", json({ path: "/api/events" }));
    const { ticket } = (await ticketRes.json()) as { ticket: string };
    expect(await openStream(`${ts.url}/api/events?ticket=${ticket}`)).toBe(200);
    expect(await openStream(`${ts.url}/api/events?ticket=${ticket}`)).toBe(401);
  });

  it("rejects a ticket used on a different path", async () => {
    const ticketRes = await ts.api("/api/stream-tickets", json({ path: "/api/runs/run-1-abc/stream" }));
    const { ticket } = (await ticketRes.json()) as { ticket: string };
    expect(await openStream(`${ts.url}/api/events?ticket=${ticket}`)).toBe(401);
  });

  it("only issues tickets for stream paths", async () => {
    const res = await ts.api("/api/stream-tickets", json({ path: "/api/settings" }));
    expect(res.status).toBe(400);
  });

  it("returns ROUTE_NOT_FOUND for unknown API routes", async () => {
    const res = await ts.api("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: "ROUTE_NOT_FOUND" });
  });
});
