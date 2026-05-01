import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { ArtifactError, ValidationError, estimateGeminiCostUsd, type DeployConfig, type JsonObject, type ProjectMemory, type SkillRunResult, type Verdict } from "@dstack/shared";
import { BenchmarkRunner, defaultSuite, summarize, type BenchmarkSuite } from "./benchmark/runner.js";
import { scanDomContent } from "./browser/dom-scanner.js";
import { defaultDeployConfig, DeployManager } from "./deploy/manager.js";
import { TasteProfileStore } from "./design/taste-profile.js";
import { LearningStore } from "./memory/learning-store.js";
import { FakeProvider, ModelRouter } from "./model.js";
import { PlanTuner } from "./planning/tuner.js";
import { loadDstackProjectContext } from "./prompt.js";
import { ReviewDashboard } from "./review/dashboard.js";
import { SafetyModeManager } from "./safety/mode-manager.js";
import { SkillAuditor } from "./skills/audit.js";
import type { SkillExecutionContext, SkillHandler } from "./skills.js";
import { atomicWrite, exists, git, nowIso, shortHash } from "./utils.js";

type DirectRunner = (context: SkillExecutionContext) => Promise<JsonObject>;

export function directPhase2Handler(run: DirectRunner): SkillHandler {
  return {
    async buildContext() {
      return {};
    },
    async postProcess(rawOutput) {
      return JSON.parse(rawOutput) as JsonObject;
    },
    async run(context) {
      return writeResult(context, await run(context));
    }
  };
}

export const designShotgunHandler = directPhase2Handler(runDesignShotgun);
export const benchmarkHandler = directPhase2Handler(runBenchmark);
export const benchmarkModelsHandler = directPhase2Handler(runBenchmarkModels);
export const setupDeployHandler = directPhase2Handler(runSetupDeploy);
export const landAndDeployHandler = directPhase2Handler(runLandAndDeploy);
export const scrapeHandler = directPhase2Handler(runScrape);
export const healthHandler = directPhase2Handler(runHealth);
export const retroHandler = directPhase2Handler(runRetro);
export const guardHandler = directPhase2Handler(runGuard);
export const carefulHandler = directPhase2Handler(runCareful);
export const learnHandler = directPhase2Handler(runLearn);
export const setupMemoryHandler = directPhase2Handler(runSetupMemory);
export const planTuneHandler = directPhase2Handler(runPlanTune);
export const freezeHandler = directPhase2Handler(runFreeze);
export const unfreezeHandler = directPhase2Handler(runUnfreeze);

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
  const preferences = await taste.getTopPreferences();
  const selectedVariant = str(context.invocation.inputs.selected, null) ?? str(context.invocation.inputs.variant, null);
  const verdict = str(context.invocation.inputs["taste-verdict"], null);
  if (selectedVariant && (verdict === "approved" || verdict === "rejected")) {
    await taste.record({ variantName: selectedVariant, verdict, reason: str(context.invocation.inputs.reason, "Recorded from /design-shotgun invocation.")! });
  }

  const prefix = titleWords(subject, 3);
  const variants = [
    variant(`${prefix} Command Center`, "Left navigation with a dense command surface", "Compact controls and high signal tables", "Inline edits with persistent status feedback", visualDirection(preferences, "operational, calm, and scan-friendly"), components, [`Scan ${subject} state`, "Act on the highest-priority item", "Verify result without leaving the page"], ["Fast for repeat users", `Keeps ${components[0] ?? "core content"} visible`], ["Can feel busy", "Needs strong keyboard focus styling"], "Power users and operational workflows"),
    variant(`${prefix} Guided Cards`, "Responsive card grid with progressive disclosure", "Readable cards and clear section hierarchy", "Card drill-in with lightweight drawers", visualDirection(preferences, "approachable, spacious, and decision-led"), components, [`Choose the right ${subject} path`, `Review ${userGoal}`, "Open details only when needed"], ["Good first-run comprehension", "Works well on mobile"], ["Less dense for expert comparison", "Requires careful card sorting"], "New users and mixed-skill audiences"),
    variant(`${prefix} Review Split`, "List plus detail split pane", "Stable list selection with a detailed inspection pane", "Keyboardable list navigation updates detail preview", visualDirection(preferences, "precise, utilitarian, and review-oriented"), components, [`Select a ${subject} item`, "Compare alternatives in-place", "Commit or defer the decision"], ["Excellent comparison flow", "Preserves context during review"], ["Mobile layout needs a stacked mode", "Initial implementation is more complex"], "Review-heavy workflows")
  ];

  const preferredName = preferences[0]?.variantName ?? null;
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
    decisionCriteria: [`How often users need to inspect ${subject}`, "Mobile usage expectations", "Need for side-by-side comparison", preferences.length > 0 ? "Persisted taste profile preferences" : "No taste profile has been recorded yet"]
  });
}

async function runBenchmark(context: SkillExecutionContext): Promise<JsonObject> {
  const runner = new BenchmarkRunner({ projectRoot: context.config.projectRoot, dstackDir: context.config.dstackDir });
  const suite = await loadSuiteOrDefault(runner, requiredStr(context, "suite"));
  const estimate = await runner.estimate(suite);
  if (context.invocation.flags.dryRun || bool(context.invocation.inputs["dry-run"])) {
    return mark(context, {
      suiteName: suite.name,
      model: suite.model,
      runAt: nowIso(),
      results: [],
      summary: { avgQualityScore: 0, avgLatencyMs: 0, totalTokens: estimate.estimatedTokens, passRate: 0, estimatedInputTokens: estimate.estimatedInputTokens, estimatedOutputTokens: estimate.estimatedOutputTokens, estimatedCostUsd: estimate.estimatedCostUsd, pricingDisclaimer: estimate.pricingDisclaimer },
      dryRun: true,
      liveMode: false,
      qualityEvaluation: "not_run",
      promptCount: suite.prompts.length,
      estimatedTokens: estimate.estimatedTokens
    });
  }

  const live = bool(context.invocation.inputs.live);
  const provider = live ? new ModelRouter(context.config, null).resolve(context.manifest, str(context.invocation.inputs.model, null)).provider : new FakeProvider();
  const model = str(context.invocation.inputs.model, null) ?? suite.model;
  const run = await runner.runSuite(suite, provider, model, { evaluateQuality: live });
  return mark(context, {
    suiteName: run.suiteName,
    model: run.model ?? model,
    runAt: run.runAt,
    results: run.results as unknown as JsonObject[],
    summary: { avgQualityScore: run.summary.avgQualityScore, avgLatencyMs: run.summary.avgLatencyMs, totalTokens: run.summary.totalInputTokens + run.summary.totalOutputTokens, passRate: run.summary.passRate, estimatedCostUsd: estimateGeminiCostUsd(model, run.summary.totalInputTokens, run.summary.totalOutputTokens), pricingDisclaimer: estimate.pricingDisclaimer },
    dryRun: false,
    liveMode: live,
    qualityEvaluation: live ? "criteria_match" : "not_evaluated_offline"
  });
}

async function runBenchmarkModels(context: SkillExecutionContext): Promise<JsonObject> {
  const runner = new BenchmarkRunner({ projectRoot: context.config.projectRoot, dstackDir: context.config.dstackDir });
  const suite = await loadSuiteOrDefault(runner, requiredStr(context, "suite"));
  const models = csv(context.invocation.inputs.models).length > 0 ? csv(context.invocation.inputs.models) : ["gemini-2.5-pro", "gemini-2.0-flash"];
  const estimate = await runner.estimate(suite, models);
  if (context.invocation.flags.dryRun || bool(context.invocation.inputs["dry-run"])) {
    return mark(context, {
      suiteName: suite.name,
      modelsCompared: models,
      runAt: nowIso(),
      modelResults: [],
      recommendation: { bestQuality: "not_evaluated", bestLatency: "not_evaluated", bestValue: "not_evaluated", analysis: `Dry run only. Estimated ${estimate.estimatedTokens} tokens; no provider calls were made.` },
      dryRun: true,
      estimate: estimate as unknown as JsonObject
    });
  }

  const live = bool(context.invocation.inputs.live);
  const modelResults: JsonObject[] = [];
  for (const model of models) {
    try {
      const provider = live ? new ModelRouter(context.config, null).resolve(context.manifest, model).provider : new FakeProvider();
      const run = await runner.runSuite(suite, provider, model, { evaluateQuality: live });
      modelResults.push({
        model,
        avgQualityScore: run.summary.avgQualityScore,
        avgLatencyMs: run.summary.avgLatencyMs,
        totalTokensUsed: run.summary.totalInputTokens + run.summary.totalOutputTokens,
        estimatedCostUsd: estimateGeminiCostUsd(model, run.summary.totalInputTokens, run.summary.totalOutputTokens),
        passRate: run.summary.passRate,
        promptResults: run.results as unknown as JsonObject[],
        status: "COMPLETE",
        qualityEvaluation: live ? "criteria_match" : "not_evaluated_offline",
        pricingDisclaimer: estimate.pricingDisclaimer
      });
    } catch (error) {
      modelResults.push({ model, avgQualityScore: 0, avgLatencyMs: 0, totalTokensUsed: 0, estimatedCostUsd: null, passRate: 0, promptResults: [], status: "FAILED", error: error instanceof Error ? error.message : String(error), pricingDisclaimer: estimate.pricingDisclaimer });
    }
  }
  const completed = modelResults.filter((item) => item.status === "COMPLETE");
  const bestQuality = live ? bestBy(completed, "avgQualityScore") : "not_evaluated";
  const bestLatency = bestByLowest(completed, "avgLatencyMs");
  return mark(context, {
    suiteName: suite.name,
    modelsCompared: models,
    runAt: nowIso(),
    modelResults,
    recommendation: {
      bestQuality,
      bestLatency,
      bestValue: bestLatency,
      analysis: live ? summarize(modelResults.map(modelResultToPromptResult), "Pick the model that best balances score and latency.").recommendation : "Offline mode did not evaluate quality scores. Run with --live and an explicit provider to compare actual responses."
    },
    dryRun: false,
    liveMode: live,
    estimate: estimate as unknown as JsonObject
  });
}

async function runSetupDeploy(context: SkillExecutionContext): Promise<JsonObject> {
  const manager = new DeployManager({ projectRoot: context.config.projectRoot, dstackDir: context.config.dstackDir });
  const now = nowIso();
  const detectedPlatform = await detectDeployPlatform(context.config.projectRoot);
  const platform = str(context.invocation.inputs.platform, null) ?? detectedPlatform.platform;
  const deployCommand = str(context.invocation.inputs.command, null) ?? detectedPlatform.deployCommand;
  const dryRunCommand = str(context.invocation.inputs.dryRunCommand, null) ?? str(context.invocation.inputs["dry-run-command"], null) ?? detectedPlatform.dryRunCommand;
  const env = str(context.invocation.inputs.env, "staging")!;
  const warnings = [...detectedPlatform.warnings];
  if (!["staging", "production"].includes(env)) warnings.push(`Unknown environment "${env}"; deploy flow will treat it as custom.`);
  const requiredEnvVars = csv(context.invocation.inputs.requiredEnvVars).filter((name) => {
    const valid = /^[A-Z_][A-Z0-9_]*$/i.test(name) && !name.includes("=");
    if (!valid) warnings.push(`Ignored invalid env var name "${name}". Store names only, never values.`);
    return valid;
  });
  const config: DeployConfig = {
    ...defaultDeployConfig(now),
    platform,
    environment: env,
    deployCommand,
    dryRunCommand,
    canaryCommand: str(context.invocation.inputs.canaryCommand, null) ?? defaultDeployConfig(now).canaryCommand,
    healthCheckUrl: str(context.invocation.inputs.healthCheckUrl, null),
    rollbackCommand: str(context.invocation.inputs.rollbackCommand, null),
    requiredEnvVars,
    updatedAt: now
  };
  await manager.writeConfig(config);
  const dryRun = await executeCommand(context, dryRunCommand, 180_000);
  return mark(context, {
    platform: config.platform,
    environment: config.environment,
    deployCommand: config.deployCommand,
    dryRunCommand: config.dryRunCommand,
    healthCheckUrl: config.healthCheckUrl,
    rollbackCommand: config.rollbackCommand,
    requiredEnvVars: config.requiredEnvVars,
    deployConfigPath: manager.configPath,
    dryRunResult: dryRun.exitCode === 0 ? "PASS" : "FAIL",
    dryRunOutput: dryRun.output,
    warnings
  });
}

async function runLandAndDeploy(context: SkillExecutionContext): Promise<JsonObject> {
  const manager = new DeployManager({ projectRoot: context.config.projectRoot, dstackDir: context.config.dstackDir });
  const env = str(context.invocation.inputs.env, "staging")!;
  const blockers: string[] = [];
  const freezeState = await manager.readState();
  if (freezeState.frozen) blockers.push(`Deploy freeze is active${freezeState.reason ? `: ${freezeState.reason}` : "."}`);
  const ship = await context.artifactStore.readLatest("ship");
  const qa = await context.artifactStore.readLatest("qa");
  if (!ship || ship.verdict !== "PASS") blockers.push("/ship artifact must be PASS.");
  if (!qa || qa.verdict !== "PASS") blockers.push("/qa artifact must be PASS.");
  const config = await manager.readConfig().catch(() => null);
  if (!config) blockers.push("Deploy config missing. Run /setup-deploy first.");
  const productionApproved = bool(context.invocation.inputs["confirm-production"]) || bool(context.invocation.inputs.confirmProduction);
  if (env === "production" && !productionApproved) blockers.push("Production deploy requires explicit approval: re-run with --confirm-production after reviewing the command.");

  let deployOutput = "";
  let exitCode = blockers.length === 0 ? 0 : 1;
  if (blockers.length === 0 && config) {
    const commandResult = await executeCommand(context, config.deployCommand, 180_000);
    deployOutput = commandResult.output;
    exitCode = commandResult.exitCode;
  }

  const health = config?.healthCheckUrl && exitCode === 0 ? await pollHealth(config.healthCheckUrl, config.healthCheckTimeoutSeconds, config.healthCheckIntervalSeconds) : { verdict: "SKIPPED" as const, attempts: 0, output: "No health check URL configured." };
  const rollbackRequired = exitCode === 0 && (health.verdict === "FAIL" || health.verdict === "TIMEOUT");
  let rollbackExecuted = false;
  let rollbackOutput: string | null = rollbackRequired ? "Rollback command available but not executed automatically." : null;
  if (rollbackRequired && config?.rollbackCommand && bool(context.invocation.inputs["execute-rollback"])) {
    const rollback = await executeCommand(context, config.rollbackCommand, 180_000);
    rollbackExecuted = rollback.exitCode === 0;
    rollbackOutput = rollback.output;
  }

  const head = await git(["rev-parse", "--short", "HEAD"], context.config.projectRoot);
  const branch = await git(["branch", "--show-current"], context.config.projectRoot);
  const deployedAt = nowIso();
  const deployVerdict = blockers.length === 0 && exitCode === 0 && (health.verdict === "PASS" || health.verdict === "SKIPPED") ? "PASS" : "FAIL";
  const output = mark(context, {
    environment: env,
    deployedAt,
    deployCommand: config?.deployCommand ?? "",
    deployOutput,
    exitCode,
    deployVerdict,
    healthCheckUrl: config?.healthCheckUrl ?? null,
    healthCheckVerdict: health.verdict,
    healthCheckAttempts: health.attempts,
    healthCheckOutput: health.output,
    rollbackRequired,
    rollbackExecuted,
    rollbackOutput,
    gitHead: head.stdout.trim() || "unknown",
    gitBranch: branch.stdout.trim() || "unknown",
    blockers
  });
  if (config) {
    await manager.recordDeployRun({ id: shortHash(JSON.stringify(output), 12), projectId: context.config.projectRoot, environment: env, type: "full", startedAt: deployedAt, completedAt: nowIso(), deployCommand: config.deployCommand, exitCode, stdout: deployOutput, stderr: "", verdict: deployVerdict, healthCheckVerdict: health.verdict, gitHead: String(output.gitHead), gitBranch: String(output.gitBranch), deployedBy: "dstack", rollbackExecuted, frozen: freezeState.frozen });
  }
  return output;
}

async function runHealth(context: SkillExecutionContext): Promise<JsonObject> {
  const dashboard = await new ReviewDashboard({ projectRoot: context.config.projectRoot, dstackDir: context.config.dstackDir }).compute();
  const skillAudit = await new SkillAuditor().audit();
  const deployManager = new DeployManager({ projectRoot: context.config.projectRoot, dstackDir: context.config.dstackDir });
  const freezeState = await deployManager.readState();
  const deployConfig = await deployManager.readConfig().catch(() => null);
  const learningCount = (await new LearningStore({ dstackDir: context.config.dstackDir }).all()).length;
  const routing = await loadDstackProjectContext(context.config.projectRoot);
  const gitStatus = await git(["status", "--porcelain"], context.config.projectRoot);
  const lastCommit = await git(["log", "-1", "--pretty=format:%cI"], context.config.projectRoot);
  const commitCount = await git(["rev-list", "--count", "--since=14.days", "HEAD"], context.config.projectRoot);
  const auditPenalty = skillAudit.errors.length * 10;
  const freezePenalty = freezeState.frozen ? 5 : 0;
  const score = clampScore(dashboard.readinessScore - auditPenalty - freezePenalty);
  const recommendations = topRecommendations([
    ...dashboard.topBlockers,
    skillAudit.errors.length > 0 ? `Fix ${skillAudit.errors.length} skill-check error(s).` : null,
    freezeState.frozen ? "Review /freeze state before deploying." : null,
    learningCount === 0 ? "Capture durable project lessons with /learn." : null,
    !routing ? "Run /setup-memory to create DSTACK.md prompt routing context." : null
  ]);
  const output = mark(context, {
    healthScore: score,
    healthVerdict: healthVerdict(score, dashboard.openGates.length, skillAudit.errors.length),
    computedAt: nowIso(),
    staleArtifacts: dashboard.staleArtifacts as unknown as JsonObject[],
    openGates: dashboard.openGates,
    neverRunSkills: dashboard.neverRunSkills,
    dependencyAudit: {
      status: "SKIPPED",
      vulnerabilities: 0,
      critical: 0,
      high: 0,
      auditCommand: "not run",
      reason: "Dependency audit execution is intentionally skipped by this offline-safe health handler."
    },
    gitHealth: {
      commitFrequency: commitFrequency(Number(commitCount.stdout.trim() || 0)),
      lastCommitAt: lastCommit.stdout.trim() || "unknown",
      uncommittedChanges: gitStatus.stdout.trim().length > 0,
      statusEntries: gitStatus.stdout.trim() ? gitStatus.stdout.trim().split(/\r?\n/).length : 0
    },
    topRecommendations: recommendations,
    summary: healthSummary(score, dashboard.openGates.length, dashboard.staleArtifacts.length, freezeState.frozen, skillAudit.errors.length, learningCount),
    scoringMethod: "ReviewDashboard readiness score minus 10 points per skill-check error and 5 points while deploy freeze is active; clamped to 0-100.",
    checked: ["artifact inventory", "staleness", "workflow gates", "skill-check", "git status", "deploy freeze", "learning count", "DSTACK.md routing"],
    skipped: ["dependency audit command execution"],
    workflowStage: dashboard.workflowStage,
    overallReadiness: dashboard.overallReadiness,
    completedGates: dashboard.completedGates,
    skillCheck: {
      passed: skillAudit.passed,
      totalSkills: skillAudit.totalSkills,
      errors: skillAudit.errors.length,
      warnings: skillAudit.warnings.length,
      centralShimWarnings: skillAudit.centralShimSkills.length,
      centralShimSkills: skillAudit.centralShimSkills
    },
    deployFreeze: freezeState as unknown as JsonObject,
    deployConfig: deployConfig ? { platform: deployConfig.platform, environment: deployConfig.environment, healthCheckConfigured: Boolean(deployConfig.healthCheckUrl) } : null,
    learningCount,
    dstackMd: routing ? { present: true, truncated: routing.truncated === true, secretsRedacted: routing.secretsRedacted === true } : { present: false, truncated: false, secretsRedacted: false }
  });
  return output;
}

async function runRetro(context: SkillExecutionContext): Promise<JsonObject> {
  const artifactSkills = await context.artifactStore.listSkillsWithArtifacts();
  const latestArtifacts = await readLatestArtifacts(context, artifactSkills);
  const office = latestArtifacts["office-hours"];
  const ship = latestArtifacts.ship;
  const qaArtifacts = await context.artifactStore.list("qa");
  const planRevisions = Math.max(0, (await context.artifactStore.list("autoplan")).length - 1);
  const qaFailures = qaArtifacts.reduce((total, artifact) => total + numberAt(objectValue(artifact.content.testResults), "failed"), 0);
  const investigateRuns = (await context.artifactStore.list("investigate")).length;
  const designIterations = ["design-consultation", "design-shotgun", "design-html", "design-review"].reduce((total, skill) => total + (latestArtifacts[skill] ? 1 : 0), 0);
  const reviewRejections = Object.values(latestArtifacts).filter((artifact) => artifact.overallVerdict === "FAIL" || stringArray(artifact.mustFixBeforeProceeding).length > 0).length;
  const learnings = await new LearningStore({ dstackDir: context.config.dstackDir }).all();
  const repeatedIssues = repeatedArtifactIssues(Object.entries(latestArtifacts).map(([skillName, content]) => ({ skillName, content })));
  const cycleStart = str(office?.generatedAt, null) ?? earliestGeneratedAt(Object.values(latestArtifacts)) ?? nowIso();
  const cycleEnd = str(ship?.generatedAt, null) ?? nowIso();
  const learningEntries = retroLearningEntries(repeatedIssues, qaFailures, reviewRejections);
  const storeLearnings = !bool(context.invocation.inputs["suggest-only"]);
  if (storeLearnings) {
    const store = new LearningStore({ dstackDir: context.config.dstackDir });
    const existing = await store.all();
    for (const entry of learningEntries) {
      if (!hasDuplicateLearning(existing, entry.topic, entry.insight)) {
        const stored = await store.add({ ...entry, originalText: entry.insight, wasRephrased: false, source: "retro" });
        existing.push(stored);
      }
    }
  }
  const output = mark(context, {
    cycleStart,
    cycleEnd,
    estimatedDurationDays: durationDays(cycleStart, cycleEnd),
    wentWell: retroWentWell(latestArtifacts, learnings.length),
    wentPoorly: retroWentPoorly(qaFailures, reviewRejections, repeatedIssues),
    processMetrics: { planRevisions, qaFailures, investigateRuns, designIterations, reviewRejections },
    keyDecisions: keyDecisionsFromArtifacts(latestArtifacts),
    learningEntries: learningEntries as unknown as JsonObject[],
    nextCycleRecommendations: retroRecommendations(qaFailures, reviewRejections, repeatedIssues, latestArtifacts),
    repeatedIssues,
    artifactsReviewed: artifactSkills,
    learningStoreCountBefore: learnings.length,
    learningSuggestionsStored: storeLearnings,
    gitLog: await gitSummary(context.config.projectRoot)
  });
  return output;
}

async function runGuard(context: SkillExecutionContext): Promise<JsonObject> {
  const manager = new SafetyModeManager({ dstackDir: context.config.dstackDir });
  const previous = await manager.read();
  const next = await manager.setMode("GUARD", "guard", str(context.invocation.inputs.reason, null));
  return mark(context, {
    previousMode: previous.mode,
    newMode: "GUARD",
    activatedAt: next.activatedAt ?? nowIso(),
    blockedOperations: next.blockedOperations,
    allowedOperations: ["read"],
    deactivationCommand: "ds /careful or remove .dstack/safety-mode.json after review",
    reason: next.reason,
    permissionBehavior: "Write, execute, and destructive tool calls are denied. Read tools remain available."
  });
}

async function runCareful(context: SkillExecutionContext): Promise<JsonObject> {
  const manager = new SafetyModeManager({ dstackDir: context.config.dstackDir });
  const previous = await manager.read();
  const next = await manager.setMode("CAREFUL", "careful", str(context.invocation.inputs.reason, null));
  const dashboard = await new ReviewDashboard({ projectRoot: context.config.projectRoot, dstackDir: context.config.dstackDir }).compute();
  const deployState = await new DeployManager({ projectRoot: context.config.projectRoot, dstackDir: context.config.dstackDir }).readState();
  const gitStatus = await git(["status", "--porcelain"], context.config.projectRoot);
  const risks = [
    gitStatus.stdout.trim() ? "Uncommitted work is present; review diffs before write or deploy actions." : null,
    deployState.frozen ? `Deploy freeze is active${deployState.reason ? `: ${deployState.reason}` : "."}` : null,
    dashboard.staleArtifacts.length > 0 ? `${dashboard.staleArtifacts.length} stale artifact(s) should be refreshed before trusting downstream decisions.` : null,
    dashboard.openGates.length > 0 ? `Open workflow gates: ${dashboard.openGates.map((gate) => `/${gate}`).join(", ")}.` : null
  ].filter((item): item is string => Boolean(item));
  return mark(context, {
    previousMode: previous.mode,
    newMode: "CAREFUL",
    activatedAt: next.activatedAt ?? nowIso(),
    gatedOperations: next.gatedOperations,
    deactivationCommand: "ds /careful --off",
    riskList: risks,
    unsafeOperations: ["deploy", "git write operations", "file writes", "shell execution"].map((operation) => `${operation} requires explicit approval while CAREFUL is active`),
    recommendedChecks: topRecommendations([
      "Run /health before ship or deploy decisions.",
      gitStatus.stdout.trim() ? "Inspect git status and diff." : null,
      dashboard.staleArtifacts.length > 0 ? "Re-run stale review or QA skills before proceeding." : null,
      deployState.frozen ? "Resolve /freeze before deployment." : null
    ]),
    checked: ["safety mode", "git status", "artifact staleness", "workflow gates", "deploy freeze"],
    skipped: ["no write/execute actions were run"]
  });
}

async function runLearn(context: SkillExecutionContext): Promise<JsonObject> {
  const store = new LearningStore({ dstackDir: context.config.dstackDir });
  const mode = learnMode(context);
  if (mode === "add") {
    const insight = str(context.invocation.inputs.add, null) ?? str(context.invocation.inputs.insight, null) ?? "";
    const topic = str(context.invocation.inputs.topic, "general")!;
    validateLearningInput(insight, topic);
    const existing = await store.all();
    const duplicate = existing.find((entry) => sameLearning(entry.topic, entry.insight, topic, insight));
    if (duplicate) {
      return mark(context, { mode, entriesAffected: 0, entryId: duplicate.id, query: null, exportPath: null, results: [duplicate as unknown as JsonObject], learningStoreSize: existing.length, duplicate: true });
    }
    const entry = await store.add({ topic, insight: insight.trim(), originalText: insight, wasRephrased: false, appliesTo: csv(context.invocation.inputs["applies-to"]), source: "manual" });
    const all = await store.all();
    return mark(context, { mode, entriesAffected: 1, entryId: entry.id, query: null, exportPath: null, results: [entry as unknown as JsonObject], learningStoreSize: all.length, duplicate: false });
  }
  if (mode === "search") {
    const query = str(context.invocation.inputs.search, "")!;
    const results = await store.search(query);
    return mark(context, { mode, entriesAffected: results.length, entryId: null, query, exportPath: null, results: results.map((entry) => entry as unknown as JsonObject), learningStoreSize: (await store.all()).length });
  }
  if (mode === "prune") {
    const days = numberInput(context.invocation.inputs["older-than"], 90);
    const before = await store.all();
    const removed = await store.pruneOlderThanDays(days);
    return mark(context, { mode, entriesAffected: removed, entryId: null, query: `older-than:${days}`, exportPath: null, results: before.filter((entry) => Date.parse(entry.createdAt) < Date.now() - days * 24 * 60 * 60 * 1000).map((entry) => entry as unknown as JsonObject), learningStoreSize: (await store.all()).length });
  }
  if (mode === "export") {
    const entries = sortLearnings(await store.all());
    const exportPath = path.join(context.config.dstackDir, "memory", "learnings-export.md");
    await atomicWrite(exportPath, markdownForLearnings(entries));
    return mark(context, { mode, entriesAffected: entries.length, entryId: null, query: null, exportPath, results: entries.map((entry) => entry as unknown as JsonObject), learningStoreSize: entries.length });
  }
  const entries = sortLearnings(await store.all());
  return mark(context, { mode, entriesAffected: entries.length, entryId: null, query: null, exportPath: null, results: entries.map((entry) => entry as unknown as JsonObject), learningStoreSize: entries.length });
}

async function runSetupMemory(context: SkillExecutionContext): Promise<JsonObject> {
  const previous = await context.memoryStore.read();
  const previousHash = shortHash(JSON.stringify(previous ?? {}), 12);
  const now = nowIso();
  const importedFromRetro = bool(context.invocation.inputs["import-retro"]);
  const updatedFields: string[] = [];
  let memory = previous ?? defaultMemory(now);
  let addedDecisions = 0;
  let addedDomainTerms = 0;
  if (!previous) updatedFields.push("memory");
  if (importedFromRetro) {
    const retro = await context.artifactStore.readLatest("retro");
    if (!retro) throw new ArtifactError("/setup-memory --import-retro requires a /retro artifact.");
    for (const decision of objectArray(retro.content.keyDecisions)) {
      const text = str(decision.decision, null);
      if (text && !memory.keyDecisions.some((item) => item.decision === text)) {
        memory = { ...memory, keyDecisions: [...memory.keyDecisions, { decision: text, rationale: str(decision.rationale, "Imported from /retro.")!, date: now.slice(0, 10) }] };
        addedDecisions += 1;
      }
    }
    for (const entry of objectArray(retro.content.learningEntries)) {
      const topic = str(entry.topic, null);
      const insight = str(entry.insight, null);
      if (topic && insight && memory.domainTerms[topic] === undefined) {
        memory = { ...memory, domainTerms: { ...memory.domainTerms, [topic]: insight } };
        addedDomainTerms += 1;
      }
    }
    if (addedDecisions > 0) updatedFields.push("keyDecisions");
    if (addedDomainTerms > 0) updatedFields.push("domainTerms");
  }
  memory = { ...memory, updatedAt: now };
  await context.memoryStore.write(memory);
  const dstackPath = path.join(context.config.projectRoot, "DSTACK.md");
  const existingDstack = await readTextIfExists(dstackPath);
  const dstackBody = upsertDstackBlock(existingDstack, buildDstackBlock(memory));
  const dstackMdWritten = existingDstack !== dstackBody;
  if (dstackMdWritten) await atomicWrite(dstackPath, dstackBody);
  const routing = await loadDstackProjectContext(context.config.projectRoot);
  const newHash = shortHash(JSON.stringify(memory), 12);
  return mark(context, {
    updatedFields: unique(updatedFields),
    addedDecisions,
    addedDomainTerms,
    importedFromRetro,
    dstackMdWritten,
    memoryFilePath: context.memoryStore.memoryPath,
    previousMemoryHash: previousHash,
    newMemoryHash: newHash,
    dstackMdPath: dstackPath,
    promptInjectionReady: Boolean(routing),
    preservedUserSections: Boolean(existingDstack && !existingDstack.includes(DSTACK_BEGIN))
  });
}

async function runPlanTune(context: SkillExecutionContext): Promise<JsonObject> {
  const preferencesPath = path.join(context.config.dstackDir, "planning", "preferences.json");
  const preferences = await readPreferences(preferencesPath);
  const mode = planTunePreferenceMode(context);
  let nextPreferences = preferences;
  if (mode === "reset") {
    nextPreferences = { entries: [], updatedAt: nowIso() };
    await rm(preferencesPath, { force: true });
  } else if (mode === "update") {
    const question = str(context.invocation.inputs.question, null);
    const decision = str(context.invocation.inputs.decision, null) ?? str(context.invocation.inputs.preference, null);
    if (!question || !decision) throw new ValidationError("/plan-tune preference update requires --question and --decision.");
    nextPreferences = upsertPreference(preferences, question, decision);
    await atomicWrite(preferencesPath, JSON.stringify(nextPreferences, null, 2));
  }
  const autoplan = await context.artifactStore.requireLatest("autoplan");
  const reviews = await readReviewArtifacts(context, ["plan-ceo-review", "plan-eng-review", "plan-design-review", "plan-devex-review", "design-review", "devex-review"]);
  const tuned = new PlanTuner({ projectRoot: context.config.projectRoot, dstackDir: context.config.dstackDir }).tune({ autoplan: autoplan.content, reviews });
  return mark(context, {
    ...tuned,
    baseArtifactTimestamp: autoplan.createdAt,
    preferenceMode: mode,
    preferencesPath,
    preferenceState: nextPreferences as unknown as JsonObject,
    storedDecisionPreferences: nextPreferences.entries.length
  });
}

async function runFreeze(context: SkillExecutionContext): Promise<JsonObject> {
  const manager = new DeployManager({ projectRoot: context.config.projectRoot, dstackDir: context.config.dstackDir });
  const before = await manager.readState();
  const actor = str(context.invocation.inputs.actor, null) ?? process.env.USERNAME ?? process.env.USER ?? "dstack";
  const state = await manager.freeze(str(context.invocation.inputs.reason, null), str(context.invocation.inputs.until, null), str(context.invocation.inputs.path, null), actor);
  return mark(context, {
    frozen: state.frozen,
    frozenAt: state.frozenAt ?? nowIso(),
    reason: state.reason,
    frozenUntil: state.frozenUntil,
    pathScope: state.pathScope,
    actor: state.actor,
    unfreezeCommand: "ds /unfreeze",
    alreadyFrozen: before.frozen,
    deployStatePath: manager.statePath
  });
}

async function runUnfreeze(context: SkillExecutionContext): Promise<JsonObject> {
  const manager = new DeployManager({ projectRoot: context.config.projectRoot, dstackDir: context.config.dstackDir });
  const previous = await manager.unfreeze();
  return mark(context, {
    frozen: false,
    unfrozenAt: nowIso(),
    previousFreezeReason: previous.reason,
    previousFrozenSince: previous.frozenAt ?? "",
    previousFrozenUntil: previous.frozenUntil,
    previousPathScope: previous.pathScope,
    previousActor: previous.actor,
    deployStatePath: manager.statePath,
    hadActiveFreeze: previous.frozen
  });
}

async function runScrape(context: SkillExecutionContext): Promise<JsonObject> {
  const urls = unique(csv(context.invocation.inputs.urls).concat(str(context.invocation.inputs.url, null) ? [str(context.invocation.inputs.url, null)!] : []));
  if (urls.length === 0) throw new ValidationError("/scrape requires --url or --urls");
  const fields = csv(context.invocation.inputs.fields);
  const allowSensitive = bool(context.invocation.inputs["allow-sensitive-paths"]);
  const ignoreRobots = bool(context.invocation.inputs["ignore-robots"]);
  const skipped: Array<{ url: string; reason: string; robotsAllowed?: boolean; sensitivePath?: boolean }> = [];
  const data: JsonObject[] = [];
  const warnings: string[] = [];
  const robotsCache = new Map<string, RobotsDecision>();

  for (const url of urls) {
    const parsed = parseUrl(url);
    if (!parsed) {
      skipped.push({ url, reason: "Invalid URL." });
      continue;
    }
    const sensitive = isSensitiveUrl(parsed);
    if (sensitive && !allowSensitive) {
      skipped.push({ url, reason: "Sensitive path requires --allow-sensitive-paths approval.", sensitivePath: true });
      continue;
    }
    const robots = robotsCache.get(parsed.origin) ?? await readRobots(parsed);
    robotsCache.set(parsed.origin, robots);
    if (!robots.allowed && !ignoreRobots) {
      skipped.push({ url, reason: `Blocked by robots.txt rule: ${robots.rule}`, robotsAllowed: false, sensitivePath: sensitive });
      continue;
    }
    if (robots.warning) warnings.push(robots.warning);
    const scraped = await scrapeUrl(context, parsed.toString(), fields);
    data.push(scraped);
  }

  const dataFilePath = path.join(context.config.dstackDir, "scrape-data", `scrape-${shortHash(urls.join(","), 12)}.json`);
  await atomicWrite(dataFilePath, JSON.stringify(data, null, 2));
  const scrapedUrls = data.map((item) => String(item.url));
  return mark(context, {
    requestedUrls: urls,
    scrapedUrls,
    skippedUrls: skipped as unknown as JsonObject[],
    robotsRespected: !ignoreRobots,
    data,
    dataFilePath,
    warnings: skipped.length === urls.length ? ["No URLs were scraped; all requested URLs were blocked or invalid.", ...warnings] : warnings
  });
}

async function scrapeUrl(context: SkillExecutionContext, url: string, fields: string[]): Promise<JsonObject> {
  const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(url);
  if (local) {
    try {
      await context.toolExecutor.dispatch({ id: `open-${shortHash(url)}`, name: "browser_open", input: { url, session: str(context.invocation.inputs.session, "default")! } });
      const snapshot = await context.toolExecutor.dispatch({ id: `snapshot-${shortHash(url)}`, name: "browser_snapshot", input: { session: str(context.invocation.inputs.session, "default")! } });
      const screenshot = await context.toolExecutor.dispatch({ id: `screenshot-${shortHash(url)}`, name: "browser_screenshot", input: { label: "scrape", session: str(context.invocation.inputs.session, "default")! } });
      const text = str(snapshot.output.text, "")!;
      return scrapeFields(url, text, fields, str(screenshot.output.path, "")!, { detected: snapshot.output.promptInjectionDetected === true, fragments: stringArray(snapshot.output.promptInjectionFragments) });
    } catch (error) {
      return scrapeFields(url, `Browser scrape failed: ${error instanceof Error ? error.message : String(error)}`, fields, "", { detected: false, fragments: [] });
    }
  }
  const response = await fetch(url);
  const html = await response.text();
  const text = htmlToText(html);
  const scan = scanDomContent(text);
  return scrapeFields(url, scan.sanitized, fields, "", { detected: scan.detected, fragments: scan.fragments });
}

function scrapeFields(url: string, text: string, requestedFields: string[], screenshotPath: string, scanner: { detected: boolean; fragments: string[] }): JsonObject {
  const fields = requestedFields.length > 0 ? requestedFields : ["title", "summary"];
  const extracted: Record<string, string | string[] | null> = {};
  for (const field of fields) {
    if (field.toLowerCase() === "title") extracted[field] = text.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim().slice(0, 160) ?? null;
    else if (field.toLowerCase() === "links") extracted[field] = [...text.matchAll(/https?:\/\/\S+/g)].map((match) => match[0]!).slice(0, 20);
    else extracted[field] = extractLineForField(text, field) ?? (text.trim().slice(0, 280) || null);
  }
  return { url, fields: extracted, scrapedAt: nowIso(), screenshotPath, scannerFindings: { promptInjectionDetected: scanner.detected, fragments: scanner.fragments } };
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function healthVerdict(score: number, openGates: number, skillErrors: number): "HEALTHY" | "DEGRADED" | "CRITICAL" {
  if (score < 40 || skillErrors > 0) return "CRITICAL";
  if (score < 80 || openGates > 0) return "DEGRADED";
  return "HEALTHY";
}

function commitFrequency(recentCommitCount: number): string {
  if (recentCommitCount >= 10) return "daily";
  if (recentCommitCount >= 2) return "weekly";
  if (recentCommitCount === 1) return "infrequent";
  return "stale";
}

function topRecommendations(items: Array<string | null>): string[] {
  return unique(items.filter((item): item is string => Boolean(item))).slice(0, 3);
}

function healthSummary(score: number, openGates: number, staleCount: number, frozen: boolean, skillErrors: number, learningCount: number): string {
  const parts = [`Project health is ${score}/100.`];
  if (openGates > 0) parts.push(`${openGates} workflow gate(s) remain open.`);
  if (staleCount > 0) parts.push(`${staleCount} artifact(s) are stale.`);
  if (frozen) parts.push("Deploy freeze is active.");
  if (skillErrors > 0) parts.push(`${skillErrors} skill-check error(s) need attention.`);
  if (learningCount === 0) parts.push("No persistent learnings have been captured yet.");
  return parts.join(" ");
}

async function readLatestArtifacts(context: SkillExecutionContext, skillNames: string[]): Promise<Record<string, JsonObject>> {
  const output: Record<string, JsonObject> = {};
  for (const skillName of skillNames) {
    const artifact = await context.artifactStore.readLatest(skillName);
    if (artifact) output[skillName] = artifact.content;
  }
  return output;
}

function numberAt(value: JsonObject | null, key: string): number {
  const raw = value?.[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

function earliestGeneratedAt(artifacts: JsonObject[]): string | null {
  const dates = artifacts
    .map((artifact) => str(artifact.generatedAt, null))
    .filter((date): date is string => typeof date === "string" && !Number.isNaN(Date.parse(date)))
    .sort();
  return dates[0] ?? null;
}

function repeatedArtifactIssues(entries: Array<{ skillName: string; content: JsonObject }>): string[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const issues = [
      ...stringArray(entry.content.mustFixBeforeProceeding),
      ...stringArray(entry.content.blockers),
      ...stringArray(entry.content.criticalIssues),
      ...stringArray(entry.content.failedChecks)
    ];
    for (const issue of issues) counts.set(issue, (counts.get(issue) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1]).map(([issue, count]) => `${issue} (${count} mentions)`);
}

function retroLearningEntries(repeatedIssues: string[], qaFailures: number, reviewRejections: number): Array<{ topic: string; insight: string; appliesTo: string[] }> {
  const entries: Array<{ topic: string; insight: string; appliesTo: string[] }> = [];
  if (qaFailures > 0) entries.push({ topic: "qa", insight: `QA recorded ${qaFailures} failure(s); add targeted checks before the next /ship gate.`, appliesTo: ["qa", "review"] });
  if (reviewRejections > 0) entries.push({ topic: "review", insight: `Review artifacts contained ${reviewRejections} rejection or must-fix signal(s); address them with /plan-tune before implementation work expands.`, appliesTo: ["plan-tune", "review"] });
  for (const issue of repeatedIssues.slice(0, 2)) entries.push({ topic: "repeated-issue", insight: `Repeated issue observed across artifacts: ${issue}.`, appliesTo: ["retro", "health"] });
  if (entries.length === 0) entries.push({ topic: "shipping", insight: "This cycle had no repeated artifact issues; keep the current review and QA cadence.", appliesTo: ["retro", "health"] });
  return entries;
}

function hasDuplicateLearning(entries: Array<{ topic: string; insight: string }>, topic: string, insight: string): boolean {
  return entries.some((entry) => sameLearning(entry.topic, entry.insight, topic, insight));
}

function durationDays(start: string, end: string): number {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 0;
  return Math.max(0, Math.round((endMs - startMs) / (24 * 60 * 60 * 1000)));
}

function retroWentWell(artifacts: Record<string, JsonObject>, learningCount: number): string[] {
  const items = [
    artifacts.ship ? "/ship artifact exists for this cycle." : null,
    artifacts.qa?.overallVerdict === "PASS" ? "/qa passed before ship." : null,
    artifacts.review ? "/review produced a gate artifact." : null,
    learningCount > 0 ? `${learningCount} prior learning(s) were available.` : null
  ].filter((item): item is string => Boolean(item));
  return items.length > 0 ? items : ["Enough artifact history exists to start a retrospective."];
}

function retroWentPoorly(qaFailures: number, reviewRejections: number, repeatedIssues: string[]): string[] {
  const items = [
    qaFailures > 0 ? `${qaFailures} QA failure(s) were recorded.` : null,
    reviewRejections > 0 ? `${reviewRejections} review artifact(s) carried rejection or must-fix signals.` : null,
    repeatedIssues.length > 0 ? `Repeated issues: ${repeatedIssues.slice(0, 2).join("; ")}.` : null
  ].filter((item): item is string => Boolean(item));
  return items.length > 0 ? items : ["No repeated failure pattern was visible in current artifacts."];
}

function keyDecisionsFromArtifacts(artifacts: Record<string, JsonObject>): JsonObject[] {
  const decisions: JsonObject[] = [];
  for (const decision of objectArray(artifacts["office-hours"]?.openQuestions)) {
    decisions.push({ decision: str(decision.question, "Open office-hours decision")!, outcome: "NEUTRAL", rationale: str(decision.context, "Imported from office-hours artifact.")! });
  }
  for (const item of stringArray(artifacts.autoplan?.assumptionsMade).slice(0, 3)) {
    decisions.push({ decision: item, outcome: "NEUTRAL", rationale: "Autoplan assumption carried into cycle execution." });
  }
  if (decisions.length === 0) decisions.push({ decision: "No explicit decision artifact found", outcome: "NEUTRAL", rationale: "Add decisions through /learn or /setup-memory for better future retros." });
  return decisions;
}

function retroRecommendations(qaFailures: number, reviewRejections: number, repeatedIssues: string[], artifacts: Record<string, JsonObject>): string[] {
  return topRecommendations([
    qaFailures > 0 ? "Run /investigate immediately after failing /qa and capture the fix path." : null,
    reviewRejections > 0 ? "Use /plan-tune before re-running failed review gates." : null,
    repeatedIssues.length > 0 ? "Promote repeated retro issues into /learn so future prompts see them." : null,
    !artifacts.health ? "Run /health before the next cycle begins." : null,
    !artifacts["setup-memory"] ? "Run /setup-memory --import-retro to refresh DSTACK.md routing context." : null
  ]);
}

async function gitSummary(projectRoot: string): Promise<JsonObject> {
  const log = await git(["log", "-10", "--pretty=format:%h%x09%an%x09%cI%x09%s"], projectRoot);
  const rows = log.stdout.trim() ? log.stdout.trim().split(/\r?\n/) : [];
  const authors = new Map<string, number>();
  for (const row of rows) {
    const [, author = "unknown"] = row.split("\t");
    authors.set(author, (authors.get(author) ?? 0) + 1);
  }
  return { recentCommits: rows, authorBreakdown: [...authors.entries()].map(([author, commits]) => ({ author, commits })) };
}

function learnMode(context: SkillExecutionContext): "add" | "search" | "prune" | "export" | "list" {
  if (str(context.invocation.inputs.add, null) || str(context.invocation.inputs.insight, null)) return "add";
  if (str(context.invocation.inputs.search, null)) return "search";
  if (bool(context.invocation.inputs.prune)) return "prune";
  if (bool(context.invocation.inputs.export)) return "export";
  return "list";
}

function validateLearningInput(insight: string, topic: string): void {
  if (topic.trim().length < 2) throw new ValidationError("/learn requires a topic of at least 2 characters.");
  if (insight.trim().length < 8) throw new ValidationError("/learn requires a specific insight of at least 8 characters.");
}

function sameLearning(leftTopic: string, leftInsight: string, rightTopic: string, rightInsight: string): boolean {
  return leftTopic.trim().toLowerCase() === rightTopic.trim().toLowerCase() && leftInsight.trim().toLowerCase() === rightInsight.trim().toLowerCase();
}

function numberInput(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sortLearnings<T extends { topic: string; createdAt: string; insight: string }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => `${a.topic}\0${a.createdAt}\0${a.insight}`.localeCompare(`${b.topic}\0${b.createdAt}\0${b.insight}`));
}

function markdownForLearnings(entries: Array<{ topic: string; insight: string; appliesTo: string[]; source: string; createdAt: string }>): string {
  const rows = entries.map((entry) => `| ${escapeCell(entry.topic)} | ${escapeCell(entry.insight)} | ${escapeCell(entry.appliesTo.join(", "))} | ${escapeCell(entry.source)} | ${escapeCell(entry.createdAt)} |`);
  return ["# DStack Learnings", "", "| Topic | Insight | Applies To | Source | Created At |", "| --- | --- | --- | --- | --- |", ...rows, ""].join("\n");
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function defaultMemory(now: string): ProjectMemory {
  return {
    version: "1",
    projectName: "DStack Project",
    createdAt: now,
    updatedAt: now,
    techStack: { frontend: "", backend: "", database: "", infra: "", testing: "" },
    goals: [],
    constraints: [],
    keyDecisions: [],
    domainTerms: {},
    openQuestions: []
  };
}

async function readTextIfExists(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

const DSTACK_BEGIN = "<!-- DSTACK:BEGIN -->";
const DSTACK_END = "<!-- DSTACK:END -->";

function buildDstackBlock(memory: ProjectMemory): string {
  const lines = [
    DSTACK_BEGIN,
    "# DStack Project Context",
    "",
    `Project: ${memory.projectName}`,
    "",
    "## Routing Hints",
    "- Planning or scope changes: run /office-hours, /autoplan, then review gates.",
    "- Implementation risk: run /review and /qa before /ship.",
    "- Repeated project lessons: search /learn before starting a new cycle.",
    "- Deployment decisions: check /health and /freeze before /land-and-deploy.",
    "",
    "## Goals",
    ...listOrPlaceholder(memory.goals),
    "",
    "## Constraints",
    ...listOrPlaceholder(memory.constraints),
    "",
    "## Tech Stack",
    `- Frontend: ${memory.techStack.frontend || "unspecified"}`,
    `- Backend: ${memory.techStack.backend || "unspecified"}`,
    `- Database: ${memory.techStack.database || "unspecified"}`,
    `- Infra: ${memory.techStack.infra || "unspecified"}`,
    `- Testing: ${memory.techStack.testing || "unspecified"}`,
    "",
    "## Domain Terms",
    ...domainTermLines(memory.domainTerms),
    DSTACK_END,
    ""
  ];
  return lines.join("\n");
}

function listOrPlaceholder(items: string[]): string[] {
  return items.length > 0 ? items.map((item) => `- ${item}`) : ["- unspecified"];
}

function domainTermLines(terms: Record<string, string>): string[] {
  const entries = Object.entries(terms).sort(([left], [right]) => left.localeCompare(right));
  return entries.length > 0 ? entries.map(([topic, insight]) => `- ${topic}: ${insight}`) : ["- unspecified"];
}

function upsertDstackBlock(existing: string | null, block: string): string {
  if (!existing) return `${block}`;
  const start = existing.indexOf(DSTACK_BEGIN);
  const end = existing.indexOf(DSTACK_END);
  if (start >= 0 && end >= start) {
    return `${existing.slice(0, start)}${block}${existing.slice(end + DSTACK_END.length).replace(/^\s*/, "\n")}`;
  }
  return `${existing.trimEnd()}\n\n${block}`;
}

interface PlanTunePreferenceState {
  entries: Array<{ question: string; decision: string; updatedAt: string }>;
  updatedAt: string;
}

async function readPreferences(filePath: string): Promise<PlanTunePreferenceState> {
  try {
    const raw = JSON.parse(await readFile(filePath, "utf8")) as unknown;
    if (!objectValue(raw)) return { entries: [], updatedAt: nowIso() };
    const entries = objectArray((raw as JsonObject).entries)
      .map((entry) => ({ question: str(entry.question, "")!, decision: str(entry.decision, "")!, updatedAt: str(entry.updatedAt, nowIso())! }))
      .filter((entry) => entry.question.length > 0 && entry.decision.length > 0);
    return { entries, updatedAt: str((raw as JsonObject).updatedAt, nowIso())! };
  } catch {
    return { entries: [], updatedAt: nowIso() };
  }
}

function planTunePreferenceMode(context: SkillExecutionContext): "apply" | "list" | "update" | "reset" {
  if (bool(context.invocation.inputs.reset)) return "reset";
  if (bool(context.invocation.inputs.list)) return "list";
  if (str(context.invocation.inputs.question, null) || str(context.invocation.inputs.decision, null) || str(context.invocation.inputs.preference, null)) return "update";
  return "apply";
}

function upsertPreference(state: PlanTunePreferenceState, question: string, decision: string): PlanTunePreferenceState {
  const updatedAt = nowIso();
  const existing = state.entries.filter((entry) => entry.question.trim().toLowerCase() !== question.trim().toLowerCase());
  return { entries: [...existing, { question: question.trim(), decision: decision.trim(), updatedAt }], updatedAt };
}

async function readReviewArtifacts(context: SkillExecutionContext, skillNames: string[]): Promise<Record<string, JsonObject>> {
  const reviews: Record<string, JsonObject> = {};
  for (const skillName of skillNames) {
    const artifact = await context.artifactStore.readLatest(skillName);
    if (artifact) reviews[skillName] = artifact.content;
  }
  return reviews;
}

async function executeCommand(context: SkillExecutionContext, command: string, timeout: number): Promise<{ output: string; exitCode: number }> {
  try {
    const result = await context.toolExecutor.dispatch({ id: `cmd-${shortHash(command)}`, name: "run_command", input: { command, timeout } });
    return { output: [str(result.output.stdout, ""), str(result.output.stderr, ""), result.error ?? ""].filter(Boolean).join("\n"), exitCode: Number(result.output.exitCode ?? (result.success ? 0 : 1)) };
  } catch (error) {
    return { output: error instanceof Error ? error.message : String(error), exitCode: 1 };
  }
}

async function pollHealth(url: string, timeoutSeconds: number, intervalSeconds: number): Promise<{ verdict: "PASS" | "FAIL" | "SKIPPED" | "TIMEOUT"; attempts: number; output: string }> {
  const deadline = Date.now() + Math.max(1, Math.min(timeoutSeconds, 120)) * 1000;
  const intervalMs = Math.max(1000, Math.min(intervalSeconds * 1000, 5000));
  let attempts = 0;
  let last = "";
  while (Date.now() <= deadline && attempts < 5) {
    attempts += 1;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      last = `${response.status} ${response.statusText}`;
      if (response.ok) return { verdict: "PASS", attempts, output: last };
      if (response.status >= 500) return { verdict: "FAIL", attempts, output: last };
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    if (Date.now() + intervalMs <= deadline) await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return { verdict: attempts > 0 ? "TIMEOUT" : "FAIL", attempts, output: last };
}

async function detectDeployPlatform(projectRoot: string): Promise<{ platform: string; deployCommand: string; dryRunCommand: string; warnings: string[] }> {
  if (await exists(path.join(projectRoot, "vercel.json"))) return { platform: "vercel", deployCommand: "npx vercel deploy", dryRunCommand: "npx vercel deploy --prebuilt --dry-run", warnings: [] };
  if (await exists(path.join(projectRoot, "fly.toml"))) return { platform: "fly", deployCommand: "fly deploy", dryRunCommand: "fly deploy --dry-run", warnings: [] };
  if (await exists(path.join(projectRoot, "railway.json"))) return { platform: "railway", deployCommand: "railway up", dryRunCommand: "railway status", warnings: [] };
  const packageJson = await readPackageJson(projectRoot);
  const scripts = objectValue(packageJson?.scripts);
  if (scripts && typeof scripts.deploy === "string") {
    return { platform: "custom", deployCommand: "pnpm run deploy", dryRunCommand: typeof scripts["deploy:dry-run"] === "string" ? "pnpm run deploy:dry-run" : "pnpm run deploy -- --dry-run", warnings: [] };
  }
  return { platform: "custom", deployCommand: "echo dstack deploy", dryRunCommand: "echo dstack deploy dry-run", warnings: ["No deployment platform was detected; using safe echo defaults."] };
}

async function readPackageJson(projectRoot: string): Promise<JsonObject | null> {
  try {
    const parsed = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8")) as unknown;
    return objectValue(parsed);
  } catch {
    return null;
  }
}

async function loadSuiteOrDefault(runner: BenchmarkRunner, suiteName: string): Promise<BenchmarkSuite> {
  return runner.loadSuite(suiteName).catch(() => defaultSuite(suiteName));
}

async function writeResult(context: SkillExecutionContext, output: JsonObject): Promise<SkillRunResult> {
  const artifact = context.invocation.flags.dryRun ? null : await context.artifactStore.write(context.manifest.name, output);
  return { skillName: context.manifest.name, status: "complete", verdict: extractVerdict(output), artifactPath: artifact?.filePath ?? null, output, nextSkill: nextSkillFor(context, output), warnings: context.invocation.flags.force ? ["Stage gates bypassed with --force."] : [] };
}

function nextSkillFor(context: SkillExecutionContext, output: JsonObject): string | null {
  if (context.manifest.name === "land-and-deploy" && output.deployVerdict === "FAIL") return "investigate";
  return context.manifest.nextSkill;
}

function extractVerdict(output: JsonObject): Verdict | null {
  const value = output.overallVerdict ?? output.verdict ?? output.deployVerdict;
  if (value === "PASS" || value === "REVISE" || value === "FAIL") return value;
  return null;
}

function mark(context: SkillExecutionContext, output: JsonObject): JsonObject {
  return context.generatedBy ? { ...output, generated_by: context.generatedBy } : output;
}

function requiredStr(context: SkillExecutionContext, key: string): string {
  const value = str(context.invocation.inputs[key], null);
  if (!value) throw new ValidationError(`/${context.manifest.name} requires --${key}`);
  return value;
}

function str(value: unknown, fallback: string | null): string | null {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function bool(value: unknown): boolean {
  return value === true || value === "true";
}

function csv(value: unknown): string[] {
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) return value;
  if (typeof value !== "string" || value.length === 0) return [];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
}

function objectArray(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.filter(objectValue) : [];
}

function objectValue(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : null;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function titleWords(text: string, max: number): string {
  const words = text.replace(/[^a-z0-9\s-]/gi, " ").split(/\s+/).filter(Boolean).slice(0, max);
  return words.length > 0 ? words.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(" ") : "Primary Workflow";
}

function visualDirection(preferences: Array<{ variantName: string; weight: number }>, fallback: string): string {
  return preferences.length > 0 ? `${fallback}; biased by approved taste signals: ${preferences.map((item) => item.variantName).join(", ")}` : fallback;
}

function variant(name: string, layoutParadigm: string, componentPhilosophy: string, interactionModel: string, visualDirectionText: string, components: string[], userFlows: string[], advantages: string[], disadvantages: string[], bestFor: string): JsonObject {
  return { name, layoutParadigm, componentPhilosophy, interactionModel, visualDirection: visualDirectionText, components, userFlows, advantages, disadvantages, tradeoffs: { advantages, disadvantages }, bestFor, htmlPrototypePath: null };
}

function bestBy(items: JsonObject[], key: string): string {
  const sorted = [...items].sort((a, b) => Number(b[key] ?? 0) - Number(a[key] ?? 0));
  return str(sorted[0]?.model, "not_evaluated")!;
}

function bestByLowest(items: JsonObject[], key: string): string {
  const sorted = [...items].filter((item) => Number(item[key] ?? 0) > 0).sort((a, b) => Number(a[key] ?? 0) - Number(b[key] ?? 0));
  return str(sorted[0]?.model, "not_evaluated")!;
}

function modelResultToPromptResult(item: JsonObject) {
  return { promptId: String(item.model), model: String(item.model), prompt: "", response: "", qualityScore: Number(item.avgQualityScore ?? 0), latencyMs: Number(item.avgLatencyMs ?? 0), inputTokens: 0, outputTokens: Number(item.totalTokensUsed ?? 0), criteriaScores: [], error: null };
}

function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function isSensitiveUrl(url: URL): boolean {
  return /\/(checkout|payment|billing|admin)(\/|$)/i.test(url.pathname);
}

interface RobotsDecision {
  allowed: boolean;
  rule: string;
  warning: string | null;
}

async function readRobots(url: URL): Promise<RobotsDecision> {
  const robotsUrl = new URL("/robots.txt", url.origin);
  try {
    const response = await fetch(robotsUrl);
    if (!response.ok) return { allowed: true, rule: "robots.txt unavailable", warning: `robots.txt returned ${response.status} for ${url.origin}; scrape proceeded cautiously.` };
    const body = await response.text();
    const rule = disallowRuleFor(body, url.pathname);
    return rule ? { allowed: false, rule, warning: null } : { allowed: true, rule: "", warning: null };
  } catch (error) {
    return { allowed: true, rule: "robots.txt fetch failed", warning: `robots.txt fetch failed for ${url.origin}: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function disallowRuleFor(robots: string, pathname: string): string | null {
  let applies = false;
  for (const rawLine of robots.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const [fieldRaw, ...valueParts] = line.split(":");
    const field = fieldRaw?.trim().toLowerCase();
    const value = valueParts.join(":").trim();
    if (field === "user-agent") applies = value === "*";
    if (applies && field === "disallow" && value && pathname.startsWith(value)) return value;
  }
  return null;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function extractLineForField(text: string, field: string): string | null {
  const pattern = new RegExp(`\\b${escapeRegex(field)}\\b`, "i");
  return text.split(/\r?\n/).find((line) => pattern.test(line))?.trim().slice(0, 280) ?? null;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
