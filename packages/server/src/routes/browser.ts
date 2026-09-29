import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { BrowserService } from '@dstack/core';
import { getDstackDir, serviceOptions } from '../context';
import { asyncRoute, HttpError } from '../lib/http';

export const browserRouter = Router();

// Only plain image filenames; no separators, no traversal, no hidden files.
const SAFE_IMAGE = /^[\w][\w.-]{0,200}\.(png|jpe?g|webp)$/i;

function screenshotsDir(): string {
  return path.join(getDstackDir(), 'browser', 'screenshots');
}

// Session names only. Session files (cookies, storage) are never served.
browserRouter.get('/sessions', asyncRoute(async (_req, res) => {
  const names = await new BrowserService(serviceOptions()).getBrowserSessions();
  res.json(names.map((name) => ({ name })));
}));

browserRouter.get('/screenshots', asyncRoute(async (_req, res) => {
  let files: string[];
  try {
    files = await readdir(screenshotsDir());
  } catch {
    res.json([]);
    return;
  }
  const assets = await Promise.all(files.filter((file) => SAFE_IMAGE.test(file)).map(async (filename) => {
    const info = await stat(path.join(screenshotsDir(), filename));
    return { filename, capturedAt: info.mtime.toISOString(), hasErrors: false, url: `/api/browser/screenshots/${encodeURIComponent(filename)}` };
  }));
  res.json(assets.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt)));
}));

browserRouter.get('/screenshots/:filename', asyncRoute(async (req, res) => {
  const filename = String(req.params.filename);
  if (!SAFE_IMAGE.test(filename)) throw new HttpError(404, 'Screenshot not found', 'NOT_FOUND');
  const dir = screenshotsDir();
  const filePath = path.resolve(dir, filename);
  if (path.dirname(filePath) !== path.resolve(dir)) throw new HttpError(404, 'Screenshot not found', 'NOT_FOUND');
  try {
    await stat(filePath);
  } catch {
    throw new HttpError(404, 'Screenshot not found', 'NOT_FOUND');
  }
  // `root` scopes the dotfile check to the filename, not the .dstack path above it.
  res.sendFile(filename, { root: dir, dotfiles: 'deny', headers: { 'X-Content-Type-Options': 'nosniff' } });
}));

// Anything else under /api/browser (for example session files) is a 404.
browserRouter.use((_req, _res, next) => next(new HttpError(404, 'Not found', 'NOT_FOUND')));
