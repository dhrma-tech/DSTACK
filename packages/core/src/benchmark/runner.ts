import { readFile } from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import type { BenchmarkRun } from "@dstack/shared";
import type { BenchmarkPromptResult, BenchmarkSummary, Provider } from "@dstack/shared";
import { nowIso, shortHash } from "../utils.js";

export interface BenchmarkRunnerOptions {
  projectRoot: string;
  dstackDir: string;
}

export type BenchmarkRunnerResult = BenchmarkRun;

export interface BenchmarkSuite {
  name: string;
  description: string;
  model: string;
  prompts: Array<{ id: string; prompt: string; criteria: string[]; expectedOutputContains: string[]; scoringRubric: string }>;
}

export class BenchmarkRunner {
  constructor(private readonly options: BenchmarkRunnerOptions) {}

  async loadSuite(name: string): Promise<BenchmarkSuite> {
    const filePath = path.join(this.options.dstackDir, "benchmarks", `${name}.yaml`);
    const raw = yaml.load(await readFile(filePath, "utf8"));
    return parseSuite(raw);
  }

  async runSuite(suite: BenchmarkSuite, provider: Provider, modelOverride?: string | null): Promise<BenchmarkRun> {
    if (suite.prompts.length > 100) throw new Error("Benchmark hard cap exceeded: max 100 prompts.");
    const started = Date.now();
    const model = modelOverride ?? suite.model;
    const results: BenchmarkPromptResult[] = [];
    for (const prompt of suite.prompts) {
      const promptStarted = Date.now();
      let responseText = "";
      for await (const chunk of provider.generate({ model, systemPrompt: "Answer the benchmark prompt.", userMessage: prompt.prompt, tools: [], responseMimeType: "text/plain", temperature: 0.2, maxOutputTokens: 2048 })) {
        if (chunk.type === "text" && chunk.text) responseText += chunk.text;
      }
      const criteriaScores = prompt.criteria.map((criterion) => ({ criterion, passed: containsAny(responseText, prompt.expectedOutputContains), score: containsAny(responseText, prompt.expectedOutputContains) ? 100 : 50 }));
      const qualityScore = Math.round(criteriaScores.reduce((sum, item) => sum + item.score, 0) / Math.max(1, criteriaScores.length));
      results.push({
        promptId: prompt.id,
        model,
        prompt: prompt.prompt,
        response: responseText,
        qualityScore,
        latencyMs: Date.now() - promptStarted,
        inputTokens: await provider.countTokens(prompt.prompt, model),
        outputTokens: await provider.countTokens(responseText, model),
        criteriaScores,
        error: null
      });
    }
    return {
      id: shortHash(`${suite.name}:${started}`, 12),
      projectId: this.options.projectRoot,
      suiteName: suite.name,
      model,
      runAt: nowIso(),
      duration: Date.now() - started,
      results,
      summary: summarize(results, null),
      type: "single-model",
      modelsCompared: []
    };
  }

  async estimate(suite: BenchmarkSuite): Promise<{ promptCount: number; estimatedTokens: number }> {
    const promptTokens = suite.prompts.reduce((sum, prompt) => sum + Math.ceil(`${prompt.prompt}\n${prompt.scoringRubric}\n${prompt.criteria.join("\n")}`.length / 4), 0);
    return { promptCount: suite.prompts.length, estimatedTokens: promptTokens * 2 };
  }
}

export function summarize(results: BenchmarkPromptResult[], recommendation: string | null): BenchmarkSummary {
  const count = Math.max(1, results.length);
  const avgQualityScore = Math.round(results.reduce((sum, item) => sum + item.qualityScore, 0) / count);
  const avgLatencyMs = Math.round(results.reduce((sum, item) => sum + item.latencyMs, 0) / count);
  return {
    avgQualityScore,
    avgLatencyMs,
    totalInputTokens: results.reduce((sum, item) => sum + item.inputTokens, 0),
    totalOutputTokens: results.reduce((sum, item) => sum + item.outputTokens, 0),
    passRate: results.filter((item) => item.qualityScore >= 70).length / count,
    recommendation: recommendation ?? "Review benchmark results before changing model defaults.",
    bestQualityModel: null,
    bestLatencyModel: null
  };
}

export function defaultSuite(name = "default"): BenchmarkSuite {
  return {
    name,
    description: "Default offline benchmark suite",
    model: "gemini-2.0-flash-001",
    prompts: [
      { id: "clarity", prompt: "Summarize the project goal clearly.", criteria: ["clarity"], expectedOutputContains: ["project"], scoringRubric: "Clear project summary" },
      { id: "risk", prompt: "Name one implementation risk.", criteria: ["risk"], expectedOutputContains: ["risk"], scoringRubric: "Specific risk" },
      { id: "next", prompt: "Suggest a next action.", criteria: ["action"], expectedOutputContains: ["next"], scoringRubric: "Actionable next step" }
    ]
  };
}

function parseSuite(value: unknown): BenchmarkSuite {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Benchmark suite must be an object.");
  const record = value as Record<string, unknown>;
  const prompts = Array.isArray(record.prompts) ? record.prompts.map(parsePrompt) : [];
  return {
    name: typeof record.name === "string" ? record.name : "unnamed",
    description: typeof record.description === "string" ? record.description : "",
    model: typeof record.model === "string" ? record.model : "gemini-2.0-flash-001",
    prompts
  };
}

function parsePrompt(value: unknown): BenchmarkSuite["prompts"][number] {
  const record = typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    id: typeof record.id === "string" ? record.id : shortHash(JSON.stringify(record)),
    prompt: typeof record.prompt === "string" ? record.prompt : "",
    criteria: stringArray(record.criteria),
    expectedOutputContains: stringArray(record.expectedOutputContains),
    scoringRubric: typeof record.scoringRubric === "string" ? record.scoringRubric : ""
  };
}

function containsAny(text: string, needles: string[]): boolean {
  return needles.length === 0 || needles.some((needle) => text.toLowerCase().includes(needle.toLowerCase()));
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
}
