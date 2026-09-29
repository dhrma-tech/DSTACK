import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { startServer, type RunningServer } from "../../packages/server/src/server";

export interface TestServer {
  url: string;
  root: string;
  token: string;
  server: RunningServer;
  /** Authenticated fetch against the server. */
  api: (apiPath: string, init?: RequestInit) => Promise<Response>;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const root = await mkdtemp(path.join(os.tmpdir(), "dstack-server-"));
  const server = await startServer({ projectRoot: root, port: 0, notifications: false });
  const token = (await readFile(path.join(root, server.tokenFileRelative), "utf-8")).trim();
  const api = (apiPath: string, init: RequestInit = {}) =>
    fetch(`${server.url}${apiPath}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers ?? {}) }
    });
  return {
    url: server.url,
    root,
    token,
    server,
    api,
    close: async () => {
      await server.close();
      await rm(root, { recursive: true, force: true }).catch(() => undefined);
    }
  };
}

export function json(body: unknown): RequestInit {
  return { method: "POST", body: JSON.stringify(body) };
}
