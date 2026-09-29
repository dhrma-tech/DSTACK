import { Router } from 'express';
import { SafetyModeManager } from '@dstack/core';
import { getDstackDir } from '../context';
import { asyncRoute, HttpError } from '../lib/http';

export const safetyRouter = Router();

const MODES = ['NORMAL', 'CAREFUL', 'GUARD'] as const;
type Mode = (typeof MODES)[number];

function isMode(value: unknown): value is Mode {
  return typeof value === 'string' && (MODES as readonly string[]).includes(value);
}

safetyRouter.get('/', asyncRoute(async (_req, res) => {
  const state = await new SafetyModeManager({ dstackDir: getDstackDir() }).read();
  res.json({ mode: state.mode, reason: state.reason ?? null });
}));

safetyRouter.post('/mode', asyncRoute(async (req, res) => {
  const { mode, reason } = (req.body ?? {}) as { mode?: unknown; reason?: unknown };
  if (!isMode(mode)) throw new HttpError(400, `mode must be one of ${MODES.join(', ')}`, 'VALIDATION');
  const state = await new SafetyModeManager({ dstackDir: getDstackDir() }).setMode(mode, null, typeof reason === 'string' ? reason : `Set to ${mode} from the DStack UI`);
  res.json({ mode: state.mode, reason: state.reason ?? null });
}));
