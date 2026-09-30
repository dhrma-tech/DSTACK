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
