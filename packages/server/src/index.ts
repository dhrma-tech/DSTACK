import express from 'express';
import cors from 'cors';
import { projectRouter } from './routes/project';
import { skillsRouter } from './routes/skills';
import { artifactsRouter } from './routes/artifacts';
import { attachRunRoutes } from './routes/runs';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
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
