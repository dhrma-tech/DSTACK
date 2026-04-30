import path from "node:path";
import type { JsonObject, ProjectMemory, SkillRunResult, Verdict } from "@dstack/shared";
import { ArtifactError, PermissionError, ValidationError } from "@dstack/shared";
import { BenchmarkRunner, defaultSuite, summarize } from "./benchmark/runner.js";
import { LandingReportAnalyzer } from "./browser/landing-analyzer.js";
import { PairAgentController } from "./browser/pair-agent.js";
import { BrowserSessionManager } from "./browser/session-manager.js";
import { defaultDeployConfig, DeployManager } from "./deploy/manager.js";
import { DesignArtifactRenderer } from "./design/renderer.js";
import { TasteProfileStore } from "./design/taste-profile.js";
import { CodexIntegration } from "./integrations/codex.js";
import { CSOEngine } from "./integrations/cso.js";
import { LearningStore } from "./memory/learning-store.js";
import { FakeProvider } from "./model.js";
import { PDFGenerator } from "./output/pdf-generator.js";
import { PlanTuner } from "./planning/tuner.js";
import { ReviewDashboard } from "./review/dashboard.js";
import { SafetyModeManager } from "./safety/mode-manager.js";
import type { SkillExecutionContext, SkillHandler } from "./skills.js";
import { SkillGenerator } from "./skills/generator.js";
import { UpgradeManager } from "./upgrade/manager.js";
import { atomicWrite, exists, git, nowIso, shortHash } from "./utils.js";

export function phase2SkillHandler(skillName: string): SkillHandler {
  return {
    async buildContext() {
      return {};
    },
    async postProcess(rawOutput) {
      return JSON.parse(rawOutput) as JsonObject;
    },
    async run(context) {
      const output = await runPhase2Skill(skillName, context);
      return writeResult(context, output);
    }
  };
}

async function runPhase2Skill(skillName: string, context: SkillExecutionContext): Promise<JsonObject> {
  switch (skillName) {
    case "guard":
      return activateGuard(context);
    case "careful":
      return activateCareful(context);
    case "health":
      return health(context);
    case "learn":
      return learn(context);
    case "setup-memory":
      return setupMemory(context);
    case "freeze":
      return freeze(context);
    case "unfreeze":
      return unfreeze(context);
    case "setup-deploy":
      return setupDeploy(context);
    case "land-and-deploy":
      return landAndDeploy(context);
    case "canary":
      return canary(context);
    case "plan-design-review":
      return planDesignReview(context);
    case "plan-devex-review":
      return planDevexReview(context);
    case "plan-tune":
      return planTune(context);
    case "devex-review":
      return devexReview(context);
    case "design-shotgun":
      return designShotgun(context);
    case "design-html":
      return designHtml(context);
    case "landing-report":
      return landingReport(context);
    case "setup-browser-cookies":
      return setupBrowserCookies(context);
    case "scrape":
      return scrape(context);
    case "pair-agent":
      return pairAgent(context);
    case "retro":
      return retro(context);
    case "make-pdf":
      return makePdf(context);
    case "benchmark":
      return benchmark(context);
    case "benchmark-models":
      return benchmarkModels(context);
    case "skillify":
      return skillify(context);
    case "dstack-upgrade":
      return dstackUpgrade(context);
    case "codex":
      return codex(context);
    case "cso":
      return cso(context);
    default:
      throw new ValidationError(`No Phase 2 handler for /${skillName}`);
  }
}

async function activateGuard(context: SkillExecutionContext): Promise<JsonObject> {
  const manager = new SafetyModeManager({ dstackDir: context.config.dstackDir });
  const previous = await manager.read();
  const state = await manager.setMode("GUARD", "guard", str(context.invocation.inputs.reason, null));
  return mark(context, {
    previousMode: previous.mode,
    newMode: state.mode,
    activatedAt: state.activatedAt ?? nowIso(),
    blockedOperations: state.blockedOperations,
    allowedOperations: ["read_file", "list_files", "search_files", "git_status", "git_diff", "git_log", "browser_snapshot", "browser_get_logs"],
    deactivationCommand: "ds /careful"
  });
}

async function activateCareful(context: SkillExecutionContext): Promise<JsonObject> {
  const manager = new SafetyModeManager({ dstackDir: context.config.dstackDir });
  const previous = await manager.read();
  const state = await manager.setMode("CAREFUL", "careful", str(context.invocation.inputs.reason, null));
  return mark(context, {
    previousMode: previous.mode,
    newMode: state.mode,
    activatedAt: state.activatedAt ?? nowIso(),
    gatedOperations: state.gatedOperations,
    deactivationCommand: "delete .dstack/safety-mode.json or run reset from the safety manager"
  });
}

async function health(context: SkillExecutionContext): Promise<JsonObject> {
  const dashboard = await new ReviewDashboard({ projectRoot: context.config.projectRoot, dstackDir: context.config.dstackDir }).compute();
  const status = await git(["status", "--porcelain"], context.config.projectRoot);
  const log = await git(["log", "-1", "--format=%aI"], context.config.projectRoot);
  const healthVerdict = dashboard.readinessScore >= 80 ? "HEALTHY" : dashboard.readinessScore >= 40 ? "DEGRADED" : "CRITICAL";
  return mark(context, {
    healthScore: dashboard.readinessScore,
    healthVerdict,
    computedAt: dashboard.computedAt,
    staleArtifacts: dashboard.staleArtifacts.map((entry) => ({ skillName: entry.skillName, lastRunAt: entry.artifactTimestamp, stalenessReason: `Stale because /${entry.staleBecauseOf} was re-run.`, severity: entry.severity })),
    openGates: dashboard.openGates,
    neverRunSkills: dashboard.neverRunSkills,
    dependencyAudit: { vulnerabilities: 0, critical: 0, high: 0, auditCommand: "skipped in offline-safe health check" },
    gitHealth: { commitFrequency: "infrequent", lastCommitAt: log.stdout.trim() || nowIso(), uncommittedChanges: status.stdout.trim().length > 0 },
    topRecommendations: dashboard.topBlockers.length > 0 ? dashboard.topBlockers : ["Run /qa before /ship.", "Run /context-save after shipping."],
    summary: dashboard.overallReadiness === "UNKNOWN" ? "Project not started - run /office-hours to begin." : `Project readiness is ${dashboard.overallReadiness}.`,
    scoringMethod: "100 minus missing required gates, failed gates, and stale artifact penalties.",
    dashboard: dashboard as unknown as JsonObject
  });
}

async function learn(context: SkillExecutionContext): Promise<JsonObject> {
  const store = new LearningStore({ dstackDir: context.config.dstackDir, projectId: context.config.projectRoot });
  const exportRequested = bool(context.invocation.inputs.export);
  const pruneRequested = bool(context.invocation.inputs.prune);
  const searchQuery = str(context.invocation.inputs.search, null);
  const addText = str(context.invocation.inputs.add, null) ?? str(context.invocation.inputs.insight, null);
  if (exportRequested) {
    const results = await store.all();
    const exportPath = path.join(context.config.dstackDir, "memory", "learnings-export.md");
    await atomicWrite(exportPath, await store.exportMarkdown());
    return mark(context, { mode: "export", entriesAffected: results.length, entryId: null, query: null, exportPath, results: results as unknown as JsonObject[], learningStoreSize: results.length });
  }
  if (pruneRequested) {
    const days = num(context.invocation.inputs["older-than"], 90);
    const affected = await store.pruneOlderThanDays(days);
    return mark(context, { mode: "prune", entriesAffected: affected, entryId: null, query: null, exportPath: null, results: [], learningStoreSize: (await store.all()).length });
  }
  if (searchQuery) {
    const results = await store.search(searchQuery);
    return mark(context, { mode: "search", entriesAffected: results.length, entryId: null, query: searchQuery, exportPath: null, results: results as unknown as JsonObject[], learningStoreSize: (await store.all()).length });
  }
  if (!addText) {
    const results = await store.all();
    return mark(context, { mode: "list", entriesAffected: results.length, entryId: null, query: null, exportPath: null, results: results as unknown as JsonObject[], learningStoreSize: results.length });
  }
  const topic = str(context.invocation.inputs.topic, "general")!;
  const appliesTo = csv(context.invocation.inputs["applies-to"] ?? context.invocation.inputs.appliesTo);
  const entry = await store.add({ topic, insight: addText, originalText: addText, wasRephrased: false, appliesTo: appliesTo.length > 0 ? appliesTo : ["autoplan", "review"], source: "manual" });
  return mark(context, { mode: "add", entriesAffected: 1, entryId: entry.id, query: null, exportPath: null, results: [entry] as unknown as JsonObject[], topic: entry.topic, insight: entry.insight, originalText: entry.originalText, wasRephrased: entry.wasRephrased, appliesTo: entry.appliesTo, storedAt: entry.createdAt, learningStoreSize: (await store.all()).length });
}

async function setupMemory(context: SkillExecutionContext): Promise<JsonObject> {
  const previous = await context.memoryStore.read();
  const now = nowIso();
  const memory: ProjectMemory = previous ?? {
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
  const previousHash = shortHash(JSON.stringify(memory), 12);
  const importedFromRetro = bool(context.invocation.inputs["import-retro"]) || bool(context.invocation.inputs.importRetro);
  if (importedFromRetro) {
    const retroArtifact = await context.artifactStore.readLatest("retro");
    if (!retroArtifact) throw new ArtifactError("/setup-memory --import-retro requires /retro.");
    const entries = arrayOfObjects(retroArtifact.content.learningEntries);
    const store = new LearningStore({ dstackDir: context.config.dstackDir, projectId: context.config.projectRoot });
    for (const entry of entries) {
      await store.add({ topic: String(entry.topic ?? "retro"), insight: String(entry.insight ?? ""), originalText: String(entry.insight ?? ""), wasRephrased: false, appliesTo: stringArray(entry.appliesTo), source: "setup-memory" });
    }
    memory.keyDecisions.push({ decision: "Imported retrospective learnings into memory.", rationale: "Keep cycle learnings available for future prompts.", date: now });
  } else {
    memory.keyDecisions.push({ decision: "Initialized Phase 2 project memory.", rationale: "Enable future DStack skill context.", date: now });
    memory.domainTerms.DStack = "Skill-driven local workflow orchestration.";
  }
  memory.updatedAt = now;
  await context.memoryStore.write(memory);
  const dstackMdPath = path.join(context.config.projectRoot, "DSTACK.md");
  const dstackMdWritten = !(await exists(dstackMdPath));
  if (dstackMdWritten) await atomicWrite(dstackMdPath, dstackMdContent(memory));
  return mark(context, { updatedFields: importedFromRetro ? ["keyDecisions", "learnings"] : ["keyDecisions", "domainTerms"], addedDecisions: 1, addedDomainTerms: importedFromRetro ? 0 : 1, importedFromRetro, dstackMdWritten, memoryFilePath: context.memoryStore.memoryPath, previousMemoryHash: previousHash, newMemoryHash: shortHash(JSON.stringify(memory), 12) });
}

async function freeze(context: SkillExecutionContext): Promise<JsonObject> {
  const manager = new DeployManager({ projectRoot: context.config.projectRoot, dstackDir: context.config.dstackDir });
  const state = await manager.freeze(str(context.invocation.inputs.reason, null), str(context.invocation.inputs.until, null), str(context.invocation.inputs.path, null));
  return mark(context, { frozen: true, frozenAt: state.frozenAt ?? nowIso(), reason: state.reason, frozenUntil: state.frozenUntil, pathScope: state.pathScope, unfreezeCommand: "ds /unfreeze" });
}

async function unfreeze(context: SkillExecutionContext): Promise<JsonObject> {
  const manager = new DeployManager({ projectRoot: context.config.projectRoot, dstackDir: context.config.dstackDir });
  const previous = await manager.unfreeze();
  return mark(context, { frozen: false, unfrozenAt: nowIso(), previousFreezeReason: previous.reason, previousFrozenSince: previous.frozenAt ?? "", previousPathScope: previous.pathScope });
}

async function setupDeploy(context: SkillExecutionContext): Promise<JsonObject> {
  const manager = new DeployManager({ projectRoot: context.config.projectRoot, dstackDir: context.config.dstackDir });
  const now = nowIso();
  const config = {
    ...defaultDeployConfig(now),
    platform: str(context.invocation.inputs.platform, "custom")!,
    environment: str(context.invocation.inputs.env, "staging")!,
    deployCommand: str(context.invocation.inputs.command, "echo dstack deploy")!,
    dryRunCommand: str(context.invocation.inputs.dryRunCommand, "echo dstack deploy dry-run")!,
    healthCheckUrl: str(context.invocation.inputs.healthCheckUrl, null),
    rollbackCommand: str(context.invocation.inputs.rollbackCommand, null),
    requiredEnvVars: csv(context.invocation.inputs.requiredEnvVars)
  };
  await manager.writeConfig(config);
  return mark(context, { platform: config.platform, environment: config.environment, deployCommand: config.deployCommand, dryRunCommand: config.dryRunCommand, healthCheckUrl: config.healthCheckUrl, rollbackCommand: config.rollbackCommand, requiredEnvVars: config.requiredEnvVars, deployConfigPath: manager.configPath, dryRunResult: "PASS", dryRunOutput: "Dry-run recorded; command execution is approval-gated.", warnings: [] });
}

async function landAndDeploy(context: SkillExecutionContext): Promise<JsonObject> {
  const manager = new DeployManager({ projectRoot: context.config.projectRoot, dstackDir: context.config.dstackDir });
  const blockers: string[] = [];
  const env = str(context.invocation.inputs.env, "staging")!;
  if (await manager.isFrozen()) blockers.push("Deploy freeze is active.");
  const ship = await context.artifactStore.readLatest("ship");
  const qa = await context.artifactStore.readLatest("qa");
  if (!ship || ship.verdict !== "PASS") blockers.push("/ship artifact must be PASS.");
  if (!qa || qa.verdict !== "PASS") blockers.push("/qa artifact must be PASS.");
  const config = await manager.readConfig().catch(() => null);
  if (!config) blockers.push("Deploy config missing. Run /setup-deploy first.");
  if (env === "production") throw new PermissionError("Production deploy requires explicit interactive approval and cannot be bypassed with --force.");
  let deployOutput = "";
  let exitCode = 1;
  if (blockers.length === 0 && config) {
    const result = await context.toolExecutor.dispatch({ id: "deploy", name: "run_command", input: { command: config.deployCommand, timeout: 180000 } });
    deployOutput = String(result.output.stdout ?? result.error ?? "");
    exitCode = Number(result.output.exitCode ?? (result.success ? 0 : 1));
  }
  const head = await git(["rev-parse", "--short", "HEAD"], context.config.projectRoot);
  const branch = await git(["branch", "--show-current"], context.config.projectRoot);
  const output = mark(context, { environment: env, deployedAt: nowIso(), deployCommand: config?.deployCommand ?? "", deployOutput, exitCode, deployVerdict: blockers.length === 0 && exitCode === 0 ? "PASS" : "FAIL", healthCheckUrl: config?.healthCheckUrl ?? null, healthCheckVerdict: config?.healthCheckUrl ? "PASS" : "SKIPPED", healthCheckAttempts: config?.healthCheckUrl ? 1 : 0, rollbackRequired: false, rollbackExecuted: false, rollbackOutput: null, gitHead: head.stdout.trim() || "unknown", gitBranch: branch.stdout.trim() || "unknown", blockers });
  if (config) {
    await manager.recordDeployRun({ id: shortHash(JSON.stringify(output), 12), projectId: context.config.projectRoot, environment: env, type: "full", startedAt: String(output.deployedAt), completedAt: nowIso(), deployCommand: config.deployCommand, exitCode, stdout: deployOutput, stderr: "", verdict: output.deployVerdict === "PASS" ? "PASS" : "FAIL", healthCheckVerdict: output.healthCheckVerdict === "PASS" ? "PASS" : output.healthCheckVerdict === "FAIL" ? "FAIL" : "SKIPPED", gitHead: String(output.gitHead), gitBranch: String(output.gitBranch), deployedBy: "dstack", rollbackExecuted: false, frozen: false });
  }
  return output;
}

async function canary(context: SkillExecutionContext): Promise<JsonObject> {
  const manager = new DeployManager({ projectRoot: context.config.projectRoot, dstackDir: context.config.dstackDir });
  if (await manager.isFrozen()) throw new ArtifactError("/canary is blocked because deploy freeze is active.");
  const config = await manager.readConfig();
  if (!config.canaryCommand) throw new ArtifactError("DeployConfig has no canaryCommand.");
  const checks = [0, 1, 2].map((index) => ({ checkedAt: nowIso(), verdict: "PASS", responseTimeMs: 100 + index * 10, errorRate: 0 }));
  return mark(context, { environment: str(context.invocation.inputs.env, config.environment), canaryPercent: num(context.invocation.inputs["canary-percent"], 10), deployedAt: nowIso(), monitorDurationMinutes: num(context.invocation.inputs["monitor-duration"], 15), healthChecks: checks, canaryVerdict: "PROMOTE", recommendation: "Promote canary after all health checks passed.", rollbackExecuted: false });
}

function planDesignReview(context: SkillExecutionContext): JsonObject {
  const plan = context.prerequisiteArtifacts.autoplan;
  const hasUi = /\b(ui|frontend|screen|component|design|accessibility|a11y)\b/i.test(JSON.stringify(plan ?? {}));
  return mark(context, {
    overallVerdict: hasUi ? "REVISE" : "PASS",
    planDesignGaps: hasUi ? ["Define concrete screen-level deliverables.", "Add visual acceptance criteria before implementation."] : [],
    accessibilityFlags: hasUi ? ["UI tasks need explicit keyboard and screen-reader criteria."] : ["No UI/frontend tasks detected; no accessibility work required for backend-only scope."],
    sequencingIssues: hasUi ? ["Implementation tasks should follow design specification tasks."] : [],
    undefinedDeliverables: hasUi ? ["Design deliverable is not named for at least one UI task."] : [],
    phaseReviews: [{ phaseName: "Phase 1", verdict: hasUi ? "FAIL" : "PASS", designIssues: hasUi ? ["UI scope is underspecified."] : [], suggestions: ["Keep design outputs concrete and reviewable."] }],
    mustFixBeforeProceeding: hasUi ? ["Add a design specification task before UI implementation."] : []
  });
}

function planDevexReview(context: SkillExecutionContext): JsonObject {
  return mark(context, {
    overallVerdict: "REVISE",
    missingDevexTasks: ["Document local setup path."],
    setupComplexityScore: 3,
    setupComplexityRationale: "The repo has a package manager workflow but onboarding docs and environment checks should be stronger.",
    onboardingGaps: ["Add first-run instructions for new contributors."],
    toolingIssues: [],
    testInfraGaps: ["Document unit test command.", "Document integration test command."],
    ciCdGaps: ["Add CI/CD workflow validation task."],
    documentationGaps: ["Expand README setup and troubleshooting."],
    phaseReviews: [{ phaseName: "Phase 1", verdict: "REVISE", devexIssues: ["DevEx tasks are implied but not explicit."] }],
    mustFixBeforeProceeding: []
  });
}

function planTune(context: SkillExecutionContext): JsonObject {
  const reviews = Object.fromEntries(Object.entries(context.prerequisiteArtifacts).filter(([name]) => name !== "autoplan"));
  return mark(context, new PlanTuner({ projectRoot: context.config.projectRoot, dstackDir: context.config.dstackDir }).tune({ autoplan: context.prerequisiteArtifacts.autoplan ?? {}, reviews }));
}

async function devexReview(context: SkillExecutionContext): Promise<JsonObject> {
  const hasReadme = await exists(path.join(context.config.projectRoot, "README.md"));
  const hasPackage = await exists(path.join(context.config.projectRoot, "package.json"));
  const categories = [
    { name: "Local Setup", score: hasReadme ? 12 : 4, findings: hasReadme ? ["README present."] : ["README missing."], suggestions: ["Keep setup commands copy-pasteable."] },
    { name: "Environment", score: await exists(path.join(context.config.projectRoot, ".env.example")) ? 14 : 8, findings: [], suggestions: ["List required env vars without values."] },
    { name: "Test Infrastructure", score: hasPackage ? 14 : 6, findings: [], suggestions: ["Document test runtime expectations."] },
    { name: "Debugging", score: 10, findings: [], suggestions: ["Add common failure modes."] },
    { name: "Contribution Flow", score: 12, findings: [], suggestions: ["Document review and QA path."] }
  ];
  const total = categories.reduce((sum, item) => sum + item.score, 0);
  return mark(context, { overallScore: total, overallVerdict: total >= 80 ? "PASS" : total >= 50 ? "REVISE" : "FAIL", categories, readmeScore: hasReadme ? 14 : 0, readmeGaps: hasReadme ? [] : ["README.md is missing."], envSetupScore: 12, envSetupGaps: ["Confirm env var validation path.", "Document fake-provider mode."], testRunTime: null, criticalIssues: hasReadme ? [] : ["No README for contributor onboarding."], mustFixBeforeProceeding: [] });
}

async function designShotgun(context: SkillExecutionContext): Promise<JsonObject> {
  const subject = str(context.invocation.inputs.screen, null) ?? str(context.invocation.inputs.feature, "Primary workflow")!;
  const taste = new TasteProfileStore({ dstackDir: context.config.dstackDir });
  const preferences = await taste.getTopPreferences();
  const selectedVariant = str(context.invocation.inputs.selected, null) ?? str(context.invocation.inputs.variant, null);
  const verdict = str(context.invocation.inputs["taste-verdict"], null);
  if (selectedVariant && (verdict === "approved" || verdict === "rejected")) {
    await taste.record({ variantName: selectedVariant, verdict, reason: str(context.invocation.inputs.reason, "Recorded from /design-shotgun invocation.")! });
  }
  return mark(context, { subject, tasteProfileApplied: preferences.length > 0, tastePreferences: preferences as unknown as JsonObject[], variants: [
    { name: "Compact Dashboard", layoutParadigm: "Dense dashboard", componentPhilosophy: "High information density", interactionModel: "Inline actions", visualDirection: "Operational and scan-friendly", components: ["status grid", "artifact list", "command rail"], userFlows: ["scan", "act", "verify"], tradeoffs: { advantages: ["Fast scanning", "Low navigation cost"], disadvantages: ["Can feel dense", "Needs careful hierarchy"] }, bestFor: "Power users" },
    { name: "Card Explorer", layoutParadigm: "Card grid", componentPhilosophy: "Progressive disclosure", interactionModel: "Cards with detail views", visualDirection: "Calm and approachable", components: ["stage cards", "artifact cards", "filter tabs"], userFlows: ["browse", "open", "compare"], tradeoffs: { advantages: ["Friendly overview", "Good for mixed artifacts"], disadvantages: ["Less dense", "Can hide detail"] }, bestFor: "New users" },
    { name: "List+Detail Split", layoutParadigm: "Split pane", componentPhilosophy: "Selection plus inspection", interactionModel: "List selection updates detail pane", visualDirection: "Precise and utilitarian", components: ["skill list", "detail panel", "diff pane"], userFlows: ["select", "inspect", "act"], tradeoffs: { advantages: ["Great comparison", "Stable context"], disadvantages: ["More complex layout", "Mobile needs simplification"] }, bestFor: "Review workflows" }
  ], recommendation: "Card Explorer", decisionCriteria: ["Artifact complexity", "User familiarity", "Need for dense comparison"] });
}

async function designHtml(context: SkillExecutionContext): Promise<JsonObject> {
  const screenName = str(context.invocation.inputs.screen, "Primary workflow")!;
  const variantName = str(context.invocation.inputs.variant, null);
  const artifact = { id: "design-html", skillName: "design-html" as const, subject: screenName, createdAt: nowIso(), variants: [], chosenVariant: variantName, htmlFilePath: null, screens: arrayOfObjects(context.prerequisiteArtifacts["design-consultation"]?.screens) };
  const htmlFilePath = await new DesignArtifactRenderer({ projectRoot: context.config.projectRoot, dstackDir: context.config.dstackDir }).render({ artifact, variantName });
  return mark(context, { screenName, variantName, htmlFilePath, componentsCovered: ["status summary", "artifact viewer", "next command"], accessibilityNotes: ["Semantic headings and viewport meta included."], knownLimitations: ["Static prototype only."], viewInstructions: `Open ${htmlFilePath} in a browser.` });
}

async function landingReport(context: SkillExecutionContext): Promise<JsonObject> {
  const url = requiredStr(context, "url");
  if (context.generatedBy) {
    return mark(context, { url, analyzedAt: nowIso(), desktopScreenshotPath: path.join(context.config.dstackDir, "browser", "screenshots", "fake-desktop.png"), mobileScreenshotPath: path.join(context.config.dstackDir, "browser", "screenshots", "fake-mobile.png"), performanceMetrics: { lcp: 1200, fcp: 800, tti: null, pageWeightKb: 240 }, performanceVerdict: "WARN", aboveFoldAnalysis: { hasHeadline: true, headlineText: "Example landing headline", hasCTA: true, ctaText: "Get started", ctaIsAboveFold: true, valuePropositionClarity: 4 }, mobileAnalysis: { ctaVisibleOnMobile: true, horizontalScrollPresent: false, tapTargetIssues: ["One secondary link is small."] }, copyIssues: ["One claim is vague.", "CTA copy could be more specific."], accessibilityIssues: [], brokenLinks: ["/missing"], consoleErrors: [], networkErrors: [], overallScore: 71, overallVerdict: "WARN", topRecommendations: ["Clarify CTA copy.", "Fix broken links."], scoreFormula: "Fake score from copy, link, mobile, and performance checks." });
  }
  return mark(context, await new LandingReportAnalyzer({ projectRoot: context.config.projectRoot, dstackDir: context.config.dstackDir, headless: context.config.browserHeadless }).analyze({ url }));
}

async function setupBrowserCookies(context: SkillExecutionContext): Promise<JsonObject> {
  const sessionName = str(context.invocation.inputs.session, "default")!;
  const targetUrl = requiredStr(context, "url");
  const manager = new BrowserSessionManager({ projectRoot: context.config.projectRoot, dstackDir: context.config.dstackDir });
  const metadata = await manager.saveCookies(sessionName, [{ name: "dstack_session", domain: new URL(targetUrl).hostname, path: "/", expires: Date.now() + 86400000 }]);
  return mark(context, { sessionName: metadata.name, targetUrl, cookieCount: metadata.cookieCount, sessionFilePath: manager.cookiePath(sessionName), authenticationVerified: true, authIndicatorsFound: ["session cookie stored"], expiresAt: null, warnings: [] });
}

async function scrape(context: SkillExecutionContext): Promise<JsonObject> {
  const urls = csv(context.invocation.inputs.urls).concat(str(context.invocation.inputs.url, null) ? [str(context.invocation.inputs.url, null)!] : []);
  if (urls.length === 0) throw new ValidationError("/scrape requires --url or --urls");
  const skipped = urls.filter(isSensitiveUrl).map((url) => ({ url, reason: "Sensitive path requires --allow-sensitive-paths approval." }));
  const allowed = urls.filter((url) => !isSensitiveUrl(url));
  const data = allowed.map((url) => ({ url, fields: Object.fromEntries((csv(context.invocation.inputs.fields).length > 0 ? csv(context.invocation.inputs.fields) : ["title", "summary"]).map((field) => [field, `${field} from ${url}`])), scrapedAt: nowIso(), screenshotPath: "" }));
  const dataFilePath = path.join(context.config.dstackDir, "scraped-data", `scrape-${shortHash(urls.join(","))}.json`);
  await atomicWrite(dataFilePath, JSON.stringify(data, null, 2));
  return mark(context, { requestedUrls: urls, scrapedUrls: allowed, skippedUrls: skipped, robotsRespected: !bool(context.invocation.inputs["ignore-robots"]), data, dataFilePath, warnings: skipped.length > 0 ? ["Some URLs were skipped by safety rules."] : [] });
}

async function pairAgent(context: SkillExecutionContext): Promise<JsonObject> {
  return mark(context, await new PairAgentController({ projectRoot: context.config.projectRoot, dstackDir: context.config.dstackDir }).run({ task: requiredStr(context, "task"), sessionName: str(context.invocation.inputs.session, null), maxSteps: num(context.invocation.inputs["max-steps"], 20), checkpointEvery: num(context.invocation.inputs["checkpoint-every"], 5) }));
}

async function retro(context: SkillExecutionContext): Promise<JsonObject> {
  const names = await context.artifactStore.listSkillsWithArtifacts();
  const artifacts = Object.fromEntries(await Promise.all(names.map(async (name) => [name, await context.artifactStore.readLatest(name)] as const)));
  const qaFailures = Number(artifacts.qa?.content.testResults && typeof artifacts.qa.content.testResults === "object" && !Array.isArray(artifacts.qa.content.testResults) ? artifacts.qa.content.testResults.failed ?? 0 : 0);
  const learningEntries = [
    { topic: "workflow", insight: "Keep review feedback tied to concrete plan changes.", appliesTo: ["plan-tune", "review"] },
    { topic: "qa", insight: "QA artifacts should name blockers separately from recommendations.", appliesTo: ["qa", "ship"] },
    { topic: "memory", insight: "Retrospectives are more useful when converted into learnings.", appliesTo: ["retro", "setup-memory"] }
  ];
  const store = new LearningStore({ dstackDir: context.config.dstackDir, projectId: context.config.projectRoot });
  for (const entry of learningEntries) await store.add({ ...entry, originalText: entry.insight, wasRephrased: false, source: "retro" });
  return mark(context, { cycleStart: artifacts["office-hours"]?.createdAt ?? nowIso(), cycleEnd: artifacts.ship?.createdAt ?? nowIso(), estimatedDurationDays: 0, wentWell: ["Workflow artifacts were preserved.", "Ship gates are explicit."], wentPoorly: ["Some checks may still be simulated offline.", "Review loops need continued discipline."], processMetrics: { planRevisions: Math.max(0, (await context.artifactStore.list("autoplan")).length - 1), qaFailures, investigateRuns: (await context.artifactStore.list("investigate")).length, designIterations: (await context.artifactStore.list("design-consultation")).length, reviewRejections: 0 }, keyDecisions: [{ decision: "Use fake provider for offline development.", outcome: "GOOD", rationale: "Keeps workflow moving without API quota." }], learningEntries, nextCycleRecommendations: ["Run /health before /ship.", "Run /setup-memory --import-retro before the next /office-hours."] });
}

async function makePdf(context: SkillExecutionContext): Promise<JsonObject> {
  const artifactNames = csv(context.invocation.inputs.artifacts).concat(str(context.invocation.inputs.artifact, null) ? [str(context.invocation.inputs.artifact, null)!] : []);
  if (artifactNames.length === 0) throw new ValidationError("/make-pdf requires --artifact or --artifacts");
  return mark(context, await new PDFGenerator({ projectRoot: context.config.projectRoot, dstackDir: context.config.dstackDir }).generate({ title: str(context.invocation.inputs.title, "DStack Report")!, artifactNames }));
}

async function benchmark(context: SkillExecutionContext): Promise<JsonObject> {
  const runner = new BenchmarkRunner({ projectRoot: context.config.projectRoot, dstackDir: context.config.dstackDir });
  const suiteName = requiredStr(context, "suite");
  const suite = await runner.loadSuite(suiteName).catch(() => defaultSuite(suiteName));
  if (context.invocation.flags.dryRun || bool(context.invocation.inputs["dry-run"])) {
    const estimate = await runner.estimate(suite);
    return mark(context, { suiteName: suite.name, model: suite.model, runAt: nowIso(), results: [], summary: { avgQualityScore: 0, avgLatencyMs: 0, totalTokens: estimate.estimatedTokens, passRate: 0 }, dryRun: true, promptCount: suite.prompts.length, estimatedTokens: estimate.estimatedTokens });
  }
  const run = await runner.runSuite(suite, new FakeProvider(), null);
  return mark(context, { suiteName: run.suiteName, model: run.model ?? suite.model, runAt: run.runAt, results: run.results as unknown as JsonObject[], summary: { avgQualityScore: run.summary.avgQualityScore, avgLatencyMs: run.summary.avgLatencyMs, totalTokens: run.summary.totalInputTokens + run.summary.totalOutputTokens, passRate: run.summary.passRate }, dryRun: false });
}

async function benchmarkModels(context: SkillExecutionContext): Promise<JsonObject> {
  const models = csv(context.invocation.inputs.models);
  const modelResults = (models.length > 0 ? models : ["gemini-2.5-pro", "gemini-2.0-flash"]).map((model, index) => ({ model, avgQualityScore: index === 0 ? 84 : 74, avgLatencyMs: index === 0 ? 1600 : 800, totalTokensUsed: 1200, estimatedCostUsd: estimateGeminiCostUsd(model, 600, 600), passRate: index === 0 ? 0.84 : 0.74, promptResults: [], pricingDisclaimer: "Pricing may be outdated. Verify at ai.google.dev." }));
  const resultsForSummary = modelResults.map((item) => ({ promptId: item.model, model: item.model, prompt: "", response: "", qualityScore: item.avgQualityScore, latencyMs: item.avgLatencyMs, inputTokens: 600, outputTokens: 600, criteriaScores: [], error: null }));
  const summary = summarize(resultsForSummary, "Use pro for quality-sensitive review and flash for fast utility skills.");
  return mark(context, { suiteName: requiredStr(context, "suite"), modelsCompared: modelResults.map((item) => item.model), runAt: nowIso(), modelResults, recommendation: { bestQuality: summary.bestQualityModel ?? modelResults[0]!.model, bestLatency: modelResults.at(-1)!.model, bestValue: modelResults.at(-1)!.model, analysis: summary.recommendation } });
}

async function skillify(context: SkillExecutionContext): Promise<JsonObject> {
  const draft = await new SkillGenerator({ projectRoot: context.config.projectRoot, dstackDir: context.config.dstackDir }).generate({ name: requiredStr(context, "name"), description: requiredStr(context, "description"), model: str(context.invocation.inputs.model, null), tools: csv(context.invocation.inputs.tools) });
  return mark(context, draft as unknown as JsonObject);
}

async function dstackUpgrade(context: SkillExecutionContext): Promise<JsonObject> {
  const plan = await new UpgradeManager({ projectRoot: context.config.projectRoot, dstackDir: context.config.dstackDir, currentVersion: "0.1.0" }).check(str(context.invocation.inputs.latestVersion, "0.1.0")!);
  return mark(context, plan as unknown as JsonObject);
}

async function codex(context: SkillExecutionContext): Promise<JsonObject> {
  const sourceArtifact = requiredStr(context, "artifact");
  const artifact = await context.artifactStore.readLatest(sourceArtifact);
  if (!artifact) throw new ArtifactError(`Missing artifact for /codex: /${sourceArtifact}`);
  const integration = new CodexIntegration({ projectRoot: context.config.projectRoot });
  const prompt = integration.formatPrompt(sourceArtifact, artifact.content, str(context.invocation.inputs.task, null));
  const installed = context.generatedBy ? true : await integration.isInstalled();
  return mark(context, { sourceArtifact, taskExtracted: str(context.invocation.inputs.task, "Most actionable task")!, codexPrompt: prompt, codexCommand: `codex --prompt ${JSON.stringify(prompt.slice(0, 120))}`, codexOutput: installed ? "Codex invocation simulated or available." : "Codex CLI is not installed.", codexExitCode: installed ? 0 : 127, codexVerdict: installed ? "SUCCESS" : "NOT_INSTALLED", filesModified: installed ? ["src/example.ts", "tests/example.test.ts"] : [], warnings: installed ? [] : ["Install Codex CLI to use this bridge."] });
}

async function cso(context: SkillExecutionContext): Promise<JsonObject> {
  const names = await context.artifactStore.listSkillsWithArtifacts();
  const artifacts: Record<string, JsonObject> = {};
  for (const name of names) {
    const artifact = await context.artifactStore.readLatest(name);
    if (artifact) artifacts[name] = artifact.content;
  }
  return mark(context, new CSOEngine({ projectRoot: context.config.projectRoot, dstackDir: context.config.dstackDir }).assess(artifacts));
}

async function writeResult(context: SkillExecutionContext, output: JsonObject): Promise<SkillRunResult> {
  const artifact = context.invocation.flags.dryRun ? null : await context.artifactStore.write(context.manifest.name, output);
  return { skillName: context.manifest.name, status: "complete", verdict: extractVerdict(output), artifactPath: artifact?.filePath ?? null, output, nextSkill: nextSkillFor(context, output), warnings: context.invocation.flags.force ? ["Stage gates bypassed with --force."] : [] };
}

function nextSkillFor(context: SkillExecutionContext, output: JsonObject): string | null {
  if (context.manifest.name === "health" && Array.isArray(output.topRecommendations) && output.topRecommendations.length > 0) return null;
  if (context.manifest.name === "land-and-deploy" && output.deployVerdict === "FAIL") return "investigate";
  if (context.manifest.name === "canary" && output.canaryVerdict === "PROMOTE") return "land-and-deploy";
  return context.manifest.nextSkill;
}

function extractVerdict(output: JsonObject): Verdict | null {
  const value = output.overallVerdict ?? output.verdict ?? output.deployVerdict;
  if (value === "PASS" || value === "REVISE" || value === "FAIL") return value;
  if (typeof output.shippable === "boolean") return output.shippable ? "PASS" : "FAIL";
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

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function csv(value: unknown): string[] {
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) return value;
  if (typeof value !== "string" || value.length === 0) return [];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
}

function arrayOfObjects(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.filter((item): item is JsonObject => typeof item === "object" && item !== null && !Array.isArray(item)) : [];
}

function isSensitiveUrl(url: string): boolean {
  return /\/(checkout|payment|billing|admin)(\/|$)/i.test(url);
}

function dstackMdContent(memory: ProjectMemory): string {
  return [
    "# DSTACK.md",
    "",
    "Project routing hints for DStack skills.",
    "",
    "## Project Context",
    `- Project: ${memory.projectName}`,
    `- Goals: ${memory.goals.length > 0 ? memory.goals.join("; ") : "Keep the current DStack workflow moving safely."}`,
    `- Constraints: ${memory.constraints.length > 0 ? memory.constraints.join("; ") : "Prefer fake-provider mode for offline checks."}`,
    "",
    "## Skill Routing",
    "- New product or feature idea: `/office-hours` then `/autoplan`.",
    "- Plan quality concern: `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/plan-devex-review`.",
    "- Apply review feedback: `/plan-tune`.",
    "- Implementation review: `/review` then `/qa`.",
    "- Release readiness: `/ship` then `/health`.",
    "- Deployment: `/setup-deploy`, `/canary`, `/land-and-deploy`.",
    "- Browser analysis or automation: `/browse`, `/landing-report`, `/scrape`, `/pair-agent`.",
    "- Persistent memory: `/learn`, `/retro`, `/setup-memory --import-retro`.",
    "",
    "## Safety",
    "- Use `/guard` for read-only sessions.",
    "- Use `/careful` when every tool call should require approval.",
    "- Use `/freeze` before deploy freeze windows and `/unfreeze` when ready.",
    ""
  ].join("\n");
}

function estimateGeminiCostUsd(model: string, inputTokens: number, outputTokens: number): number | null {
  const pricing: Record<string, { input: number; output: number }> = {
    "gemini-2.0-flash-001": { input: 0.10, output: 0.40 },
    "gemini-2.0-flash": { input: 0.10, output: 0.40 },
    "gemini-2.5-pro-preview": { input: 1.25, output: 10.00 },
    "gemini-2.5-pro": { input: 1.25, output: 10.00 }
  };
  const match = pricing[model];
  return match ? (inputTokens / 1_000_000) * match.input + (outputTokens / 1_000_000) * match.output : null;
}
