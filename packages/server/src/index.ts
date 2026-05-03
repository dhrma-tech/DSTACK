import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { projectRouter } from './routes/project';
import { skillsRouter } from './routes/skills';
import { artifactsRouter } from './routes/artifacts';
import { attachRunRoutes } from './routes/runs';

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

attachRunRoutes(app);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`DStack Server listening at http://localhost:${port}`);
});

export { app };
