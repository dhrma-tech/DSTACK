import { exec, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface SandboxCommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

export interface SandboxFileVerification {
  path: string;
  exists: boolean;
  sizeBytes: number;
  sha256: string | null;
}

export interface SandboxCapabilities {
  supportsPreview: boolean;
  supportsShell: boolean;
  supportsFileHash: boolean;
  supportsAutomatedScreenshot: boolean;
}

export interface LocalSandboxProviderOptions {
  rootDir: string;
  startCommand?: string;
  startupTimeoutMs?: number;
}

export class StateDesyncError extends Error {
  constructor(
    message: string,
    readonly filePath: string,
    readonly verification: SandboxFileVerification | null = null
  ) {
    super(message);
    this.name = "StateDesyncError";
  }
}

export abstract class SandboxProvider {
  readonly capabilities: SandboxCapabilities = {
    supportsPreview: false,
    supportsShell: true,
    supportsFileHash: true,
    supportsAutomatedScreenshot: false
  };

  abstract startServer(port: number): Promise<string>;
  abstract writeFiles(files: Record<string, string>): Promise<boolean>;
  abstract runCommand(cmd: string): Promise<SandboxCommandResult>;

  async readFile(filePath: string): Promise<string> {
    const script = `const fs=require('fs');process.stdout.write(fs.readFileSync(${JSON.stringify(filePath)}, 'utf8'))`;
    const result = await this.runCommand(`node -e ${JSON.stringify(script)}`);
    if (result.code !== 0) {
      throw new StateDesyncError(`Sandbox file read failed for ${filePath}: ${result.stderr || result.stdout}`, filePath, null);
    }
    return result.stdout;
  }

  async fileExists(filePath: string): Promise<boolean> {
    const script = `const fs=require('fs');process.exit(fs.existsSync(${JSON.stringify(filePath)}) ? 0 : 1)`;
    const result = await this.runCommand(`node -e ${JSON.stringify(script)}`);
    return result.code === 0;
  }

  async verifyFile(filePath: string): Promise<SandboxFileVerification> {
    const escaped = JSON.stringify(filePath);
    const script = [
      "const fs=require('fs');",
      "const crypto=require('crypto');",
      `const p=${escaped};`,
      "if(!fs.existsSync(p)){process.stdout.write(JSON.stringify({exists:false,sizeBytes:0,sha256:null}));process.exit(0);}",
      "const b=fs.readFileSync(p);",
      "process.stdout.write(JSON.stringify({exists:true,sizeBytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')}));"
    ].join("");
    const result = await this.runCommand(`node -e ${JSON.stringify(script)}`);
    if (result.code !== 0) {
      throw new StateDesyncError(`Sandbox verification failed for ${filePath}: ${result.stderr || result.stdout}`, filePath, null);
    }
    const parsed = JSON.parse(result.stdout) as Partial<SandboxFileVerification>;
    return {
      path: filePath,
      exists: parsed.exists === true,
      sizeBytes: typeof parsed.sizeBytes === "number" ? parsed.sizeBytes : 0,
      sha256: typeof parsed.sha256 === "string" ? parsed.sha256 : null
    };
  }

  async assertFilesMaterialized(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      const verification = await this.verifyFile(filePath);
      if (!verification.exists || verification.sizeBytes <= 0) {
        throw new StateDesyncError(`Agent claimed ${filePath} was written, but the sandbox file is missing or empty.`, filePath, verification);
      }
    }
  }
}

export class LocalSandboxProvider extends SandboxProvider {
  override readonly capabilities: SandboxCapabilities = {
    supportsPreview: true,
    supportsShell: true,
    supportsFileHash: true,
    supportsAutomatedScreenshot: true
  };

  private serverProcess: ChildProcessWithoutNullStreams | null = null;
  private readonly rootDir: string;
  private readonly startupTimeoutMs: number;

  constructor(private readonly options: LocalSandboxProviderOptions) {
    super();
    this.rootDir = path.resolve(options.rootDir);
    this.startupTimeoutMs = options.startupTimeoutMs ?? 30_000;
  }

  async startServer(port: number): Promise<string> {
    const previewUrl = `http://localhost:${port}`;
    if (await isPortOpen(port)) return previewUrl;
    if (!this.options.startCommand) {
      throw new StateDesyncError(`No sandbox start command configured and port ${port} is not listening.`, ".", null);
    }

    this.serverProcess = spawn(this.options.startCommand, {
      cwd: this.rootDir,
      shell: true,
      windowsHide: true,
      stdio: "pipe"
    });

    const deadline = Date.now() + this.startupTimeoutMs;
    while (Date.now() < deadline) {
      if (await isPortOpen(port)) return previewUrl;
      await sleep(250);
    }

    const stderr = this.serverProcess.stderr.read()?.toString() ?? "";
    throw new StateDesyncError(`Sandbox server failed to start on ${previewUrl}.${stderr ? ` ${stderr}` : ""}`, ".", null);
  }

  async writeFiles(files: Record<string, string>): Promise<boolean> {
    for (const [requestedPath, content] of Object.entries(files)) {
      const resolved = this.resolveInsideRoot(requestedPath);
      await mkdir(path.dirname(resolved), { recursive: true });
      await writeFile(resolved, content, "utf8");
    }
    await this.assertFilesMaterialized(Object.keys(files));
    return true;
  }

  async runCommand(cmd: string): Promise<SandboxCommandResult> {
    try {
      const result = await execAsync(cmd, {
        cwd: this.rootDir,
        windowsHide: true,
        maxBuffer: 20 * 1024 * 1024
      });
      return { stdout: result.stdout, stderr: result.stderr, code: 0 };
    } catch (error) {
      const failure = error as { stdout?: string; stderr?: string; code?: number };
      return {
        stdout: failure.stdout ?? "",
        stderr: failure.stderr ?? (error instanceof Error ? error.message : String(error)),
        code: typeof failure.code === "number" ? failure.code : 1
      };
    }
  }

  override async readFile(filePath: string): Promise<string> {
    return readFile(this.resolveInsideRoot(filePath), "utf8");
  }

  override async fileExists(filePath: string): Promise<boolean> {
    try {
      await access(this.resolveInsideRoot(filePath));
      return true;
    } catch {
      return false;
    }
  }

  override async verifyFile(filePath: string): Promise<SandboxFileVerification> {
    const resolved = this.resolveInsideRoot(filePath);
    try {
      const info = await stat(resolved);
      if (!info.isFile()) return { path: filePath, exists: false, sizeBytes: 0, sha256: null };
      const content = await readFile(resolved);
      return {
        path: filePath,
        exists: true,
        sizeBytes: content.length,
        sha256: createHash("sha256").update(content).digest("hex")
      };
    } catch {
      return { path: filePath, exists: false, sizeBytes: 0, sha256: null };
    }
  }

  private resolveInsideRoot(requestedPath: string): string {
    const resolved = path.resolve(this.rootDir, requestedPath);
    if (resolved !== this.rootDir && !resolved.startsWith(this.rootDir + path.sep)) {
      throw new StateDesyncError(`Sandbox path escapes root: ${requestedPath}`, requestedPath, null);
    }
    return resolved;
  }
}

export interface RemoteSandboxClient {
  startServer(port: number): Promise<string>;
  writeFiles(files: Record<string, string>): Promise<boolean>;
  runCommand(cmd: string): Promise<SandboxCommandResult>;
}

export class RemoteSandboxProvider extends SandboxProvider {
  override readonly capabilities: SandboxCapabilities = {
    supportsPreview: true,
    supportsShell: true,
    supportsFileHash: true,
    supportsAutomatedScreenshot: false
  };

  constructor(private readonly client: RemoteSandboxClient) {
    super();
  }

  startServer(port: number): Promise<string> {
    return this.client.startServer(port);
  }

  async writeFiles(files: Record<string, string>): Promise<boolean> {
    const ok = await this.client.writeFiles(files);
    if (ok) await this.assertFilesMaterialized(Object.keys(files));
    return ok;
  }

  runCommand(cmd: string): Promise<SandboxCommandResult> {
    return this.client.runCommand(cmd);
  }
}

async function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(500, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
