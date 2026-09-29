import { Router } from 'express';
import { ArtifactStore } from '@dstack/core';
import { getDstackDir } from '../context';
import { asyncRoute, HttpError } from '../lib/http';
import { toProjectRelative } from '../lib/redact';

export const artifactsRouter = Router();

const SKILL_NAME = /^[a-z][a-z0-9-]{0,60}$/;
const VERSION_ID = /^[\w.:-]{1,120}$/;

function skillParam(raw: unknown): string {
  const value = String(raw);
  if (!SKILL_NAME.test(value)) throw new HttpError(404, 'Artifact not found', 'NOT_FOUND');
  return value;
}

function versionParam(raw: unknown, name: string): string {
  if (typeof raw !== 'string' || !VERSION_ID.test(raw)) throw new HttpError(400, `${name} must be an artifact version id`, 'VALIDATION');
  return raw;
}

const store = () => new ArtifactStore(getDstackDir());

artifactsRouter.get('/', asyncRoute(async (_req, res) => {
  const artifacts = store();
  const results = [];
  for (const skill of await artifacts.listSkillsWithArtifacts()) {
    const latest = await artifacts.readLatest(skill);
    if (latest) results.push({ skillName: skill, verdict: latest.verdict, timestamp: latest.createdAt, path: latest.filePath, content: latest.content });
  }
  res.json(toProjectRelative(results));
}));

artifactsRouter.get('/:skillName/latest', asyncRoute(async (req, res) => {
  const latest = await store().readLatest(skillParam(req.params.skillName));
  if (!latest) throw new HttpError(404, 'Artifact not found', 'NOT_FOUND');
  res.json(toProjectRelative(latest));
}));

artifactsRouter.get('/:skillName/diff', asyncRoute(async (req, res) => {
  const skillName = skillParam(req.params.skillName);
  const v1 = versionParam(req.query.v1, 'v1');
  const v2 = versionParam(req.query.v2, 'v2');
  const artifacts = store();
  const [oldArt, newArt] = await Promise.all([artifacts.read(skillName, v1), artifacts.read(skillName, v2)]);
  if (!oldArt || !newArt) throw new HttpError(404, 'Version not found', 'NOT_FOUND');
  const semanticSummary = newArt.verdict !== oldArt.verdict
    ? `Verdict changed from ${oldArt.verdict ?? 'none'} to ${newArt.verdict ?? 'none'}.`
    : 'Verdict unchanged.';
  res.json(toProjectRelative({ v1: oldArt, v2: newArt, semanticSummary }));
}));

artifactsRouter.get('/:skillName', asyncRoute(async (req, res) => {
  const versions = await store().list(skillParam(req.params.skillName));
  res.json(versions.map((artifact) => ({ id: artifact.id, timestamp: artifact.createdAt, verdict: artifact.verdict })));
}));
