# DStack Phase 2 Skills

Phase 2 adds 28 CLI skills on top of the 14 Phase 1 skills. All skills are available through `ds --list-skills` and run offline with `--provider=fake` or `DSTACK_PROVIDER=fake`.

## Planning And Review

- `/plan-design-review`: reviews `/autoplan` and `/plan-eng-review` from a UX, design sequencing, and accessibility perspective. Example: `ds /plan-design-review --provider=fake`.
- `/plan-devex-review`: reviews `/autoplan` for setup, onboarding, tooling, tests, CI/CD, and docs. Example: `ds /plan-devex-review --provider=fake`.
- `/plan-tune`: applies review feedback to a revised plan artifact without rewriting the whole plan from scratch. Example: `ds /plan-tune --provider=fake`.
- `/devex-review`: scores the repo itself for README, env setup, testing, debugging, and contribution flow. Example: `ds /devex-review --provider=fake`.
- `/health`: computes readiness, open gates, stale artifacts, git state, and recommendations. Example: `ds /health --provider=fake`.
- `/retro`: summarizes a completed cycle and stores learning entries. Example: `ds /retro --provider=fake`.
- `/cso`: reads the artifact chain and produces a strategic assessment with three top risks. Example: `ds /cso --provider=fake`.

## Design

- `/design-shotgun`: generates three distinct design variants for a screen or feature. Example: `ds /design-shotgun --screen "Dashboard" --provider=fake`.
- `/design-html`: renders a self-contained HTML prototype under `.dstack/design-prototypes/`. Example: `ds /design-html --screen "Dashboard" --provider=fake`.
- `/landing-report`: analyzes a landing page URL with desktop/mobile screenshots and recommendations. Example: `ds /landing-report --url http://localhost:3000 --provider=fake`.

## Deployment

- `/setup-deploy`: writes `.dstack/deploy.json` with deploy, dry-run, canary, health check, rollback, and env-var metadata. Example: `ds /setup-deploy --command "echo deploy" --provider=fake`.
- `/canary`: records a canary deploy recommendation. Example: `ds /canary --provider=fake`.
- `/land-and-deploy`: runs the configured deploy after `/ship` and `/qa` pass and no freeze is active. Example: `ds /land-and-deploy --env staging --provider=fake`.
- `/freeze`: blocks deploy operations. Example: `ds /freeze --reason "release window" --provider=fake`.
- `/unfreeze`: lifts a deploy freeze. Example: `ds /unfreeze --provider=fake`.
- `/dstack-upgrade`: produces an upgrade plan and migration summary. Example: `ds /dstack-upgrade --provider=fake`.

## Browser And Data

- `/setup-browser-cookies`: stores cookies in a named session file without writing cookie values to artifacts. Example: `ds /setup-browser-cookies --url http://localhost:3000 --session default --provider=fake`.
- `/scrape`: extracts structured data metadata into a separate data file. Example: `ds /scrape --url http://localhost:3000 --fields title,summary --provider=fake`.
- `/pair-agent`: runs a capped, checkpointed browser task with screenshot/audit metadata. Example: `ds /pair-agent --task "Check homepage" --provider=fake`.

## Memory, Benchmarking, And Utilities

- `/learn`: stores a manual learning entry. Example: `ds /learn --topic qa --insight "Keep blockers explicit" --provider=fake`.
- `/setup-memory`: initializes or updates project memory and can import retro learnings. Example: `ds /setup-memory --import-retro --provider=fake`.
- `/benchmark`: runs a benchmark suite from `.dstack/benchmarks/{suite}.yaml`, falling back to a default offline suite if missing. Example: `ds /benchmark --suite default --provider=fake`.
- `/benchmark-models`: compares models on a suite. Example: `ds /benchmark-models --suite default --models gemini-2.5-pro,gemini-2.0-flash --provider=fake`.
- `/skillify`: writes draft skill files to `.dstack/generated-skills/` only. Example: `ds /skillify --name release-note --description "Draft release notes" --provider=fake`.
- `/guard`: activates GUARD mode. Example: `ds /guard --provider=fake`.
- `/careful`: activates CAREFUL mode. Example: `ds /careful --provider=fake`.
- `/make-pdf`: exports artifact reports to `.dstack/exports/`. Example: `ds /make-pdf --artifact ship --provider=fake`.
- `/codex`: formats an artifact as a Codex CLI task prompt and handles Codex-not-installed gracefully. Example: `ds /codex --artifact autoplan --provider=fake`.
