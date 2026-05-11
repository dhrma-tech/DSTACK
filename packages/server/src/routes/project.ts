import { Router, type Router as RouterType } from 'express';
import { SafetyModeManager, DeployManager, git } from '@dstack/core';
import type { SafetyModeName } from '@dstack/shared';
import path from 'path';
import fs from 'node:fs';

export const projectRouter: RouterType = Router();

const findProjectRoot = () => {
  let current = __dirname;
  while (current !== path.parse(current).root) {
    if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }
    current = path.dirname(current);
  }
  return process.cwd();
};

const projectRoot = findProjectRoot();
const dstackDir = path.join(projectRoot, '.dstack');

const safetyManager = new SafetyModeManager({ dstackDir });
const deployManager = new DeployManager({ projectRoot, dstackDir });

projectRouter.get('/', async (req, res) => {
  const [safetyState, freezeState, branchInfo, headInfo] = await Promise.all([
    safetyManager.read(),
    deployManager.readState(),
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
    if (safetyMode) {
      await safetyManager.setMode(safetyMode as SafetyModeName, null, `Manually set from UI to ${safetyMode}`);
    }

    if (freezeState !== undefined) {
      if (freezeState) {
        await deployManager.freeze('Manually frozen from UI', null, null, 'dstack-ui');
      } else {
        await deployManager.unfreeze();
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



