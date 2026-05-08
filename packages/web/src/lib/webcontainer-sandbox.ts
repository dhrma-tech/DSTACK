'use client';

import type { WebContainer, WebContainerProcess } from '@webcontainer/api';

export interface WebContainerCommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

export interface WebContainerFileVerification {
  path: string;
  exists: boolean;
  sizeBytes: number;
  sha256: string | null;
}

export interface WebContainerCapabilities {
  supportsPreview: true;
  supportsShell: true;
  supportsFileHash: true;
  supportsAutomatedScreenshot: false;
}

export class WebContainerSandboxProvider {
  readonly capabilities: WebContainerCapabilities = {
    supportsPreview: true,
    supportsShell: true,
    supportsFileHash: true,
    supportsAutomatedScreenshot: false
  };

  private container: WebContainer | null = null;
  private previewUrl: string | null = null;

  async boot(): Promise<WebContainer> {
    if (this.container) return this.container;
    const { WebContainer } = await import('@webcontainer/api');
    this.container = await WebContainer.boot();
    this.container.on('server-ready', (_port, url) => {
      this.previewUrl = url;
    });
    return this.container;
  }

  async writeFiles(files: Record<string, string>): Promise<boolean> {
    const container = await this.boot();
    for (const [filePath, content] of Object.entries(files)) {
      await container.fs.mkdir(parentDir(filePath), { recursive: true });
      await container.fs.writeFile(filePath, content);
    }
    await Promise.all(Object.keys(files).map((filePath) => this.verifyFile(filePath)));
    return true;
  }

  async runCommand(command: string): Promise<WebContainerCommandResult> {
    const container = await this.boot();
    const [cmd, ...args] = splitCommand(command);
    if (!cmd) return { stdout: '', stderr: 'No command provided.', code: 1 };
    const process = await container.spawn(cmd, args);
    return collectProcess(process);
  }

  async startServer(port: number): Promise<string> {
    if (this.previewUrl) return this.previewUrl;
    await this.runCommand('npm install');
    void this.runCommand('npm run dev');
    const deadline = Date.now() + 30_000;
    while (!this.previewUrl && Date.now() < deadline) {
      await sleep(250);
    }
    return this.previewUrl ?? `http://localhost:${port}`;
  }

  async verifyFile(filePath: string): Promise<WebContainerFileVerification> {
    const container = await this.boot();
    try {
      const content = await container.fs.readFile(filePath, 'utf-8');
      return {
        path: filePath,
        exists: true,
        sizeBytes: new TextEncoder().encode(content).byteLength,
        sha256: await sha256(content)
      };
    } catch {
      return { path: filePath, exists: false, sizeBytes: 0, sha256: null };
    }
  }
}

function parentDir(filePath: string): string {
  const parts = filePath.split('/').filter(Boolean);
  parts.pop();
  return parts.length > 0 ? parts.join('/') : '.';
}

function splitCommand(command: string): string[] {
  return command.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((part) => part.replace(/^"|"$/g, '')) ?? [];
}

async function collectProcess(process: WebContainerProcess): Promise<WebContainerCommandResult> {
  let stdout = '';
  let stderr = '';
  process.output.pipeTo(new WritableStream<string>({
    write(chunk) {
      stdout += chunk;
    }
  })).catch((error: unknown) => {
    stderr += error instanceof Error ? error.message : String(error);
  });
  const code = await process.exit;
  return { stdout, stderr, code };
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
