import { spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface ServeOptions {
  projectRoot: string;
  host?: string;
  port?: number;
  tokenFile?: string;
}

export interface ServeHandle {
  url: string;
  host: string;
  port: number;
  tokenFile: string;
  /** Resolves with the server's exit code. */
  exited: Promise<number>;
  stop: () => Promise<void>;
}

const READY_PREFIX = "DSTACK_READY ";
const START_TIMEOUT_MS = 60_000;

// Works from both src/ and dist/: each sits one level below packages/cli.
const serverEntry = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../server/src/index.ts");

/** Starts the DStack HTTP server as a child process (no shell) and waits until it is listening. */
export function startServeProcess(options: ServeOptions): Promise<ServeHandle> {
  const tsxCli = createRequire(import.meta.url).resolve("tsx/cli");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DSTACK_PROJECT_ROOT: options.projectRoot,
    DSTACK_READY_SIGNAL: "1",
    API_HOST: options.host ?? "127.0.0.1",
    API_PORT: String(options.port ?? 3001)
  };
  if (options.tokenFile) env.DSTACK_TOKEN_FILE = options.tokenFile;

  const child: ChildProcess = spawn(process.execPath, [tsxCli, serverEntry], { cwd: options.projectRoot, env, shell: false, stdio: ["ignore", "pipe", "pipe"] });
  const exited = new Promise<number>((resolve) => child.once("exit", (code) => resolve(code ?? 0)));
  const stop = async () => {
    if (child.exitCode !== null) return;
    child.kill("SIGTERM");
    const timer = setTimeout(() => child.kill("SIGKILL"), 5_000);
    await exited;
    clearTimeout(timer);
  };

  return new Promise((resolve, reject) => {
    let stderr = "";
    let stdout = "";
    const timer = setTimeout(() => {
      void stop();
      reject(new Error("The DStack server did not start within 60 seconds."));
    }, START_TIMEOUT_MS);

    child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      const line = stdout.split("\n").find((entry) => entry.startsWith(READY_PREFIX));
      if (!line) return;
      clearTimeout(timer);
      const ready = JSON.parse(line.slice(READY_PREFIX.length)) as { url: string; host: string; port: number; tokenFile: string };
      resolve({ ...ready, exited, stop });
    });
    void exited.then((code) => {
      clearTimeout(timer);
      reject(new Error(`The DStack server exited with code ${code}. ${stderr.trim()}`.trim()));
    });
  });
}
