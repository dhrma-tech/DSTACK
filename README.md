# DStack

DStack is a CLI-native, API-first workflow orchestration system for software product development.

## Quickstart

```bash
pnpm install
pnpm build
pnpm ds -- --list-skills
pnpm ds -- /office-hours --idea "Build a product"
```

Live model-backed runs require `GEMINI_API_KEY`. Tests use `FakeProvider` and do not call Gemini.

## Packages

- `@dstack/shared`: public contracts, schemas, and typed errors
- `@dstack/core`: config, logging, permissions, artifacts, model, tools, prompts, and skills
- `@dstack/cli`: the `ds` executable
