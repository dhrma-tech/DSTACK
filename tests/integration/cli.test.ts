import { describe, expect, it } from "vitest";
import { parseArgv } from "../../packages/cli/src/parser.js";
import { route } from "../../packages/cli/src/router.js";
import { tempWorkspace } from "../helpers/temp-workspace.js";

describe("CLI", () => {
  it("prints help", async () => {
    const result = await route(await parseArgv(["--help"]));
    expect(result.stdout).toContain("DStack CLI");
  });

  it("lists skills", async () => {
    const workspace = await tempWorkspace();
    try {
      const result = await route(await parseArgv(["--list-skills"], workspace.root));
      expect(result.stdout).toContain("/office-hours");
      expect(result.stdout).toContain("/ship");
    } finally {
      await workspace.cleanup();
    }
  });
});
