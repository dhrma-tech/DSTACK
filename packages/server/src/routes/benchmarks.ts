import { Router } from 'express';
import { BenchmarkService } from '@dstack/core';
import type { Contracts } from '@dstack/shared';
import { serviceOptions } from '../context';
import { asyncRoute, HttpError } from '../lib/http';

export const benchmarksRouter = Router();

function present(run: Contracts.BenchmarkRun) {
  return {
    id: run.id,
    suite: run.suiteName,
    date: run.runAt,
    fakeMode: run.providerName === 'fake',
    durationMs: run.durationMs,
    results: run.modelResults.map((result) => ({
      model: result.model,
      status: result.status,
      quality: result.avgQualityScore ?? 0,
      latencyMs: result.avgLatencyMs ?? 0,
      tokens: result.totalTokensUsed,
      estimatedCostUsd: result.estimatedCostUsd ?? null,
      criteria: {}
    }))
  };
}

benchmarksRouter.get('/', asyncRoute(async (req, res) => {
  const limit = Math.min(Number.parseInt(String(req.query.limit ?? '20'), 10) || 20, 100);
  const runs = await new BenchmarkService(serviceOptions()).listBenchmarkRuns(limit);
  res.json(runs.map(present));
}));

benchmarksRouter.get('/:runId', asyncRoute(async (req, res) => {
  const run = await new BenchmarkService(serviceOptions()).getBenchmarkRun(String(req.params.runId));
  if (!run) throw new HttpError(404, 'Benchmark run not found', 'NOT_FOUND');
  res.json(present(run));
}));
