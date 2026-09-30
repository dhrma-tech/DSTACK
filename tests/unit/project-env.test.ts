import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadProjectEnv } from "@dstack/core";

const KEYS = ["DSTACK_ENV_TEST_FROM_FILE", "DSTACK_ENV_TEST_SHELL_WINS"];

afterEach(() => {
  for (const key of KEYS) delete process.env[key];
});

describe("loadProjectEnv", () => {
  it("loads .env from the project root without overriding existing variables", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "dstack-env-"));
    try {
      await writeFile(path.join(root, ".env"), "DSTACK_ENV_TEST_FROM_FILE=from-file\nDSTACK_ENV_TEST_SHELL_WINS=from-file\n");
      process.env.DSTACK_ENV_TEST_SHELL_WINS = "from-shell";
      expect(loadProjectEnv(root)).toBe(true);
      expect(process.env.DSTACK_ENV_TEST_FROM_FILE).toBe("from-file");
      expect(process.env.DSTACK_ENV_TEST_SHELL_WINS).toBe("from-shell");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does nothing when there is no .env", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "dstack-env-"));
    try {
      expect(loadProjectEnv(root)).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
