

# DSTACK — Claude Code Context File
# Generated: 2026-05-04 | Repo: https://github.com/dhrma-tech/DSTACK
# Purpose: Complete authoritative context for Claude Code sessions.
# Read this entire file before touching any code.

---

## 0. CRITICAL REPO STATE (Read First)

The `main` branch has **2 commits only**. It contains:
- `packages/shared` ✅
- `packages/core` ✅
- `packages/cli` ✅
- `packages/server` ❌ LOCAL ONLY — NOT COMMITTED
- `packages/web` ❌ LOCAL ONLY — NOT COMMITTED

All integration work (Express server, SSE streaming, Next.js frontend,
`--json-events` CLI flag) exists on the developer's local machine but has
never been pushed. The walkthrough summary describes intended/in-progress
work, not merged reality.

**Your first action in any session: run `git status` and `git log --oneline`
to know the actual state. Do not assume anything from the walkthrough summary
is in the repo unless you can read the file.**

---

## 1. What DStack Is

DStack is a CLI-native, API-first workflow orchestration system for software
product development. It enforces a structured skill pipeline from idea to
shipped product. It is NOT a chatbot, NOT a SaaS dashboard, NOT a code editor.

Mental model: "If Claude built an IDE for AI workflows."
Closest analogues: Codex + Linear + terminal workflow system.

The user types `ds /qa` and DStack:
1. Reads prior artifacts (autoplan, review) as context
2. Runs tests, checks git diff, opens browser if URL provided
3. Calls Gemini API to analyze everything
4. Writes a structured QA artifact to `.dstack/artifacts/qa/latest.json`
5. Blocks `/ship` if QA fails

Every skill is atomic, named, auditable. Every skill output is a versioned
JSON artifact. Plans gate reviews. Reviews gate QA. QA gates ship.

---

## 2. Monorepo Structure

```
dstack/                          ← root (pnpm workspace)
├── packages/
│   ├── shared/                  ← @dstack/shared — PUBLIC CONTRACTS ONLY
│   │   └── src/
│   │       ├── types/           ← TypeScript interfaces (Artifact, Skill, etc.)
│   │       ├── schemas/         ← Zod schemas for all skill output validation
│   │       ├── errors/          ← typed DStackError hierarchy
│   │       └── constants/
│   │           ├── skill-graph.ts  ← DAG of skill dependencies (Phase 2 edges INCOMPLETE)
│   │           └── pricing.ts      ← Gemini token pricing constants
│   │
│   ├── core/                    ← @dstack/core — ALL RUNTIME LOGIC
│   │   └── src/
│   │       ├── config/          ← ConfigManager (reads .env + .dstack/config.yaml)
│   │       ├── logger/          ← SessionLogger (writes .dstack/logs/)
│   │       ├── permissions/     ← PermissionGate + SafetyModeManager + rules.ts
│   │       ├── memory/          ← ArtifactStore, MemoryStore, CheckpointStore, LearningStore
│   │       ├── model/           ← GeminiProvider, FakeProvider, ModelRouter, RetryManager
│   │       ├── tools/           ← ToolExecutor + file/shell/git/search/browser tools
│   │       ├── browser/         ← BrowserSessionManager, BrowserDOMScanner, PairAgentController
│   │       ├── prompt/          ← PromptTemplateEngine + partials
│   │       ├── skills/          ← SkillRegistry, SkillLoader, SkillExecutor, WorkflowOrchestrator
│   │       │   └── definitions/ ← 42 skill folders (manifest.yaml + handler.ts each)
│   │       ├── review/          ← StalenessDetector, ReviewDashboard
│   │       ├── deploy/          ← DeployManager
│   │       ├── design/          ← TasteProfileStore
│   │       ├── benchmark/       ← BenchmarkRunner
│   │       ├── upgrade/         ← UpgradeManager
│   │       ├── output/          ← PDFGenerator + HTML templates
│   │       └── integrations/    ← CodexIntegration
│   │
│   ├── cli/                     ← @dstack/cli — ds EXECUTABLE
│   │   └── src/
│   │       ├── index.ts         ← entry point, argument parsing
│   │       ├── parser.ts        ← yargs-based arg parsing
│   │       ├── router.ts        ← routes skill name to SkillExecutor
│   │       └── printer.ts       ← formats output + next-skill suggestions
│   │
│   ├── server/                  ← @dstack/server — EXPRESS BRIDGE (LOCAL ONLY, NOT COMMITTED)
│   │   └── src/
│   │       ├── index.ts         ← Express server port 3001
│   │       ├── routes/          ← REST + SSE endpoints
│   │       ├── lib/run-manager.ts  ← active run state (runId → child process)
│   │       └── watcher.ts       ← chokidar watching .dstack/ for changes
│   │
│   └── web/                     ← @dstack/web — NEXT.JS FRONTEND (LOCAL ONLY, NOT COMMITTED)
│       └── src/
│           ├── app/             ← Next.js App Router pages
│           ├── components/shell/ ← EventThread, ToolCallCard, ApprovalGateCard, etc.
│           ├── hooks/           ← useSSE, useActiveRun, useSkills, useProject
│           └── lib/api.ts       ← typed fetch client for all server endpoints
│
├── docs/                        ← documentation (architecture, skills, safety, deploy, browser)
├── scripts/
│   ├── validate-skill-manifests.ts  ← pnpm skill:check
│   └── backend-smoke.mjs            ← smoke test for server
├── tests/                       ← integration tests (FakeProvider only)
├── .env.example                 ← GEMINI_API_KEY, DSTACK_PROVIDER, model vars
├── package.json                 ← root workspace scripts
├── pnpm-workspace.yaml          ← packages/*
└── tsconfig.base.json
```

---

## 3. Skills — Complete List (42 total)

### Phase 1 Skills (14) — COMPLETE, TESTED, PRODUCTION QUALITY

| Skill | Purpose | Model |
|---|---|---|
| `/office-hours` | Capture project idea → Project Brief | flash |
| `/autoplan` | Generate phased implementation plan | pro |
| `/plan-ceo-review` | CEO/CPO review of plan | pro |
| `/plan-eng-review` | Engineering review of plan | pro |
| `/design-consultation` | UX design brief + screen inventory | pro |
| `/design-review` | Review design brief critically | pro |
| `/review` | Code review of git diff | pro |
| `/qa` | Full QA: tests + browser + static analysis | pro |
| `/qa-only` | Run tests only, fast loop | flash |
| `/investigate` | Root cause analysis for failures | pro |
| `/ship` | Pre-ship checklist + gate check | flash |
| `/context-save` | Save workspace checkpoint | flash |
| `/context-restore` | Restore named checkpoint | flash |
| `/browse` | Browser analysis of a URL | flash |

### Phase 2 Skills (28) — REGISTERED, PARTIALLY IMPLEMENTED

**Safety/System:**
| Skill | Status | Notes |
|---|---|---|
| `/guard` | Partial | SafetyModeManager sets GUARD. Gate DENY path incomplete for some tool types |
| `/careful` | Partial | CAREFUL mode set, but pre-approved commands still return ALLOW (bug) |
| `/freeze` | Near-complete | Freeze/unfreeze state correct. CLI status bar indicator missing |
| `/unfreeze` | Near-complete | Works. Doesn't print previous freeze details |
| `/health` | Partial | ReviewDashboard works. npm audit parser breaks on npm v10. topRecommendations generic |
| `/dstack-upgrade` | Missing module | UpgradeManager module doesn't exist → throws at runtime |

**Planning/Review:**
| Skill | Status | Notes |
|---|---|---|
| `/plan-design-review` | Shallow shim | Generic prompt, wrong artifact injection |
| `/plan-devex-review` | Shallow shim | Generic prompt, doesn't read repo config files |
| `/plan-tune` | Shallow shim | revisedPlan not validated against autoplan Zod schema |
| `/devex-review` | Shallow shim | No scoring logic |
| `/cso` | Shallow shim | CSOEngine module missing → throws at runtime |
| `/retro` | Partial | Timezone bug in duration calc. postSave hook incomplete |

**Design:**
| Skill | Status | Notes |
|---|---|---|
| `/design-shotgun` | Shallow shim | TasteProfileStore not read. Variant count not enforced |
| `/design-html` | Shallow shim | No HTML file written. html-validate not called |
| `/landing-report` | Missing module | LandingReportAnalyzer missing → throws at runtime |

**Deploy:**
| Skill | Status | Notes |
|---|---|---|
| `/setup-deploy` | Partial | Approval prompt shows deployCommand not dryRunCommand (bug) |
| `/land-and-deploy` | Shallow shim | No health check polling loop. DeployManager.getConfig() throws on absent file (bug) |
| `/canary` | Shallow shim | No monitoring loop, no rollback logic |

**Browser/Data:**
| Skill | Status | Notes |
|---|---|---|
| `/setup-browser-cookies` | Shallow shim | BrowserSessionManager.load() broken (cookies not injected). Non-headless not enforced |
| `/scrape` | Shallow shim | No robots.txt check, no rate limiting |
| `/pair-agent` | Missing module | PairAgentController missing → throws at runtime |

**Memory/Learning:**
| Skill | Status | Notes |
|---|---|---|
| `/learn` | Partial | --search broken (returns all). --prune gets string not int (bug) |
| `/setup-memory` | Shallow shim | writeDstackMd() is a TODO stub. --import-retro broken |

**Benchmarking:**
| Skill | Status | Notes |
|---|---|---|
| `/benchmark` | Missing module | BenchmarkRunner missing → throws at runtime |
| `/benchmark-models` | Missing module | BenchmarkRunner + pricing.ts missing → throws at runtime |

**Utilities:**
| Skill | Status | Notes |
|---|---|---|
| `/skillify` | Missing module | SkillGenerator missing → throws at runtime |
| `/codex` | Missing module | CodexIntegration missing → throws at runtime |
| `/make-pdf` | Missing module | PDFGenerator missing → throws at runtime |

---

## 4. Known Bugs (Do Not Ignore)

| Bug | Location | Severity | Fix |
|---|---|---|---|
| CAREFUL mode bypass | `permissions/gate.ts` | HIGH | Pre-approved commands return ALLOW in CAREFUL mode. Needs mode-modifier refactor |
| GUARD blocks search_files | `permissions/gate.ts` | HIGH | search_files classified as execute-level, should be read-level |
| DeployManager.getConfig() throws | `deploy/manager.ts` | HIGH | Returns Error when deploy.json absent. Should return null |
| StalenessDetector depth-2 stops | `review/staleness-detector.ts` | HIGH | BFS not implemented, only depth-1 walk |
| LearningStore.search() unfiltered | `memory/learning-store.ts` | HIGH | Returns all entries regardless of query |
| LearningStore.prune() type bug | `memory/learning-store.ts` | HIGH | Accepts string, causes NaN comparison, deletes all entries |
| BrowserSessionManager.load() broken | `browser/session-manager.ts` | HIGH | Cookie field mismatch (expires vs expirationDate). Cookies not injected |
| /retro timezone bug | `skills/definitions/retro/handler.ts` | MEDIUM | UTC offset double-applied, negative durations possible |
| /health npm audit v10 parser | `skills/definitions/health/handler.ts` | MEDIUM | Breaks on npm v10 JSON format |
| /setup-deploy wrong prompt | `skills/definitions/setup-deploy/handler.ts` | MEDIUM | Shows deployCommand instead of dryRunCommand in approval |
| TasteProfileStore integer decay | `design/taste-profile.ts` | MEDIUM | Integer math rounds all weights to 0 quickly |
| skill-graph.ts Phase 2 edges empty | `shared/constants/skill-graph.ts` | HIGH | All Phase 2 dependency arrays are [] — staleness detection broken |
| pricing.ts missing | `shared/constants/pricing.ts` | HIGH | Referenced by benchmark-models, file doesn't exist |
| Windows path separators | `memory/artifact-store.ts` | LOW | Backslashes in artifact paths on Windows |

---

## 5. Data Flow — How Everything Connects

```
User                CLI              Core                  .dstack/
────              ─────            ──────                  ────────
ds /qa    →    parser.ts    →   SkillExecutor.run()
                                  │
                                  ├── ArtifactStore.readLatest("autoplan")    ← .dstack/artifacts/autoplan/latest.json
                                  ├── ArtifactStore.readLatest("review")      ← .dstack/artifacts/review/latest.json
                                  ├── PromptTemplateEngine.build()
                                  │     └── LearningStore.list("qa")          ← .dstack/memory/learnings.json
                                  ├── ModelRouter.getProvider()
                                  │     └── GeminiProvider.generate() OR FakeProvider.generate()
                                  ├── ToolExecutor.dispatch()  ← every tool call
                                  │     └── PermissionGate.check()
                                  │           └── SafetyModeManager.getMode()  ← .dstack/safety-mode.json
                                  ├── handler.postSave()
                                  │     └── LearningStore.add()  (retro only)
                                  └── ArtifactStore.write("qa", output)       → .dstack/artifacts/qa/latest.json
                                                                               → .dstack/artifacts/qa/{timestamp}-{hash}.json
                                                                               → .dstack/logs/qa-{timestamp}.json
```

```
Frontend           Server              Core / .dstack/
────────          ────────            ───────────────
GET /api/skills  →  SkillRegistry.list()
                    + ArtifactStore.readLatest() per skill (for lastVerdict)

POST /api/skills/qa/run  →  spawn("pnpm ds -- /qa --json-events")
                              child.stdout → parse NDJSON → SSE to browser

GET /api/runs/:id/stream  →  EventSource in browser
                              receives: reasoning, tool-call, tool-result,
                              approval-required, artifact-saved, complete

POST /api/approvals/:id/respond  →  write "y\n" or "n\n" to child.stdin

GET /api/artifacts  →  glob .dstack/artifacts/*/latest.json

GET /api/workflow/graph  →  skill-graph.ts constants
                            + ArtifactStore timestamps per node
                            + StalenessDetector.detect()

GET /api/events  →  SSE from chokidar watcher on .dstack/
```

---

## 6. Artifact Store Contract

All artifacts live in `.dstack/artifacts/{skillName}/`.

- `latest.json` — always the most recent output (overwritten on each run)
- `{ISO8601}-{6charHash}.json` — every version (append-only, never deleted)

Every artifact JSON contains:
```json
{
  "skillName": "qa",
  "generatedAt": "2026-05-04T10:30:00.000Z",
  "generated_by": "fake-provider",  // only in fake mode
  "overallVerdict": "PASS | REVISE | FAIL",
  ...skill-specific fields...
}
```

Artifact validation: every skill's output schema is defined in
`@dstack/shared/src/schemas/{skillName}.ts` as a Zod schema.
`postProcess()` in each handler validates against it. If validation fails,
the executor retries once with errors injected, then writes a partial artifact
with `isValid: false`.

---

## 7. State Files (All Created Lazily)

| File | Created by | Read by | Purpose |
|---|---|---|---|
| `.dstack/artifacts/*/latest.json` | Every skill run | All skills + server | Skill output |
| `.dstack/memory.json` | `/office-hours`, `/setup-memory` | All skills via PromptTemplateEngine | Project memory |
| `.dstack/memory/learnings.json` | `/learn`, `/retro`, `/setup-memory` | PromptTemplateEngine, server | Learning store |
| `.dstack/safety-mode.json` | `/guard`, `/careful` | PermissionGate on every tool call | Safety mode |
| `.dstack/deploy.json` | `/setup-deploy` | `/land-and-deploy`, `/canary`, server | Deploy config |
| `.dstack/deploy-state.json` | `/freeze`, `/unfreeze` | `/land-and-deploy`, server | Freeze state |
| `.dstack/browser/sessions/{name}/` | `/setup-browser-cookies` | `/scrape`, `/pair-agent` | Browser sessions |
| `.dstack/browser/screenshots/*.png` | `/qa`, `/browse`, `/pair-agent` | server, frontend | Screenshots |
| `.dstack/design-prototypes/*.html` | `/design-html` | server | HTML prototypes |
| `.dstack/exports/*.pdf` | `/make-pdf` | server | PDF exports |
| `.dstack/checkpoints/*.checkpoint.json` | `/context-save` | `/context-restore` | Checkpoints |
| `.dstack/design/taste.json` | `/design-shotgun` (postSave) | `/design-shotgun` (on next run) | Taste profile |
| `.dstack/logs/{skill}-{ts}.json` | Every skill run | server (`GET /api/runs`) | Session logs |
| `.dstack/runs/{runId}.json` | server on skill run | server (`GET /api/runs`) | Run records |

---

## 8. Environment Variables

```bash
# Core (required for live mode)
GEMINI_API_KEY=                          # Gemini API key
DSTACK_PROVIDER=gemini                   # gemini | fake
DSTACK_DEFAULT_MODEL=gemini-2.0-flash-001
DSTACK_PRO_MODEL=gemini-2.5-pro-preview
DSTACK_MAX_TOKENS=8192
DSTACK_REQUEST_TIMEOUT_MS=120000
DSTACK_MAX_RETRIES=3
DSTACK_RETRY_BASE_DELAY_MS=1000

# Server (packages/server — NOT YET IN .env.example)
API_PORT=3001

# Web (packages/web — NOT YET IN .env.example)
NEXT_PUBLIC_API_URL=http://localhost:3001
WEB_PORT=3000
```

---

## 9. Root Package Scripts

```json
{
  "build":          "pnpm -r build",
  "typecheck":      "pnpm -r typecheck",
  "test":           "vitest run",
  "test:coverage":  "vitest run --coverage",
  "lint":           "eslint .",
  "skill:check":    "tsx scripts/validate-skill-manifests.ts",
  "ds":             "tsx --conditions development packages/cli/src/index.ts",
  "backend:smoke":  "node scripts/backend-smoke.mjs"
}
```

Scripts NOT YET ADDED (needed):
```json
{
  "server":  "tsx packages/server/src/index.ts",
  "web":     "pnpm --filter @dstack/web dev",
  "dev":     "concurrently \"pnpm server\" \"pnpm web\""
}
```

---

## 10. Permission System

Three safety modes in `SafetyModeManager`:

| Mode | Effect | Set by |
|---|---|---|
| NORMAL | Standard rules apply | Default |
| CAREFUL | Every tool call (incl. pre-approved) → REQUIRE_APPROVAL | `/careful` |
| GUARD | All write/execute tool calls → DENY. Reads still ALLOW | `/guard` |

Gate decisions returned by `PermissionGate.check()`:

| Decision | Meaning |
|---|---|
| ALLOW | Proceeds without prompt |
| REQUIRE_APPROVAL | Pauses, prompts user (Y/N), logs decision |
| DENY | Hard block, never executes |

Shell DENY blocklist (do not add to or remove from without explicit instruction):
`rm -rf`, `sudo`, `curl | bash`, `wget | sh`, `eval`, `DROP TABLE`,
`DROP DATABASE`, `git push --force`, `git push -f`, `git push --force-with-lease`,
`git reset --hard`, `git clean -fd`, `git clean -fx`

Pre-approved (ALLOW in NORMAL mode):
`npm run *`, `yarn`, `pnpm`, `npx vitest`, `npx jest`, `npx tsc`,
`git status`, `git diff`, `git log`, `ls`, `cat`, `echo`

GUARD mode bug: `search_files` is misclassified as execute-level → gets DENY in GUARD.
Should be read-level → ALLOW in GUARD. Fix in `packages/core/src/permissions/gate.ts`.

---

## 11. Provider System

```
ModelRouter.getProvider(skillName)
  → reads DSTACK_PROVIDER env var
  → returns GeminiProvider | FakeProvider

GeminiProvider:
  - wraps @google/generative-ai SDK
  - streaming via AsyncIterableIterator
  - structured output: response_mime_type: "application/json"
  - retries: RetryManager handles 429 (quota) with exponential backoff
  - token budget: ContextBudgetCalculator truncates injected context

FakeProvider:
  - deterministic, golden artifact map keyed by prompt hash
  - all Phase 1 skills have golden artifacts
  - Phase 2 skills return shim hardcoded responses (NOT schema-validated golden artifacts — BUG)
  - returned artifacts always include `generated_by: "fake-provider"`
```

---

## 12. Skill Execution Flow (Step by Step)

```
1. CLI parser resolves skill name from argv
2. SkillRegistry.resolve(name) → SkillManifest
3. WorkflowOrchestrator checks stage gates
   → if prerequisite artifact missing AND no --force → exit with error
4. SkillLoader.load(manifest) → SkillHandler instance
5. ArtifactStore.readLatest() for each required prior artifact
6. LearningStore.list(skillName) → inject relevant learnings
7. PromptTemplateEngine.build() → { systemPrompt, userMessage, tools }
8. ModelRouter.getProvider() → provider instance
9. Tool-call loop:
   a. Send messages to provider
   b. Parse response for tool calls or final text
   c. If tool call: ToolExecutor.dispatch() → PermissionGate.check() → execute → append result
   d. If final text: break loop
10. handler.postProcess(rawOutput) → parse JSON → validate Zod schema
11. ArtifactStore.write(skillName, validatedOutput) → latest.json + versioned file
12. handler.postSave(output, context)  ← optional hook for side effects
13. WorkflowOrchestrator.suggestNext() → print next skill recommendation
14. Logger.writeSession() → .dstack/logs/{skill}-{timestamp}.json
```

---

## 13. Frontend Architecture (Intended State)

The frontend is a Next.js 14 App Router application. It connects to the
Express server on port 3001. All data comes from the server — the frontend
never reads `.dstack/` files directly.

**Shell Page — The Primary Interface:**
```
┌─────────────────────────────────────────────────────────────┐
│ TOPBAR (project + stage pipeline + git branch + badges)     │
├──────────────┬──────────────────────────┬───────────────────┤
│ LEFT RAIL    │ EVENT THREAD             │ RIGHT RAIL (320px)│
│ (240px)      │ (flex)                   │                   │
│              │                          │ Tab: Workflow     │
│ Workflow     │ UserCommandCard          │ Tab: Artifact     │
│ stages       │ ReasoningBlock           │ Tab: Log          │
│              │ ToolCallCard (×N)        │                   │
│ Skill        │ ApprovalGateCard (block) │ Workflow DAG      │
│ launcher     │ ArtifactSaveCard         │ OR                │
│              │ SkillCompleteCard        │ Artifact viewer   │
│              │                          │ OR                │
│              ├──────────────────────────┤ Live log          │
│              │ COMMAND INPUT (dark)     │                   │
│              │ / _____________ ⌘K      │                   │
└──────────────┴──────────────────────────┴───────────────────┘
│ STATUS BAR (activity dot, last artifact, model, mode, freeze)│
└─────────────────────────────────────────────────────────────┘
```

**Key Frontend Files:**

```
packages/web/src/
├── lib/api.ts              ← ALL server calls go through here. Never fetch() directly in components.
├── hooks/
│   ├── useSSE.ts           ← EventSource wrapper, auto-reconnect, typed event parsing
│   ├── useActiveRun.ts     ← manages runId, SSE subscription, event stream array, approval state
│   ├── useSkills.ts        ← GET /api/skills with SWR/React Query
│   └── useProject.ts       ← GET /api/project + /api/events SSE subscription
├── components/shell/
│   ├── EventThread.tsx     ← renders array of ShellEvent objects
│   ├── CommandInput.tsx    ← three modes: idle, skill-selected, running
│   ├── SkillRunnerPanel.tsx← expands from command input on skill selection
│   └── events/
│       ├── ToolCallCard.tsx        ← tool icon by type, left border by tool type, collapsible result
│       ├── ApprovalGateCard.tsx    ← BLOCKS all interaction. Y/N keyboard. POST /api/approvals
│       ├── ArtifactSaveCard.tsx    ← green-bordered, "View →" opens right rail artifact tab
│       ├── ReasoningBlock.tsx      ← collapsible, auto-collapses when run completes
│       ├── UserCommandCard.tsx     ← dark surface, coral left border
│       └── SkillCompleteCard.tsx   ← only on FAIL/REVISE, shows blockers + next action
```

**SSE Event Schema (NDJSON from CLI, forwarded as SSE by server):**
```typescript
type ShellEvent =
  | { type: 'reasoning';          text: string }
  | { type: 'tool-call';          toolName: string; args: Record<string, unknown>; gateDecision: 'ALLOW' | 'REQUIRE_APPROVAL' | 'DENY' }
  | { type: 'tool-result';        toolName: string; output: string; durationMs: number; error?: string }
  | { type: 'approval-required';  runId: string; toolName: string; description: string; permissionLevel: 'READ' | 'WRITE' | 'EXECUTE' | 'DESTRUCTIVE'; args: Record<string, unknown> }
  | { type: 'artifact-saved';     skillName: string; verdict: string; path: string; timestamp: string }
  | { type: 'complete';           skillName: string; verdict: string; durationMs: number }
  | { type: 'error';              message: string; code?: string }
```

---

## 14. Server API Contract

Base URL: `http://localhost:3001`

All endpoints return `Content-Type: application/json` unless SSE.
All errors return `{ error: string, code?: string }` with appropriate HTTP status.

```
GET  /api/project                    → ProjectState
GET  /api/project/health             → HealthReport (calls ReviewDashboard.compute())

GET  /api/skills                     → SkillSummary[]  (42 skills with lastVerdict, isBlocked)
GET  /api/skills/:skillName          → SkillDetail (manifest + last 3 runs)

POST /api/skills/:skillName/run      → { runId: string }  (body: { inputs, provider?, flags? })
POST /api/runs/:runId/stop           → { stopped: true }
GET  /api/runs/:runId/stream         → SSE stream of ShellEvent[]
GET  /api/runs/:runId                → RunRecord (full event log, stored in .dstack/runs/)
GET  /api/runs                       → RunRecord[] (paginated, sorted desc)

POST /api/approvals/:runId/respond   → { written: true }  (body: { decision: 'approve' | 'deny' })

GET  /api/artifacts                  → { [skillName]: ArtifactMeta }
GET  /api/artifacts/:skillName       → ArtifactVersion[]  (all versions)
GET  /api/artifacts/:skillName/latest → Artifact (full JSON content)
GET  /api/artifacts/:skillName/diff  → ArtifactDiff  (query: v1, v2 timestamps)

GET  /api/workflow/graph             → WorkflowGraph { nodes: WorkflowNode[], edges: WorkflowEdge[] }

GET  /api/deploy/config              → DeployConfig | null
GET  /api/deploy/state               → { frozen: boolean, reason?: string, frozenAt?: string }
POST /api/deploy/freeze              → { frozen: true }  (body: { reason?, until? })
POST /api/deploy/unfreeze            → { frozen: false }
GET  /api/deploy/runs                → DeployRun[]

GET  /api/safety                     → SafetyModeState
POST /api/safety/mode                → SafetyModeState  (body: { mode: 'NORMAL'|'CAREFUL'|'GUARD' })

GET  /api/learnings                  → LearningEntry[]  (query: q for search)
POST /api/learnings                  → LearningEntry
DELETE /api/learnings/:id            → { deleted: true }

GET  /api/benchmarks                 → BenchmarkRun[]
GET  /api/benchmarks/:runId          → BenchmarkRun (full detail)

GET  /api/browser/sessions           → { name: string, lastUsed: string }[]
GET  /api/browser/screenshots        → ScreenshotAsset[]
GET  /api/browser/screenshots/:filename → image/png file

GET  /api/settings                   → { geminiApiKeyStatus: 'valid'|'invalid'|'missing', maskedKey: string, defaultModel: string, proModel: string, maxTokens: number, safetyMode: string }
PUT  /api/settings                   → updated settings  (body: model config, never API key directly)

GET  /api/events                     → SSE global event stream (chokidar .dstack/ watcher)
```

---

## 15. Design System (Non-Negotiable)

DStack follows the Anthropic/Claude marketing site design language.
Do NOT change colors. Do NOT change typography. Do NOT add new surface tones.

**Colors:**
```css
--canvas:              #faf9f5   /* page background — cream, NOT white */
--surface-card:        #efe9de   /* feature cards, left rail */
--surface-dark:        #181715   /* code blocks, terminal, dark panels */
--surface-dark-elevated: #252320 /* elevated cards inside dark surfaces */
--surface-dark-soft:   #1f1e1b  /* inner code blocks */
--ink:                 #141413   /* primary text */
--body:                #3d3d3a   /* body text */
--muted:               #6c6a64   /* secondary text */
--muted-soft:          #8e8b82   /* captions, tertiary */
--hairline:            #e6dfd8   /* 1px borders */
--coral:               #cc785c   /* PRIMARY ACCENT — CTAs, skill names, active states */
--coral-active:        #a9583e   /* coral hover/press */
--coral-bg:            #faece7   /* coral tint backgrounds */
--teal:                #5db8a6   /* browser tool accent */
--amber:               #e8a55a   /* warning, approval, write operations */
--success:             #5db872   /* pass, complete, allow */
--warning:             #d4a017   /* revise, stale, careful */
--error:               #c64545   /* fail, deny, critical */
--on-dark:             #faf9f5   /* text on dark surfaces */
--on-dark-soft:        #a09d96   /* secondary text on dark */
```

**Typography:**
- Display/headings: `Newsreader, 'Tiempos Headline', Georgia, serif` — weight 400, negative letter-spacing
- Body/UI: `Inter, -apple-system, sans-serif` — weight 400 (body) / 500 (labels)
- Code/paths/skills: `'JetBrains Mono', 'Fira Code', monospace` — weight 400

**Tool call card left border colors by tool type:**
```
read_file, list_files, search_files, git_status, git_diff, git_log → hairline (#e6dfd8)
write_file, edit_file → amber (#e8a55a)
run_command (approved) → surface-dark-soft (#1f1e1b) + dark result area
git_commit, git_create_branch → coral (#cc785c)
browser_* → teal (#5db8a6)
DENY decisions → error (#c64545)
REQUIRE_APPROVAL pending → amber (#e8a55a)
```

**Status badge variants (single Badge component):**
```
PASS    → bg #edf7ee  text #2e7d32  border #b2d9b5
FAIL    → bg #fdecea  text #c64545  border #f0b0b0
REVISE  → bg #fff8e8  text #7d5200  border #e8c97a
RUNNING → bg #faece7  text #cc785c  border #f0c4b3  + pulsing dot
BLOCKED → bg #faf9f5  text #6c6a64  border #e6dfd8  + lock icon
FAKE    → bg #fff8e8  text #7d5200  border #e8c97a  amber (same as REVISE)
```

---

## 16. What Is Missing / Remaining Work

### MISSING (throws at runtime, cannot be used at all):
- `packages/core/src/output/pdf-generator.ts` + templates → `/make-pdf` broken
- `packages/core/src/benchmark/runner.ts` → `/benchmark`, `/benchmark-models` broken
- `packages/core/src/skills/generator.ts` → `/skillify` broken
- `packages/core/src/upgrade/manager.ts` → `/dstack-upgrade` broken
- `packages/core/src/browser/pair-agent.ts` → `/pair-agent` broken
- `packages/core/src/browser/landing-analyzer.ts` → `/landing-report` broken
- `packages/core/src/integrations/codex.ts` → `/codex` broken
- `packages/shared/src/constants/pricing.ts` → benchmark cost calc broken
- `packages/server/` → entire package, not committed
- `packages/web/` → entire package, not committed

### INCOMPLETE (runs but produces wrong/degraded output):
- Phase 2 skill edges in `skill-graph.ts` (all empty arrays)
- FakeProvider golden artifacts for Phase 2 skills (shim hardcoded, not schema-valid)
- All 10 known bugs listed in Section 4
- All 24 shallow-shim skill handlers (use generic prompt, wrong artifact injection)

### NEEDS COMMIT (exists locally, not in repo):
- `--json-events` CLI flag + NDJSON event emission
- `packages/server/` with Express + SSE + approval handling
- `packages/web/` with Next.js frontend + all shell components

---

## 17. Conventions Claude Code Must Follow

**TypeScript:**
- `strict: true` everywhere. Zero `any` types.
- New types → `packages/shared/src/types/`. Never define types in `@dstack/core`.
- New constants → `packages/shared/src/constants/`. Never in `@dstack/core`.
- File cap: 300 lines. If longer, split at natural responsibility boundary.

**Skills:**
- `postProcess()` only parses and validates. Zero business logic.
- Business logic (LearningStore writes, TasteProfileStore records) → `postSave()` hook only.
- Never `if (skillName === 'retro')` inside SkillExecutor. Use the hook.
- Skill names always kebab-case, always match directory name in `definitions/`.

**Tools:**
- All tool calls through `ToolExecutor.dispatch()`. Zero direct `BrowserTools.snapshot()` calls from handlers.
- All artifact reads/writes through `ArtifactStore`. Zero `fs.readFile('.dstack/artifacts/...')` in handlers.
- `search_files` is read-level permission. Never classify it as execute.

**Security:**
- Session files (`.dstack/browser/sessions/`) never served by the HTTP server. Return 404.
- API key never returned in full by `GET /api/settings`. Always masked.
- Cookie values never in any log, artifact, or stdout.
- `.dstack/browser/sessions/` excluded from `list_files` results.

**Testing:**
- Tests use `FakeProvider` only. Zero live Gemini API calls in tests.
- Every new skill needs: golden artifact in `tests/fixtures/artifacts/{skillName}-golden.json` + integration test.
- Every bug fix needs a regression test that fails before the fix and passes after.

**Git:**
- `git commit` only stages explicitly listed files. Never `git add -A`.
- Never `git push --force` or `git push -f`.

---

## 18. Verification Commands

Run these after any change to confirm nothing is broken:

```bash
pnpm build           # must exit 0, zero TypeScript errors
pnpm lint            # must exit 0, zero ESLint errors
pnpm test            # must exit 0, all tests pass
pnpm skill:check     # must exit 0, all 42 manifests valid
pnpm typecheck       # must exit 0

# Verify fake mode works end-to-end:
DSTACK_PROVIDER=fake pnpm ds -- /office-hours --idea "Test"
DSTACK_PROVIDER=fake pnpm ds -- /autoplan
DSTACK_PROVIDER=fake pnpm ds -- /qa

# Verify server (when committed):
curl localhost:3001/api/skills | jq 'length'    # must be 42
curl localhost:3001/api/project                 # must return project object

# Verify frontend (when committed):
curl localhost:3000                             # must return 200
```

---

## 19. Immediate Next Actions (Priority Order)

1. **Commit all local work** — `git add packages/server packages/web && git commit -m "feat: server + web packages"`
2. **Fix the 10 known bugs** — PermissionGate mode-modifier, StalenessDetector BFS, LearningStore bugs, BrowserSessionManager load(), DeployManager getConfig(), retro timezone, health audit parser, setup-deploy prompt, TasteProfileStore decay
3. **Fill skill-graph.ts Phase 2 edges** — without this, `/health` staleness is wrong
4. **Create missing modules** — PDFGenerator, BenchmarkRunner, SkillGenerator, UpgradeManager, PairAgentController, LandingReportAnalyzer, CodexIntegration, pricing.ts
5. **Add NEXT_PUBLIC_API_URL and API_PORT to .env.example**
6. **Add dev/server/web scripts to root package.json**
7. **Create FakeProvider golden artifacts for all Phase 2 skills**
8. **Implement real handlers for all 24 shallow-shim skills**
9. **Connect all frontend pages to real API endpoints**
10. **End-to-end integration test**: `/office-hours --provider=fake` from Shell UI → artifact appears in Artifacts page
