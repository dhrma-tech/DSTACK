import { Router, type Router as RouterType } from 'express';
import { SafetyModeManager, DeployManager, git } from '@dstack/core';
import type { SafetyModeName } from '@dstack/shared';
import { getDstackDir, getProjectRoot } from '../context';

export const projectRouter: RouterType = Router();

const SAFETY_MODES: readonly SafetyModeName[] = ['NORMAL', 'CAREFUL', 'GUARD'];
const safety = () => new SafetyModeManager({ dstackDir: getDstackDir() });
const deploy = () => new DeployManager({ projectRoot: getProjectRoot(), dstackDir: getDstackDir() });

projectRouter.get('/', async (req, res) => {
  const projectRoot = getProjectRoot();
  const [safetyState, freezeState, branchInfo, headInfo] = await Promise.all([
    safety().read(),
    deploy().readState(),
    git(['branch', '--show-current'], projectRoot),
    git(['rev-parse', '--short', 'HEAD'], projectRoot)
  ]);
  
  res.json({
    name: 'DStack',
    branch: branchInfo.stdout.trim() || 'main',
    head: headInfo.stdout.trim() || 'unknown',
    stage: 'planning',
    safetyMode: safetyState.mode,
    freezeState: freezeState.frozen,
    providerMode: (process.env.DSTACK_PROVIDER || 'gemini').toUpperCase()
  });
});

projectRouter.post('/settings', async (req, res) => {
  const { safetyMode, freezeState } = req.body as { safetyMode?: string; freezeState?: boolean };

  try {
    if (safetyMode !== undefined && !SAFETY_MODES.includes(safetyMode as SafetyModeName)) {
      res.status(400).json({ error: 'safetyMode must be NORMAL, CAREFUL or GUARD', code: 'VALIDATION' });
      return;
    }
    if (safetyMode) {
      await safety().setMode(safetyMode as SafetyModeName, null, `Manually set from UI to ${safetyMode}`);
    }

    if (freezeState !== undefined) {
      if (freezeState) {
        await deploy().freeze('Manually frozen from UI', null, null, 'dstack-ui');
      } else {
        await deploy().unfreeze();
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Failed to update project settings:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

projectRouter.get('/health', (req, res) => {
  res.json({
    score: 100,
    status: 'HEALTHY',
    recommendations: []
  });
});



