# DStack Implementation Plan

Created 2026-09-29. Source: the product audit report (https://claude.ai/artifact/XQWqbZ92NVVcmsLpxYKeEk).
Starting point: branch `fix/real-skill-runs-and-test-fixes` (389/395 tests passing, lint red).

Work is split into four phases. Each phase ends with a green gate: `pnpm build`, `pnpm typecheck`,
`pnpm lint`, `pnpm test` and `pnpm skill:check` all exit 0. Each task below lists files, steps,
acceptance criteria and the tests it needs (CLAUDE.md §17: every bug fix gets a regression test).

Effort key: S = under a day, M = 1–3 days, L = 4+ days.

---

## Phase 0 — Prerequisites (S)

| # | Task | Details |
|---|---|---|
| 0.1 | Merge the open fix branch | Open the PR for `fix/real-skill-runs-and-test-fixes` (real skill execution in `RunService`, path-leak fix, gate messages). |
| 0.2 | Decide the frontend-safe test regex | `tests/integration/ui-seed-fake-mode.test.ts` flags field names like `maxTokens`, `allowSecrets`, `tokenFileRelative`. **Owner decision needed.** Recommended: keep the regex strict and instead check *values*: walk the JSON and fail if any string value looks like a key (`AIza…`, long base64/hex) or an absolute path. Field names stay allowed. |
| 0.3 | Fix the `--serve --json` CLI test timeout | `tests/unit/cli-json-output.test.ts`. Make `--serve --json` print its envelope as soon as the server is listening, and make the test close the server. |
| 0.4 | Make typecheck self-sufficient | Root `typecheck` script: `pnpm --filter @dstack/shared build && pnpm -r typecheck`, or switch packages to TS project references. |

**Gate:** 395/395 tests pass.

---

## Phase 1 — Stabilize (≈1 week)

### 1.1 One backend: Express wraps the core services (L)

**Problem.** The web app calls the Express server (`packages/server`, `/api/*`). A second HTTP server
in `packages/core/src/api` serves `/v1/*` with auth, redaction and error envelopes, and most
integration tests target it. Each has endpoints the other lacks.

**Decision.** Keep Express as the only HTTP server (the web app, SSE runners and sandbox already
live there). Move reusable pieces out of `core/src/api` and delete the core HTTP server.

Steps:
1. Keep in core, framework-free: `services/*` (already the business layer), `api/auth.ts`,
   `api/redaction.ts`, `api/errors.ts`, `api/security.ts`. Move them to `core/src/http/` and export
   them from `@dstack/core`.
2. In `packages/server/src`, add `lib/context.ts` that builds one `ProjectContext`
   (projectRoot, dstackDir, service instances) at startup. Replace the per-route
   `findProjectRoot()` copies (for example in `routes/learnings.ts`) with it.
3. Add `lib/respond.ts`: `ok(res, data)` / `fail(res, err)` using core's error mapping and
   redaction, so every route returns the same shape (`{ error, code }` on failure, CLAUDE.md §14).
4. Port `/v1` integration tests (`api-routes`, `api-server`, `api-contracts`, `ui-seed-fake-mode`)
   to hit the Express app via `supertest`, using the `/api/*` paths from CLAUDE.md §14.
5. Delete `core/src/api/server.ts`, `router.ts`, `routes/*` and the CLI `--serve` flag (or point
   `--serve` at the Express app).

Acceptance: one server on port 3001; all ported tests green; `core/src/api/router.ts` (461 lines) gone.

### 1.2 Add the missing routes (M)

Each route is a thin wrapper around an existing core service. New files in `packages/server/src/routes/`:

| Route | Backed by | File |
|---|---|---|
| `GET /api/deploy/config` | `DeployService.getDeployConfig()` (returns `null` if absent) | `deploy.ts` |
| `GET /api/deploy/state` | `DeployService.getFreezeState()` | `deploy.ts` |
| `POST /api/deploy/freeze`, `/unfreeze` | `DeployManager.freeze/unfreeze` | `deploy.ts` |
| `GET /api/deploy/runs` | `DeployService.getDeployRuns()` | `deploy.ts` |
| `GET /api/safety`, `POST /api/safety/mode` | `SafetyModeManager.read/setMode`; validate mode is `NORMAL \| CAREFUL \| GUARD` | `safety.ts` |
| `GET /api/settings`, `PUT /api/settings` | `SettingsService`; key always masked; PUT never accepts an API key | `settings.ts` |
| `GET /api/benchmarks`, `/api/benchmarks/:runId` | `BenchmarkService` | `benchmarks.ts` |
| `GET /api/browser/sessions` | `BrowserService.getBrowserSessions()` — names only, never files | `browser.ts` |
| `GET /api/browser/screenshots`, `/:filename` | list `.dstack/browser/screenshots`; serve PNG; reject `..`, `/`, `\` in filename; 404 anything under `sessions/` | `browser.ts` |
| `GET /api/runs/:runId` | `RunService.getSkillRun()` merged with `.dstack/runs/{id}.json` event log | `runs.ts` |
| `POST /api/runs/:runId/stop` | new `SkillRunner.stopRun(runId)`: `child.kill('SIGTERM')`, SIGKILL after 5s, emit `{type:'error', code:'STOPPED'}`, mark run `interrupted` | `runs.ts`, `stream/skill-runner.ts` |

Also remove the stray "But wait…" design comments in `routes/runs.ts` and move the skill-run POST into `skills.ts`.

Tests: one `supertest` file per router in `tests/integration/server/`. Include a
path-traversal test for screenshots, a "sessions are 404" test, a masked-key test for settings,
and a stop test that spawns a fake long run and checks it ends `interrupted`.

Acceptance: every function in `packages/web/src/lib/api.ts` has a matching route (add a contract test
that imports the path list and checks each against the Express router stack).

### 1.3 Authenticate the server (M)

The server can run skills and `POST /api/sandbox/commands`. CORS only restricts browsers.

1. On startup, create `.dstack/api/token` (32 random bytes, file mode 0600) if missing. Reuse core `ApiAuth`.
2. Middleware on all `/api/*` routes except `GET /health`: require `Authorization: Bearer <token>`,
   compared with `crypto.timingSafeEqual`.
3. **SSE can't send headers.** Add `POST /api/stream-tickets` → `{ ticket }` (single use, 60s TTL,
   bound to the path). `EventSource` URLs carry `?ticket=`. Tickets never appear in logs.
4. The web app gets the token from a Next.js server-side route (`app/api/token/route.ts`) that reads the
   file, so it never ships in the JS bundle. `apiFetch` adds the header; `streamRun` fetches a ticket first.
5. Bind to `127.0.0.1` by default (`API_HOST` env to override). Check the `Host` header against
   `localhost|127.0.0.1` to block DNS rebinding.
6. Rate-limit `POST /api/sandbox/commands` and `/api/skills/:name/run` (for example 30/min).

Tests: 401 without token, 401 with wrong token, 200 with token; ticket reuse rejected; expired ticket
rejected; foreign `Host` rejected.

### 1.4 Fix learnings search (S)

- `packages/web/src/lib/api.ts:388`: send `?q=${encodeURIComponent(query)}` when a query is given.
- `packages/server/src/routes/learnings.ts`: read `req.query.q` and call `LearningStore.search(q)`.
- Regression test: two learnings, search matches one, response has one.

### 1.5 Lint green (S–M)

1. `packages/web/eslint.config.mjs`: add `eslint-plugin-react-hooks` (v5+ for `set-state-in-effect`)
   or remove the rule references. Make sure the root `eslint.config.js` doesn't lint `packages/web`
   with a config lacking the plugin.
2. Replace every `any` (≈15) with real types from `@dstack/shared`, or `unknown` plus narrowing.
3. Fix the `import type` errors (auto-fixable) and unused variables.
4. Add `pnpm lint` to CI so it stays green.

**Phase 1 gate:** all web pages load real data against a fresh `.dstack/` in fake mode; all checks green.

---

## Phase 2 — Clean up (≈1–2 weeks)

### 2.1 Remove dead login, make onboarding real (M)

- Delete `app/login/page.tsx` and the `/signup` link. DStack is a local tool and the server token
  (1.3) is the auth. Remove `href="#"` Privacy/Terms links.
- Onboarding writes real state:
  - Step "Connect a provider": choose `fake` or `gemini`. For Gemini, the key goes into `.env` via a new
    `POST /api/settings/provider-key` that writes the file server-side and returns only the masked key.
    Validate the key with one cheap Gemini call, and show "valid" or the error.
  - Step "Project scope": write the idea to `.dstack/memory.json` via the existing `MemoryStore`.
  - Final step: button "Run /office-hours" that starts a real run.
- Add `onboardedAt` to settings. `/` redirects to `/onboarding` until it's set, then to `/workspace`.

### 2.2 Remove mock data (S)

- Move the types still imported from `lib/mock-data.ts` (`SkillRun`, etc.) into
  `packages/shared/src/contracts.ts` or use existing contract types.
- Update `app/(app)/runs/page.tsx`, `components/CommandPalette.tsx`, `lib/app-context.tsx`.
- Delete `lib/mock-data.ts`. Add an ESLint `no-restricted-imports` rule banning `mock-data`.

### 2.3 UI primitives and inline-style removal (L)

1,000+ inline `style={{}}` objects. Do it incrementally, page by page.

1. Map the CLAUDE.md §15 tokens into Tailwind v4 `@theme` in `globals.css` (`--color-canvas`, `--color-coral`, …, font families).
2. Create `components/ui/`: `Page`, `PageHeader` (one title size: Newsreader 28px), `Card`,
   `Button` (primary/secondary/ghost/danger), `Badge` (the six variants from §15; merge `StatusBadge` into it),
   `Table`, `Tabs`, `Skeleton`, `EmptyState`, `ErrorState`, `IconButton` (requires `aria-label` in its type).
3. Convert pages in order of traffic: workspace → dashboard → skills → artifacts → runs → the rest.
4. Delete the "backward-compat aliases" block in `globals.css` once nothing uses it.
5. Add a lint rule (`react/forbid-dom-props` for `style`) as a warning, becoming an error once the count reaches 0.

### 2.4 Loading, empty and error states (M)

- Add a `useApi(fn)` hook returning `{ data, error, loading, retry }`. All pages use it.
- Loading: `Skeleton` rows matching the final layout.
- Empty: name the next skill ("No plan yet. Run /autoplan to create one." with a Run button).
- Error: show which call failed and how to fix it (for example "Can't reach the DStack server on
  port 3001. Start it with `pnpm server`."), plus Retry.
- A global banner when `/health` fails.

### 2.5 Accessibility baseline (M)

- Visible coral focus ring on everything (`:focus-visible`).
- `aria-label` on all icon-only buttons (enforced by `IconButton`'s type).
- `aria-live="polite"` region in `EventThread` announcing tool calls and completion.
- `ApprovalGateCard`: `role="alertdialog"`, focus moves to it, Y/N hotkeys, focus returns afterward.
- Command palette: combobox pattern with arrow keys and `aria-activedescendant`.
- Respect `prefers-reduced-motion` in framer-motion (`useReducedMotion`).
- Add `@axe-core/playwright` smoke tests for the 5 main pages (zero serious violations).

### 2.6 Split oversized files (M)

| File | Lines | Split into |
|---|---|---|
| `core/src/phase2-real-handlers.ts` | 1878 | one module per domain: `handlers/safety.ts`, `deploy.ts`, `design.ts`, `browser.ts`, `memory.ts`, `benchmark.ts`, `utilities.ts` |
| `shared/src/contracts.ts` | 684 | `contracts/{skills,runs,artifacts,deploy,settings,workflow}.ts` + index |
| `core/src/workflow/graph.ts` | 559 | graph build / staleness / serialization |
| `core/src/phase2-skills.ts` | 556 | by domain, like the handlers |
| `web/src/lib/api.ts` | 435 | `lib/api/{client,runs,artifacts,deploy,…}.ts` |

Pure moves, no behavior change; tests must pass unchanged.

### 2.7 Housekeeping (S)

- Add `tests/fixtures/artifacts/{skill}-golden.json` for all 42 skills; one parametrized test validates each against its Zod schema.
- Fill in the 10 `skill:check` behavior-field warnings.
- Rewrite CLAUDE.md §§3, 4, 16 from a fresh bug audit. Add `API_PORT`, `API_HOST`, `NEXT_PUBLIC_API_URL` to `.env.example`.

**Phase 2 gate:** zero inline styles on converted pages, zero serious axe violations, no mock-data imports, all checks green.

---

## Phase 3 — Strengthen the loop (≈3–4 weeks)

Design work (dark mode, workspace) is folded in here because it touches the same components.

| # | Feature | Implementation notes | Effort |
|---|---|---|---|
| 3.1 | **Gate timeline** | Topbar pipeline from `GET /api/workflow/graph`. Each node: verdict `Badge`, age, stale chip from `StalenessDetector` (fix the depth-1 BFS bug first). Click → popover with the blocking reason. | M |
| 3.2 | **Structured artifact views** | `components/artifacts/renderers/{autoplan,review,qa,…}.tsx` keyed by skillName, typed by the Zod schemas; fallback to `JsonViewer`. Long-form layout: Newsreader headings, 68ch column, sticky outline. | M |
| 3.3 | **Artifact diff + summary** | Existing `/api/artifacts/:skill/diff` plus a field-level side-by-side view. Summary generated deterministically from the diff (verdict change, added/removed findings), with no model call. | M |
| 3.4 | **"Why blocked?"** | Gate errors return a structured `{ code:'GATE_BLOCKED', requires, failingFindings[] }` instead of a string. `SkillCompleteCard` renders findings with an "Investigate" button per finding (starts `/investigate` with the finding as input). | S |
| 3.5 | **Cost and token meter** | Providers report `usage` per call. Emit a new `usage` ShellEvent. Price with `shared/constants/pricing.ts`. Show live in status bar; totals per skill on the dashboard; optional `budgetUsdMonthly` in settings that blocks runs over budget (overridable with `--force`). | S |
| 3.6 | **Approval policies** | "Allow for this run" / "Allow pattern for this session" options on `ApprovalGateCard`. Stored in memory for the run; never overrides DENY or GUARD mode. **Fix the CAREFUL-mode bypass in `permissions` first** (CLAUDE.md §4). Every auto-approval is logged. | M |
| 3.7 | **Guided fake-mode demo** | "Try the demo" on onboarding: creates `~/.dstack-demo` project and runs a chain `/office-hours → /autoplan → /review → /qa → /ship` with `DSTACK_PROVIDER=fake` via the existing chain runner. | S |
| 3.8 | **Dark mode** | Dark values for every token under `prefers-color-scheme` and `[data-theme="dark"]`, built from the existing `--surface-dark*` and `--on-dark*`. Toggle in status bar (localStorage). Check Badge contrast in both themes. | M |
| 3.9 | **Workspace upgrades** | Resizable, collapsible rails (widths remembered). Auto-scroll that pauses when the user scrolls up and shows a "Jump to latest" button. Tool-call cards grouped per step, collapsed after completion. Below 1024px: left rail becomes a drawer, right rail a bottom sheet. | M |

**Phase 3 gate:** full fake-mode chain from onboarding to a passing `/ship`, visible end to end in the UI (Playwright test).

---

## Phase 4 — Expand (ongoing)

Ordered by impact. Each starts with a short design note in `docs/` before code.

| # | Feature | Notes | Effort |
|---|---|---|---|
| 4.1 | Multiple model providers | `ClaudeProvider`, `OpenAIProvider` implementing the existing `Provider` interface; per-skill model in `config.yaml`; pricing entries. Makes `/benchmark-models` meaningful. | M |
| 4.2 | GitHub PR integration | GitHub App or token; post `/review` and `/qa` as PR comments plus a `dstack/qa` status check; `/ship` refuses if the check isn't green. | L |
| 4.3 | Notifications | Desktop (Notification API), Slack webhook, email. Triggers: run complete, approval needed, canary failed. Settings page section. | S |
| 4.4 | Shareable run reports | Static HTML export of a run or artifact via existing `PDFGenerator` templates; passes through `redaction.ts`. | M |
| 4.5 | Health score over time | Store per-cycle metrics from `/retro` and `/health`; Recharts trend on dashboard. | M |
| 4.6 | Learnings that visibly apply | `PromptTemplateEngine` records which learning IDs were injected; run event `learnings-used`; chip on the run; per-learning success rate. | S |
| 4.7 | Run replay | Replay `.dstack/runs/{id}.json` events through `EventThread` with play/pause/step. | M |
| 4.8 | Full-text artifact search | Build a MiniSearch index over all artifact versions on server start, update via the chokidar watcher; `GET /api/search?q=`. | M |
| 4.9 | Multi-project switcher | Server holds a map of `ProjectContext`s keyed by root; `X-DStack-Project` header; recent-projects list. | M |
| 4.10 | Issue tracker sync | `/autoplan` phases → GitHub Issues (then Linear); close on passing `/ship`. | L |
| 4.11 | Visual skill editor | UI for `/skillify`: manifest form, prompt editor (CodeMirror is installed), schema editor, "test with fake provider". | L |
| 4.12 | Custom workflow builder | Per-project `.dstack/workflow.yaml` with extra gates; `WorkflowOrchestrator` reads it; drag-and-drop editor. | L |
| 4.13 | Design prototype gallery | Grid of `.dstack/design-prototypes/*.html` in sandboxed iframes; favorites feed `TasteProfileStore` (fix its integer-decay bug first). | M |

---

## Risks and decisions to confirm

1. **Frontend-safe test (0.2):** needs an owner decision before Phase 0 can close.
2. **Deleting the core `/v1` server (1.1):** confirm nothing outside this repo uses `/v1` or `ds --serve`.
3. **Removing login (2.1):** assumes DStack stays single-user and local. If a hosted version is planned, keep a real auth design instead of deleting it.
4. **Writing the Gemini key to `.env` from the UI (2.1):** convenient, but it means the server can write secrets to disk. The alternative is to show the user the line to add themselves.
5. **Known core bugs** (CAREFUL bypass, staleness BFS, TasteProfile decay) block 3.1, 3.6 and 4.13. Re-audit them in 2.7 and fix them before those features.

## Suggested PR breakdown

One PR per numbered task in Phases 0–2 (1.1 may be two: extract shared pieces, then port tests and delete).
Phase 3 and 4 features: one PR each, behind no feature flags unless a feature touches the ship gate.
