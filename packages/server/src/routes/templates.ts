import { Router } from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

interface Template {
  id: string;
  name: string;
  skillName: string;
  inputs: Record<string, string>;
  flags: Record<string, boolean | string>;
  createdAt: string;
}

interface TemplateStore {
  version: '1';
  templates: Template[];
}

function getTemplatePath(): string {
  const projectRoot = process.cwd().endsWith('server')
    ? path.resolve(process.cwd(), '../../')
    : process.cwd();
  return path.join(projectRoot, '.dstack', 'templates.json');
}

function readTemplates(): TemplateStore {
  const templatePath = getTemplatePath();
  try {
    if (fs.existsSync(templatePath)) {
      const raw = fs.readFileSync(templatePath, 'utf-8');
      return JSON.parse(raw) as TemplateStore;
    }
  } catch { /* ignore */ }
  return { version: '1', templates: [] };
}

function writeTemplates(store: TemplateStore): void {
  const templatePath = getTemplatePath();
  const dir = path.dirname(templatePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(templatePath, JSON.stringify(store, null, 2), 'utf-8');
}

router.get('/', (req: Request, res: Response) => {
  const store = readTemplates();
  let templates = store.templates;
  
  if (req.query.skill) {
    templates = templates.filter(t => t.skillName === req.query.skill);
  }
  
  res.json({ templates });
});

router.post('/', (req: Request, res: Response) => {
  const store = readTemplates();
  const template: Template = {
    id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: req.body.name || 'Unnamed Template',
    skillName: req.body.skillName,
    inputs: req.body.inputs || {},
    flags: req.body.flags || {},
    createdAt: new Date().toISOString(),
  };
  store.templates.push(template);
  writeTemplates(store);
  res.status(201).json(template);
});

router.delete('/:id', (req: Request, res: Response) => {
  const store = readTemplates();
  store.templates = store.templates.filter(t => t.id !== req.params.id);
  writeTemplates(store);
  res.json({ success: true });
});

export { router as templatesRouter };
