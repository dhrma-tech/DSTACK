import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ArtifactStore } from "@dstack/core";
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

  it("prints the skill health dashboard", async () => {
    const workspace = await tempWorkspace();
    try {
      const result = await route(await parseArgv(["--skill-check"], workspace.root));
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("DStack Skill Check");
      expect(result.stdout).toContain("Total skills: 42");
      expect(result.stdout).toContain("Manifest validation: 42/42 loaded");
      expect(result.stdout).toContain("Phase 2 central shim skills:");
    } finally {
      await workspace.cleanup();
    }
  });

  it("parses explicit fake provider selection", async () => {
    const parsed = await parseArgv(["/office-hours", "--provider", "fake"]);
    expect(parsed.invocation?.flags.provider).toBe("fake");
  });

  it("runs the primary Phase 1 workflow offline with --provider=fake", async () => {
    const workspace = await tempWorkspace();
    vi.stubEnv("GEMINI_API_KEY", "");
    try {
      const commands = [
        ["/office-hours", "--provider", "fake", "--idea", "Dogfood DStack offline"],
        ["/autoplan", "--provider", "fake"],
        ["/plan-ceo-review", "--provider", "fake"],
        ["/plan-eng-review", "--provider", "fake"],
        ["/design-consultation", "--provider", "fake"],
        ["/design-review", "--provider", "fake"],
        ["/review", "--provider", "fake"],
        ["/qa", "--provider", "fake"],
        ["/ship", "--provider", "fake"],
        ["/context-save", "--provider", "fake", "--name", "offline"],
        ["/context-restore", "--provider", "fake", "--name", "offline"],
        ["/qa-only", "--provider", "fake"],
        ["/investigate", "--provider", "fake", "--issue", "offline investigation"],
        ["/browse", "--provider", "fake", "--url", "http://localhost:3000"]
      ];
      for (const command of commands) {
        const result = await route(await parseArgv(command, workspace.root));
        expect(result.exitCode, command.join(" ")).toBe(0);
        expect(result.stdout, command.join(" ")).toContain("Provider: fake");
        expect(result.stdout, command.join(" ")).toContain("Artifact:");
        expect(result.stdout, command.join(" ")).not.toContain("Artifact JSON:");
      }
      const artifacts = new ArtifactStore(path.join(workspace.root, ".dstack"));
      for (const skillName of ["office-hours", "autoplan", "plan-ceo-review", "plan-eng-review", "design-consultation", "design-review", "review", "qa", "ship", "context-save", "context-restore", "qa-only", "investigate", "browse"]) {
        const artifact = await artifacts.readLatest(skillName);
        expect(artifact?.content.generated_by, skillName).toBe("fake-provider");
      }
    } finally {
      vi.unstubAllEnvs();
      await workspace.cleanup();
    }
  }, 30000);

  it("prints full artifact JSON only with --json or --verbose", async () => {
    const workspace = await tempWorkspace();
    vi.stubEnv("GEMINI_API_KEY", "");
    try {
      const concise = await route(await parseArgv(["/office-hours", "--provider", "fake", "--idea", "Concise output"], workspace.root));
      expect(concise.stdout).toContain("Provider: fake");
      expect(concise.stdout).not.toContain("Artifact JSON:");
      expect(concise.stdout).not.toContain("projectName");

      const verbose = await route(await parseArgv(["/office-hours", "--provider", "fake", "--json", "--idea", "Verbose output"], workspace.root));
      expect(verbose.stdout).toContain("Artifact JSON:");
      expect(verbose.stdout).toContain("projectName");

      const verboseFlag = await route(await parseArgv(["/office-hours", "--provider", "fake", "--verbose", "--idea", "Verbose flag output"], workspace.root));
      expect(verboseFlag.stdout).toContain("Artifact JSON:");
      expect(verboseFlag.stdout).toContain("projectName");
    } finally {
      vi.unstubAllEnvs();
      await workspace.cleanup();
    }
  });
});
