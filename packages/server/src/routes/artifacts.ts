import { Router } from 'express';
import { ArtifactStore } from '@dstack/core';
import path from 'path';

export const artifactsRouter = Router();

const getDStackDir = () => path.join(process.cwd(), '.dstack');

artifactsRouter.get('/', async (req, res) => {
  try {
    const store = new ArtifactStore(getDStackDir());
    const skills = await store.listSkillsWithArtifacts();
    
    const results = [];
    for (const skill of skills) {
      const latest = await store.readLatest(skill);
      if (latest) {
        results.push({
          skillName: skill,
          verdict: latest.verdict,
          timestamp: latest.createdAt,
          path: latest.filePath,
          content: latest.content
        });
      }
    }
    res.json(results);
  } catch (err) {
    console.error('Failed to list artifacts:', err);
    res.status(500).json({ error: 'Failed to list artifacts' });
  }
});

artifactsRouter.get('/:skillName/latest', async (req, res) => {
  try {
    const store = new ArtifactStore(getDStackDir());
    const latest = await store.readLatest(req.params.skillName);
    if (!latest) {
      return res.status(404).json({ error: 'Artifact not found' });
    }
    res.json(latest);
  } catch (err) {
    console.error('Failed to get latest artifact:', err);
    res.status(500).json({ error: 'Failed to get latest artifact' });
  }
});

artifactsRouter.get('/:skillName', async (req, res) => {
  try {
    const store = new ArtifactStore(getDStackDir());
    const artifacts = await store.list(req.params.skillName);
    res.json(artifacts.map(a => ({
      id: a.id,
      timestamp: a.createdAt,
      verdict: a.verdict
    })));
  } catch (err) {
    console.error('Failed to get artifact history:', err);
    res.status(500).json({ error: 'Failed to get artifact history' });
  }
});
