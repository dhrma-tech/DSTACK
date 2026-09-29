import fs from 'node:fs';
import path from 'node:path';

// Single source of truth for which project this server operates on.
// Order: explicit setProjectRoot() > DSTACK_PROJECT_ROOT > nearest pnpm workspace root > cwd.
let projectRoot: string | null = null;

function resolveDefaultRoot(): string {
  const fromEnv = process.env.DSTACK_PROJECT_ROOT;
  if (fromEnv) return path.resolve(fromEnv);
  let current = process.cwd();
  while (current !== path.parse(current).root) {
    if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) return current;
    current = path.dirname(current);
  }
  return process.cwd();
}

export function setProjectRoot(root: string): void {
  projectRoot = path.resolve(root);
}

export function getProjectRoot(): string {
  projectRoot ??= resolveDefaultRoot();
  return projectRoot;
}

export function getDstackDir(): string {
  return path.join(getProjectRoot(), '.dstack');
}

export function serviceOptions(): { projectRoot: string } {
  return { projectRoot: getProjectRoot() };
}
