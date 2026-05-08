import path from "node:path";
import { Router, type Express, type Request, type Response } from "express";
import { LocalSandboxProvider, StateDesyncError } from "@dstack/core";

interface SandboxFilesBody {
  files?: unknown;
}

interface SandboxCommandBody {
  command?: unknown;
}

function sandboxRoot(): string {
  const projectRoot = process.cwd().endsWith("server") ? path.resolve(process.cwd(), "../../") : process.cwd();
  return path.join(projectRoot, ".dstack", "api-sandbox");
}

export const sandboxRouter = Router();

export const attachSandboxRoutes = (app: Express): void => {
  app.post("/api/sandbox/files", async (req: Request<unknown, unknown, SandboxFilesBody>, res: Response) => {
    const files = parseFiles(req.body.files);
    if (!files) {
      res.status(400).json({ error: "files must be an object of path-to-content strings" });
      return;
    }
    const provider = new LocalSandboxProvider({ rootDir: sandboxRoot() });
    try {
      await provider.writeFiles(files);
      const verifications = await Promise.all(Object.keys(files).map((filePath) => provider.verifyFile(filePath)));
      res.json({ ok: true, verifications });
    } catch (error) {
      if (error instanceof StateDesyncError) {
        res.status(409).json({ error: error.message, filePath: error.filePath, verification: error.verification });
        return;
      }
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/sandbox/commands", async (req: Request<unknown, unknown, SandboxCommandBody>, res: Response) => {
    if (typeof req.body.command !== "string" || !req.body.command.trim()) {
      res.status(400).json({ error: "command is required" });
      return;
    }
    const provider = new LocalSandboxProvider({ rootDir: sandboxRoot() });
    const result = await provider.runCommand(req.body.command);
    res.json(result);
  });
};

function parseFiles(value: unknown): Record<string, string> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const files: Record<string, string> = {};
  for (const [filePath, content] of Object.entries(value)) {
    if (typeof content !== "string") return null;
    files[filePath] = content;
  }
  return files;
}
