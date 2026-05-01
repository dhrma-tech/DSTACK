// ============================================================================
// DESIGN HANDLERS
// ============================================================================
// Design-related phase2 handlers: design-shotgun, design-html, design-taste
// ============================================================================

import { readFile } from "node:fs/promises";
import { ArtifactError, type JsonObject, type DesignArtifact, type DesignVariant } from "@dstack/shared";
import { DesignArtifactRenderer } from "../../design/renderer.js";
import { TasteProfileStore } from "../../design/taste-profile.js";
import { shortHash, nowIso } from "../../utils.js";
import type { SkillExecutionContext, SkillHandler } from "../../skills.js";

type DirectRunner = (context: SkillExecutionContext) => Promise<JsonObject>;

export function directPhase2Handler(run: DirectRunner): SkillHandler {
  return {
    async buildContext() {
      return {};
    },
    async postProcess(rawOutput: string) {
      return JSON.parse(rawOutput);
    },
    async run(context) {
      const output = await run(context);
      return {
        runId: shortHash(context.manifest.name + nowIso(), 12),
        skillName: context.manifest.name,
        status: "complete" as const,
        verdict: "PASS" as const,
        artifact: null,
        output,
        nextSkill: null,
        warnings: [],
        blockers: [],
        runtimeStatus: {
          safetyMode: "standard",
          deployFrozen: false
        },
        toolCalls: [],
        provider: "fake" as const,
        model: "default",
        generatedBy: context.generatedBy,
        artifactPath: ""
      };
    }
  };
}

export const designShotgunHandler: SkillHandler = {
  ...directPhase2Handler(runDesignShotgun),
  async postSave(_output, context) {
    await recordDesignShotgunTaste(context);
  }
};

export const designHtmlHandler = directPhase2Handler(runDesignHtml);

async function runDesignShotgun(context: SkillExecutionContext): Promise<JsonObject> {
  const design = context.prerequisiteArtifacts["design-consultation"] ?? {};
  const screens = objectArray(design.screens);
  const requestedSubject = str(context.invocation.inputs.screen, null) ?? str(context.invocation.inputs.feature, null);
  const screen = requestedSubject ? screens.find((item) => str(item.name, "")!.toLowerCase() === requestedSubject.toLowerCase()) : screens[0];
  if (str(context.invocation.inputs.screen, null) && screens.length > 0 && !screen && !context.invocation.flags.force) {
    throw new ArtifactError(`Screen not found in /design-consultation: ${requestedSubject}. Valid screens: ${screens.map((item) => str(item.name, "unnamed")).join(", ")}`);
  }

  const subject = requestedSubject ?? str(screen?.name, null) ?? "Primary workflow";
  const components = stringArray(screen?.components).length > 0 ? stringArray(screen?.components) : ["status summary", "primary action", "details panel"];
  const userGoal = str(screen?.userGoal, "complete the workflow without losing context")!;
  const taste = new TasteProfileStore({ dstackDir: context.config.dstackDir });
  const preferences = await taste.getTopPreferences() as unknown as JsonObject[];
  const selectedVariant = str(context.invocation.inputs.selected, null) ?? str(context.invocation.inputs.variant, null);
  const verdict = str(context.invocation.inputs["taste-verdict"], null);

  const prefix = titleWords(subject, 3);
  const variants = [
    variant(`${prefix} Command Center`, "Left navigation with a dense command surface", "Compact controls and high signal tables", "Inline edits with persistent status feedback", visualDirection(preferences, "operational, calm, and scan-friendly"), components, [`Scan ${subject} state`, "Act on the highest-priority item", "Verify result without leaving the page"], ["Fast for repeat users", `Keeps ${components[0] ?? "core content"} visible`], ["Can feel busy", "Needs strong keyboard focus styling"], "Power users and operational workflows"),
    variant(`${prefix} Guided Cards`, "Responsive card grid with progressive disclosure", "Readable cards and clear section hierarchy", "Card drill-in with lightweight drawers", visualDirection(preferences, "approachable, spacious, and decision-led"), components, [`Choose the right ${subject} path`, `Review ${userGoal}`, "Open details only when needed"], ["Good first-run comprehension", "Works well on mobile"], ["Less dense for expert comparison", "Requires careful card sorting"], "New users and mixed-skill audiences"),
    variant(`${prefix} Review Split`, "List plus detail split pane", "Stable list selection with a detailed inspection pane", "Keyboardable list navigation updates detail preview", visualDirection(preferences, "precise, utilitarian, and review-oriented"), components, [`Select a ${subject} item`, "Compare alternatives in-place", "Commit or defer the decision"], ["Excellent comparison flow", "Preserves context during review"], ["Mobile layout needs a stacked mode", "Initial implementation is more complex"], "Review-heavy workflows")
  ];

  const preferredName = str(preferences[0]?.variantName, null);
  const fallbackRecommendation = str(variants[1]?.name, `${prefix} Guided Cards`)!;
  const recommended = preferredName && variants.some((item) => str(item.name, "")!.includes(preferredName))
    ? str(variants.find((item) => str(item.name, "")!.includes(preferredName))?.name, fallbackRecommendation)!
    : fallbackRecommendation;

  return mark(context, {
    subject,
    tasteProfileApplied: preferences.length > 0,
    tastePreferences: preferences as unknown as JsonObject[],
    variants: variants as unknown as JsonObject[],
    recommendation: recommended,
    decisionCriteria: [`How often users need to inspect ${subject}`, "Mobile usage expectations", "Need for side-by-side comparison", preferences.length > 0 ? "Persisted taste profile preferences" : "No taste profile has been recorded yet"],
    tasteProfileRecordingRequested: Boolean(selectedVariant && (verdict === "approved" || verdict === "rejected"))
  });
}

async function recordDesignShotgunTaste(context: SkillExecutionContext): Promise<void> {
  const selectedVariant = str(context.invocation.inputs.selected, null) ?? str(context.invocation.inputs.variant, null);
  const verdict = str(context.invocation.inputs["taste-verdict"], null);
  if (!selectedVariant || (verdict !== "approved" && verdict !== "rejected")) return;
  await new TasteProfileStore({ dstackDir: context.config.dstackDir }).record({
    variantName: selectedVariant,
    verdict,
    reason: str(context.invocation.inputs.reason, "Recorded from /design-shotgun invocation.")!
  });
}

async function runDesignHtml(context: SkillExecutionContext): Promise<JsonObject> {
  const design = context.prerequisiteArtifacts["design-consultation"] ?? {};
  const screens = objectArray(design.screens);
  const requestedScreen = str(context.invocation.inputs.screen, null);
  const screen = requestedScreen ? screens.find((item) => str(item.name, "")!.toLowerCase() === requestedScreen.toLowerCase()) : screens[0];
  if (requestedScreen && screens.length > 0 && !screen && !context.invocation.flags.force) {
    throw new ArtifactError(`Screen not found in /design-consultation: ${requestedScreen}. Valid screens: ${screens.map((item) => str(item.name, "unnamed")).join(", ")}`);
  }
  const shotgun = await context.artifactStore.readLatest("design-shotgun");
  const variantName = str(context.invocation.inputs.variant, null);
  const variants = objectArray(shotgun?.content.variants).map(normalizeDesignVariant);
  const subject = str(screen?.name, null) ?? str(shotgun?.content.subject, "Primary workflow")!;
  const artifact: DesignArtifact = { id: shortHash(subject, 12), skillName: "design-shotgun" as const, subject, createdAt: nowIso(), variants: variants as unknown as DesignVariant[], chosenVariant: variantName, htmlFilePath: null, screens: screen ? [screen] : screens, tasteProfileApplied: shotgun?.content.tasteProfileApplied === true };
  const htmlFilePath = await new DesignArtifactRenderer({ projectRoot: context.config.projectRoot, dstackDir: context.config.dstackDir }).render({ artifact, variantName });
  const html = await readFile(htmlFilePath, "utf8");
  return mark(context, {
    screenName: subject,
    variantName,
    htmlFilePath,
    componentsCovered: stringArray(screen?.components).length > 0 ? stringArray(screen?.components) : variants.flatMap((variant: JsonObject) => stringArray(variant.components)).slice(0, 8),
    accessibilityNotes: ["Semantic HTML shell generated.", "Responsive viewport meta tag included.", "Review final interactive states before implementation."],
    knownLimitations: ["Static prototype only; JavaScript interactions are not implemented."],
    viewInstructions: `Open ${htmlFilePath} in a browser to review the prototype.`,
    htmlValid: /^<!doctype html>/i.test(html) && html.includes("<html"),
    validationErrors: /^<!doctype html>/i.test(html) ? [] : ["Generated HTML is missing a doctype."]
  });
}

// Helper functions copied from phase2-real-handlers
function mark(context: SkillExecutionContext, output: JsonObject): JsonObject {
  return context.generatedBy ? { ...output, generated_by: context.generatedBy } : output;
}


function str(value: unknown, fallback: string | null): string | null {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}


function stringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
}

function objectArray(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.filter(objectValue) : [];
}

function objectValue(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function titleWords(subject: string, count: number): string {
  return subject.split(' ').slice(0, count).join(' ');
}

function visualDirection(preferences: JsonObject[], description: string): string {
  return description; // Simplified implementation
}

function variant(name: string, layout: string, components: string, interactions: string, visual: string, coveredComponents: string[], goals: string[], pros: string[], cons: string[], audience: string): JsonObject {
  return {
    name,
    layout,
    components,
    interactions,
    visual,
    coveredComponents,
    goals,
    pros,
    cons,
    audience
  };
}

function normalizeDesignVariant(variant: JsonObject): JsonObject {
  return variant; // Simplified implementation
}
