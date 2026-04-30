# DSTACK.md

Project routing hints for contributors and DStack skill runs.

## Project Context

- Project: DStack
- Goal: local, artifact-driven workflow orchestration for planning, review, QA, safety, memory, deployment, and release readiness.
- Default local path: use `DSTACK_PROVIDER=fake` for offline development and tests.

## Skill Routing

- New product or feature idea: `/office-hours` then `/autoplan`.
- Plan review: `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/plan-devex-review`.
- Apply review feedback: `/plan-tune`.
- Design exploration: `/design-consultation`, `/design-shotgun`, `/design-html`, `/design-review`.
- Implementation review: `/review` then `/qa`.
- Release readiness: `/ship` then `/health`.
- Deployment: `/setup-deploy`, `/canary`, `/land-and-deploy`.
- Browser work: `/browse`, `/setup-browser-cookies`, `/scrape`, `/pair-agent`, `/landing-report`.
- Memory: `/learn`, `/retro`, `/setup-memory --import-retro`, `/context-save`.

## Safety

- `/guard` enables read-only mode for write and execute tools.
- `/careful` forces approval for every tool call.
- `/freeze` blocks deploy operations until `/unfreeze`.
- Browser snapshots are prompt-injection scanned before model context injection.
