import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Router, type Router as RouterType } from 'express';
import { ArtifactStore, ConfigManager, DeployManager, git, projectHealth, projectStage, SafetyModeManager } from '@dstack/core';
import { getDstackDir, getProjectRoot } from '../context';
import { asyncRoute } from '../lib/http';
import { currentPipeline } from '../lib/pipeline';

export const projectRouter: RouterType = Router();

async function projectName(root: string): Promise<string> {
  try {
    const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf-8')) as { name?: unknown };
    if (typeof pkg.name === 'string' && pkg.name) return pkg.name;
  } catch {
    // No package.json; fall back to the folder name.
  }
  return path.basename(root);
}

projectRouter.get('/', asyncRoute(async (_req, res) => {
  const projectRoot = getProjectRoot();
  const dstackDir = getDstackDir();
  const [name, config, safety, freeze, branch, head, pipeline] = await Promise.all([
    projectName(projectRoot),
    ConfigManager.load({ projectRoot }),
    new SafetyModeManager({ dstackDir }).read(),
    new DeployManager({ projectRoot, dstackDir }).readState(),
    git(['branch', '--show-current'], projectRoot),
    git(['rev-parse', '--short', 'HEAD'], projectRoot),
    currentPipeline()
  ]);
  const artifacts = new ArtifactStore(dstackDir);
  const withArtifacts = pipeline.nodes.filter((node) => node.artifactAt);
  const versionCounts = await Promise.all(withArtifacts.map(async (node) => (await artifacts.list(node.skillName)).length));

  res.json({
    name,
    branch: branch.stdout.trim() || null,
    head: head.stdout.trim() || null,
    stage: projectStage(pipeline),
    safetyMode: safety.mode,
    safetyReason: safety.reason ?? null,
    freezeState: freeze.frozen,
    freezeReason: freeze.reason ?? null,
    providerMode: config.provider.toUpperCase(),
    geminiConfigured: Boolean(config.geminiApiKey),
    artifactCounts: {
      total: versionCounts.reduce((sum, count) => sum + count, 0),
      latest: withArtifacts.length,
      stale: pipeline.nodes.filter((node) => node.status === 'stale').length
    }
  });
}));

projectRouter.get('/health', asyncRoute(async (_req, res) => {
  res.json(projectHealth(await currentPipeline()));
}));
