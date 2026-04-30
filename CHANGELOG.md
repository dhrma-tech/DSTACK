# Changelog

## Phase 2

Phase 2 adds 28 skills and the runtime modules needed for review dashboards, artifact staleness, deploy state, browser sessions, learning memory, benchmarking, skill generation, safety modes, PDF export, Codex bridging, CSO review, and plan tuning.

### Added

- Safety: `/guard`, `/careful`, persisted `SafetyModeManager`, and PermissionGate mode enforcement.
- Review: `StalenessDetector`, `ReviewDashboard`, and `/health`.
- Planning: `/plan-design-review`, `/plan-devex-review`, `/plan-tune`, `/devex-review`, `/cso`.
- Design: `/design-shotgun`, `/design-html`, `/landing-report`.
- Deploy: `DeployManager`, `/setup-deploy`, `/land-and-deploy`, `/canary`, `/freeze`, `/unfreeze`.
- Memory: `LearningStore`, `/learn`, `/setup-memory`, `/retro`.
- Browser/data: `BrowserSessionManager`, `/setup-browser-cookies`, `/scrape`, `/pair-agent`.
- Utilities: `/benchmark`, `/benchmark-models`, `/skillify`, `/dstack-upgrade`, `/make-pdf`, `/codex`.

### Changed

- `ds --list-skills` now shows 42 total skills: 14 Phase 1 skills plus 28 Phase 2 skills.
- `/ship` now blocks on stale hard-gate artifacts as well as failed QA/review gates.
- Artifact writes normalize invalid `generatedAt` values to a valid ISO timestamp.

### Migration Notes

No manual migration is required for Phase 1 projects. Existing `.dstack/artifacts/` layouts remain valid. New state files are created lazily as skills run:

- `.dstack/safety-mode.json`
- `.dstack/deploy.json`
- `.dstack/deploy-state.json`
- `.dstack/memory/learnings.json`
- `.dstack/browser/sessions/`
- `.dstack/design-prototypes/`
- `.dstack/exports/`
