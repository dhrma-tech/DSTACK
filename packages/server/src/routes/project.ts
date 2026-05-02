import { Router } from 'express';
import { SafetyModeManager, DeployManager } from '@dstack/core';
import path from 'path';

export const projectRouter = Router();

const projectRoot = process.cwd().endsWith('server') ? 
  path.resolve(process.cwd(), '../../') : 
  process.cwd();
const dstackDir = path.join(projectRoot, '.dstack');

const safetyManager = new SafetyModeManager({ dstackDir });
const deployManager = new DeployManager({ projectRoot, dstackDir });

projectRouter.get('/', async (req, res) => {
  const safetyState = await safetyManager.read();
  const freezeState = await deployManager.readState();
  
  res.json({
    name: 'DStack',
    branch: 'main',
    head: '492f696',
    stage: 'planning',
    safetyMode: safetyState.mode,
    freezeState: freezeState.frozen,
    providerMode: 'FAKE'
  });
});

projectRouter.post('/settings', async (req, res) => {
  const { safetyMode, freezeState, providerMode } = req.body;

  try {
    if (safetyMode) {
      await safetyManager.setMode(safetyMode, null, `Manually set from UI to ${safetyMode}`);
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
    topRecommendations: []
  });
});
