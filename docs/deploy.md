# DStack Deploy Guide

Phase 2 deploy support is controlled by `.dstack/deploy.json` and `.dstack/deploy-state.json`.

## Setup

```bash
ds /setup-deploy --command "echo deploy" --provider=fake
```

This writes deploy metadata:

- platform and environment
- deploy command
- dry-run command
- optional canary command
- optional health check URL
- optional rollback command
- required environment variable names only

Environment variable values are never stored.

## Freeze Control

```bash
ds /freeze --reason "release window" --provider=fake
ds /unfreeze --provider=fake
```

When frozen, `/land-and-deploy` refuses to execute and records the freeze blocker.

## Canary And Deploy

```bash
ds /canary --provider=fake
ds /land-and-deploy --env staging --provider=fake
```

`/land-and-deploy` requires:

- `/ship` artifact present and passing
- `/qa` artifact present and passing
- deploy config present
- no active freeze

Production deploys are blocked without explicit interactive approval.
