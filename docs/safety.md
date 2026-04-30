# DStack Safety Model

DStack routes tool calls through `PermissionGate` before execution. Phase 2 adds persisted safety modes in `.dstack/safety-mode.json`.

## Modes

- `NORMAL`: standard rules apply. Safe read tools and known local commands can run, destructive patterns are denied, and risky writes/execs require approval.
- `CAREFUL`: every tool call requires explicit approval, including commands normally allowed in `NORMAL`.
- `GUARD`: write and execute tool calls are denied. Read tools remain allowed.

Activate modes:

```bash
ds /careful --provider=fake
ds /guard --provider=fake
```

## Shell And Git Rules

The gate denies destructive shell patterns such as `rm -rf`, `sudo`, shell-piped installers, `eval`, `mkfs`, `xargs`, and `bash -c`/`sh -c`. Git write operations such as `git push`, `git rebase`, `git merge`, and `git tag` require approval.

## Browser And Data Rules

Non-local browser navigation requires approval. Scraping skips sensitive paths such as `/checkout`, `/payment`, `/billing`, and `/admin` unless an explicit sensitive-path override is added in a future interactive approval flow. Cookie values are stored only in session files, never in artifacts or stdout.
