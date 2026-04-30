import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { JsonObject } from "@dstack/shared";

const execFileAsync = promisify(execFile);

export interface CodexIntegrationOptions {
  projectRoot: string;
}

export interface CodexTaskRequest {
  sourceArtifact: string;
  taskId: string | null;
}

export interface CodexIntegrationResult extends JsonObject {
  sourceArtifact: string;
  taskExtracted: string;
  codexPrompt: string;
  codexCommand: string;
  codexOutput: string;
  codexExitCode: number;
  codexVerdict: "SUCCESS" | "FAIL" | "NOT_INSTALLED";
  filesModified: string[];
  warnings: string[];
}

export class CodexIntegration {
  constructor(private readonly options: CodexIntegrationOptions) {}

  async isInstalled(): Promise<boolean> {
    const result = await execFileAsync("codex", ["--version"], { cwd: this.options.projectRoot, windowsHide: true }).then(() => true).catch(() => false);
    return result;
  }

  formatPrompt(sourceArtifact: string, artifact: JsonObject, taskId: string | null): string {
    return [`Implement the DStack task from /${sourceArtifact}.`, taskId ? `Focus task: ${taskId}.` : "Pick the most actionable scoped task.", JSON.stringify(artifact, null, 2)].join("\n\n");
  }
}
