/** The core idea → ship path, in order. Used to rank suggestions; other skills follow alphabetically. */
export const CORE_PIPELINE: readonly string[] = Object.freeze([
  "office-hours",
  "autoplan",
  "plan-ceo-review",
  "plan-eng-review",
  "design-consultation",
  "design-review",
  "review",
  "qa",
  "ship"
]);

/** Project stages shown in the UI, in order. */
export const PROJECT_STAGES = ["planning", "design", "qa", "shipped", "deployed"] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

/** Which stage each skill belongs to. Skills not listed are utilities with no stage. */
export const SKILL_STAGE: Readonly<Record<string, ProjectStage>> = Object.freeze({
  "office-hours": "planning",
  autoplan: "planning",
  "plan-ceo-review": "planning",
  "plan-eng-review": "planning",
  "plan-design-review": "planning",
  "plan-devex-review": "planning",
  "plan-tune": "planning",
  "design-consultation": "design",
  "design-review": "design",
  "design-shotgun": "design",
  "design-html": "design",
  review: "qa",
  qa: "qa",
  "qa-only": "qa",
  investigate: "qa",
  "devex-review": "qa",
  cso: "qa",
  ship: "shipped",
  "setup-deploy": "deployed",
  "land-and-deploy": "deployed",
  canary: "deployed"
});

/**
 * Skills that can only be started from the `ds` CLI, never over HTTP: they handle browser
 * cookies, change the DStack install, deploy, or drive an interactive session.
 */
export const CLI_ONLY_SKILLS: readonly string[] = Object.freeze([
  "pair-agent",
  "setup-browser-cookies",
  "skillify",
  "dstack-upgrade",
  "make-pdf",
  "canary",
  "design-html"
]);

/** Skills whose implementation is still partial or experimental. */
export const PARTIAL_SKILLS: readonly string[] = Object.freeze(["pair-agent", "benchmark-models", "codex", "cso", "skillify"]);
