# DStack Browser Automation

DStack browser skills run through the same permission and artifact model as every other skill. Browser sessions are stored under `.dstack/browser/sessions/{name}/`, screenshots under `.dstack/browser/screenshots/`, and audit artifacts under `.dstack/artifacts/`.

## Sessions

Use `/setup-browser-cookies --session default --url https://example.com` to create a named session. Cookie values are written only to the session file and are denied through `read_file`; artifacts contain only metadata such as cookie count and session file path.

`/browse`, `/scrape`, and `/pair-agent` can use named sessions when the skill supports `--session`.

## Prompt-Injection Scanning

Browser snapshots are sanitized before model context injection. The scanner redacts obvious instruction blocks such as `<INST>`, `[SYSTEM]`, `ignore previous instructions`, `you are now`, and long base64-like payloads. Redacted fragments are replaced with `[CONTENT REDACTED - POSSIBLE INJECTION]`.

## Scraping Rules

`/scrape` treats `robots.txt` as authoritative by default, skips sensitive paths such as `/checkout`, `/payment`, `/billing`, and `/admin`, and writes extracted payloads to `.dstack/scraped-data/` instead of project source files.

## Pair Agent

`/pair-agent` is checkpointed and audit-oriented. The controller caps actions, writes an audit log, and records a screenshot path for every executed step. Payment and destructive-action checks are intentionally conservative.
