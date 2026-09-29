import { Router } from 'express';
import { ConfigManager, DeployManager, DeployService } from '@dstack/core';
import { getProjectRoot, serviceOptions } from '../context';
import { asyncRoute, HttpError } from '../lib/http';

export const deployRouter = Router();

async function manager(): Promise<DeployManager> {
  const config = await ConfigManager.load({ projectRoot: getProjectRoot() });
  return new DeployManager(config);
}

async function freezeState() {
  const state = await new DeployService(serviceOptions()).getFreezeState();
  return { frozen: state.frozen, reason: state.reason ?? undefined, frozenAt: state.createdAt ?? undefined, frozenUntil: state.frozenUntil ?? undefined };
}

deployRouter.get('/config', asyncRoute(async (_req, res) => {
  const config = await new DeployService(serviceOptions()).getDeployConfig();
  res.json(config ? { platform: config.platform, deployCommand: config.deployCommand, dryRunCommand: config.dryRunCommand, healthCheckUrl: config.healthCheckUrl ?? undefined, environment: config.environment } : null);
}));

deployRouter.get('/state', asyncRoute(async (_req, res) => {
  res.json(await freezeState());
}));

deployRouter.post('/freeze', asyncRoute(async (req, res) => {
  const body = (req.body ?? {}) as { reason?: unknown; until?: unknown };
  if (body.reason !== undefined && typeof body.reason !== 'string') throw new HttpError(400, 'reason must be a string', 'VALIDATION');
  if (body.until !== undefined && (typeof body.until !== 'string' || Number.isNaN(Date.parse(body.until)))) {
    throw new HttpError(400, 'until must be an ISO date string', 'VALIDATION');
  }
  await (await manager()).freeze(body.reason ?? 'Frozen from the DStack UI', (body.until as string | undefined) ?? null, null, 'dstack-ui');
  res.json(await freezeState());
}));

deployRouter.post('/unfreeze', asyncRoute(async (_req, res) => {
  await (await manager()).unfreeze();
  res.json(await freezeState());
}));

deployRouter.get('/runs', asyncRoute(async (_req, res) => {
  const runs = await new DeployService(serviceOptions()).getDeployRuns();
  res.json(runs.map((run) => ({
    id: run.id,
    timestamp: run.startedAt,
    environment: run.environment,
    verdict: run.verdict === 'PASS' ? 'PASS' : 'FAIL',
    durationMs: run.completedAt ? Date.parse(run.completedAt) - Date.parse(run.startedAt) : 0,
    gitHash: run.gitHead,
    healthCheckVerdict: run.healthCheckVerdict === 'PASS' || run.healthCheckVerdict === 'FAIL' ? run.healthCheckVerdict : null
  })));
}));
