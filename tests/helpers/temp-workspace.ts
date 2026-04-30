import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function tempWorkspace(): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "dstack-test-"));
  return {
    root,
    cleanup: async () => {
      await rm(root, { recursive: true, force: true });
    }
  };
}
