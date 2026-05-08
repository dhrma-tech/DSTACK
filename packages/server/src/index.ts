import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { projectRouter } from './routes/project';
import { skillsRouter } from './routes/skills';
import { artifactsRouter } from './routes/artifacts';
import { attachRunRoutes } from './routes/runs';
import { attachSandboxRoutes } from './routes/sandbox';
import { attachWorkflowRoutes } from './routes/workflows';
import { historyRouter } from './routes/history';
import { suggestionsRouter } from './routes/suggestions';
import { templatesRouter } from './routes/templates';
import notifier from 'node-notifier';
import { globalSkillRunner } from './stream/skill-runner';

const app = express();
const port = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// API Routes
app.use('/api/project', projectRouter);
app.use('/api/skills', skillsRouter);
app.use('/api/artifacts', artifactsRouter);
app.use('/api/history', historyRouter);
app.use('/api/workflow', suggestionsRouter);
app.use('/api/templates', templatesRouter);

app.get('/api/workflow/graph', (req, res) => {
  res.json({
    nodes: [
      { id: 'office-hours', skillName: 'office-hours', label: 'Office Hours', phase: 'Planning', status: 'ready', verdict: null, timestamp: null, isStale: false },
    ],
    edges: []
  });
});

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
  const interval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
  }, 30000);
  req.on('close', () => clearInterval(interval));
});

attachRunRoutes(app);
attachWorkflowRoutes(app);
attachSandboxRoutes(app);


app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Notifications
globalSkillRunner.globalEmitter.on('global_event', ({ event }) => {
  if (event.type === 'complete') {
    notifier.notify({
      title: 'DStack Skill Run',
      message: `/${event.skillName} finished with status: ${event.status}`,
      sound: true,
      wait: false
    });
  } else if (event.type === 'approval-required') {
    notifier.notify({
      title: 'DStack Approval Required',
      message: `/${event.toolName} requires your approval to proceed.`,
      sound: true,
      wait: false
    });
  }
});

app.listen(port, () => {
  console.log(`DStack Server listening at http://localhost:${port}`);
});

export { app };
