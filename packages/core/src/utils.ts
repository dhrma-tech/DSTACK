import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const nowIso = (): string => new Date().toISOString();
export const fileSafeTimestamp = (date = new Date()): string => date.toISOString().replace(/[:.]/g, "-");
export const shortHash = (input: string, length = 6): string => createHash("sha256").update(input).digest("hex").slice(0, length);

export async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export async function atomicWrite(filePath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tempPath = `${filePath}.${Date.now()}.tmp`;
  await writeFile(tempPath, content, "utf8");
  await rename(tempPath, filePath);
}

export async function atomicCopy(sourcePath: string, destinationPath: string): Promise<void> {
  await ensureDir(path.dirname(destinationPath));
  const tempPath = `${destinationPath}.${Date.now()}.tmp`;
  await copyFile(sourcePath, tempPath);
  await rename(tempPath, destinationPath);
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export function resolveInsideRoot(projectRoot: string, requestedPath: string): string {
  const resolved = path.resolve(projectRoot, requestedPath);
  const root = path.resolve(projectRoot);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Path escapes project root: ${requestedPath}`);
  }
  return resolved;
}

export async function git(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync("git", args, { cwd, windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
    return { stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return { stdout: "", stderr: error instanceof Error ? error.message : String(error) };
  }
}
