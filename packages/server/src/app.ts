import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { hostGuard, isStreamPath, requireAuth, StreamTickets } from './lib/auth';
import { errorHandler, HttpError, openSse, rateLimit, writeSse } from './lib/http';
import { artifactsRouter } from './routes/artifacts';
import { benchmarksRouter } from './routes/benchmarks';
import { browserRouter } from './routes/browser';
import { deployRouter } from './routes/deploy';
import { historyRouter } from './routes/history';
import { learningsRouter } from './routes/learnings';
import { projectRouter } from './routes/project';
import { runsRouter } from './routes/runs';
import { safetyRouter } from './routes/safety';
import { attachSandboxRoutes } from './routes/sandbox';
import { settingsRouter } from './routes/settings';
import { skillsRouter } from './routes/skills';
import { suggestionsRouter } from './routes/suggestions';
import { templatesRouter } from './routes/templates';
import { workflowGraphRouter } from './routes/workflow-graph';
import { attachWorkflowRoutes } from './routes/workflows';

export interface AppOptions {
  token: string;
  allowedOrigins?: string[];
  extraHosts?: string[];
}

const DEFAULT_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

export function createApp(options: AppOptions): Express {
  const app = express();
  const tickets = new StreamTickets();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(hostGuard(options.extraHosts));
  app.use(cors({
    origin: options.allowedOrigins ?? DEFAULT_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  app.use(express.json({ limit: '1mb' }));

  // Unauthenticated liveness probe; reveals nothing about the project.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api', requireAuth(options.token, tickets));

  app.post('/api/stream-tickets', (req, res, next) => {
    const { path } = (req.body ?? {}) as { path?: unknown };
    if (typeof path !== 'string' || !isStreamPath(path)) return next(new HttpError(400, 'path must be an /api stream path', 'VALIDATION'));
    res.json({ ticket: tickets.issue(path) });
  });

  app.use('/api/project', projectRouter);
  app.use('/api/skills', skillsRouter);
  app.use('/api/artifacts', artifactsRouter);
  app.use('/api/history', historyRouter);
  app.use('/api/workflow', workflowGraphRouter);
  app.use('/api/workflow', suggestionsRouter);
  app.use('/api/templates', templatesRouter);
  app.use('/api/learnings', learningsRouter);
  app.use('/api/deploy', deployRouter);
  app.use('/api/safety', safetyRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/benchmarks', benchmarksRouter);
  app.use('/api/browser', browserRouter);
  app.use('/api', runsRouter);
  app.use('/api/sandbox', rateLimit(60));

  app.get('/api/events', (req, res) => {
    openSse(res);
    const beat = () => writeSse(res, { type: 'heartbeat', timestamp: new Date().toISOString() });
    beat();
    const interval = setInterval(beat, 30_000);
    req.on('close', () => clearInterval(interval));
  });

  attachWorkflowRoutes(app);
  attachSandboxRoutes(app);

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'No such API route', 'ROUTE_NOT_FOUND')));
  app.use(errorHandler);
  return app;
}
