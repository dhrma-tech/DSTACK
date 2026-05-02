import { Router } from 'express';
import { globalSkillRunner } from '../stream/skill-runner';

export const runsRouter = Router();

// Endpoint bound in `index.ts` via `app.use('/api/runs', runsRouter)`
// But wait, the POST is to /api/skills/:skillName/run, so maybe that should be in skillsRouter.
// I'll export a function to attach the skills run route to the skills router.

export const attachRunRoutes = (app: import('express').Express) => {
  app.get('/api/runs', async (req, res) => {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const projectRoot = process.cwd().endsWith('server') ? 
        path.resolve(process.cwd(), '../../') : 
        process.cwd();
      const logsDir = path.join(projectRoot, '.dstack', 'logs');
      
      try {
        await fs.access(logsDir);
      } catch {
        return res.json([]);
      }
      
      const files = await fs.readdir(logsDir);
      const runs = await Promise.all(
        files.filter(f => f.endsWith('.json')).map(async (file) => {
          const content = await fs.readFile(path.join(logsDir, file), 'utf-8');
          try {
            const parsed = JSON.parse(content);
            return {
              id: file.replace('.json', ''),
              command: `/${parsed.skillName}`,
              provider: parsed.provider || 'gemini',
              fakeMode: parsed.provider === 'fake',
              status: parsed.status,
              verdict: parsed.error ? 'FAIL' : 'PASS', // Basic inference
              duration: parsed.completedAt ? `${Math.round((new Date(parsed.completedAt).getTime() - new Date(parsed.startedAt).getTime()) / 1000)}s` : 'running',
              requestedAt: parsed.startedAt
            };
          } catch {
            return null;
          }
        })
      );
      
      res.json(runs.filter(Boolean).sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()));
    } catch (err) {
      console.error('Failed to list runs:', err);
      res.status(500).json({ error: 'Failed to list runs' });
    }
  });

  app.post('/api/skills/:skillName/run', (req, res) => {
    const { skillName } = req.params;
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    
    globalSkillRunner.startRun(runId, skillName, req.body || {});
    
    res.json({ runId });
  });

  app.get('/api/runs/:runId/stream', (req, res) => {
    const { runId } = req.params;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Send existing log
    const log = globalSkillRunner.getLog(runId);
    for (const event of log) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    const emitter = globalSkillRunner.getEmitter(runId);
    if (!emitter) {
      if (log.length > 0 && log[log.length - 1].type === 'complete') {
        // Run is already finished and emitter cleaned up
        res.end();
      } else {
        // Run not found
        res.status(404).end();
      }
      return;
    }

    const listener = (event: any) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      if (event.type === 'complete') {
        res.end();
      }
    };

    emitter.on('event', listener);

    req.on('close', () => {
      emitter.off('event', listener);
    });
  });

  app.post('/api/approvals/:runId/respond', (req, res) => {
    const { runId } = req.params;
    const { decision } = req.body;
    
    if (decision !== 'approve' && decision !== 'deny') {
      return res.status(400).json({ error: 'Invalid decision. Must be "approve" or "deny"' });
    }

    globalSkillRunner.respondToApproval(runId, decision);
    res.json({ success: true });
  });
};
