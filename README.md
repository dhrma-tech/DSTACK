# DStack

DStack is a CLI-native, API-first workflow orchestration system for software product development.

## Quickstart

```bash
pnpm install
pnpm build
pnpm ds -- --list-skills
DSTACK_PROVIDER=fake pnpm ds -- /office-hours --idea "Build a product"
```

The quickstart uses offline fake mode so a fresh clone works without an API key. Live Gemini-backed runs require `GEMINI_API_KEY`.

## Offline Development Mode

DStack can run the Phase 1 workflow without a Gemini API key by selecting the fake provider:

```bash
pnpm ds -- /office-hours --provider=fake --idea "Dogfood DStack"
pnpm ds -- /autoplan --provider=fake
pnpm ds -- /plan-ceo-review --provider=fake
pnpm ds -- /plan-eng-review --provider=fake
pnpm ds -- /design-consultation --provider=fake
pnpm ds -- /design-review --provider=fake
pnpm ds -- /review --provider=fake
pnpm ds -- /qa --provider=fake
pnpm ds -- /ship --provider=fake
```

You can also set `DSTACK_PROVIDER=fake` once and omit the flag. Fake-provider artifacts are deterministic, schema-valid, and include `generated_by: "fake-provider"` so they are easy to distinguish from live Gemini output. This mode is for local development and dogfooding only; Gemini remains the live provider path.

## Gemini Setup

To use Gemini instead of fake mode, set a Gemini API key and choose the Gemini provider:

```bash
export GEMINI_API_KEY="your-key"
export DSTACK_PROVIDER="gemini"
pnpm ds -- /office-hours --idea "Build a product"
```

You can also pass `--provider=gemini` per command. Tests use `FakeProvider` and do not call Gemini.

## Packages

- `@dstack/shared`: public contracts, schemas, and typed errors
- `@dstack/core`: config, logging, permissions, artifacts, model, tools, prompts, and skills
- `@dstack/cli`: the `ds` executable
