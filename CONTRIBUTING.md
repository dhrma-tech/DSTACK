# Contributing to DStack

Thanks for helping make DStack sturdier.

## Local Checks

Run these before opening a PR:

```bash
pnpm skill:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Adding a Skill

1. Create `packages/core/src/skills/definitions/{skill-name}/`.
2. Add `manifest.yaml`, `handler.ts`, and `prompt.md`.
3. Keep the manifest compatible with `skillManifestSchema`.
4. Route model-backed skills through the existing `SkillExecutor`; do not call providers directly.
5. Route all tools through `ToolExecutor`; do not call shell, browser, git, or file helpers directly from a skill.
6. Add FakeProvider-safe behavior and tests.
7. Run `pnpm skill:check`.

Use `/skillify --name your-skill --description "..." --provider=fake` to draft a starting point. Generated skills stay in `.dstack/generated-skills/` until a human reviews and moves them into `packages/core/src/skills/definitions/`.

## Safety Boundaries

Generated skills are not auto-installed. Browser cookie files are not readable through DStack tools. Deploy and shell operations must respect `PermissionGate`, `GUARD`, `CAREFUL`, and deploy freeze state.
