import { Router } from 'express';
import { ConfigManager, SafetyModeManager, type ConfigFileUpdate } from '@dstack/core';
import { getDstackDir, getProjectRoot } from '../context';
import { asyncRoute, HttpError } from '../lib/http';

export const settingsRouter = Router();

function maskKey(key: string | null): string {
  if (!key) return '';
  return `••••••••${key.slice(-4)}`;
}

async function readSettings() {
  const config = await ConfigManager.load({ projectRoot: getProjectRoot(), allowSecrets: true });
  const safety = await new SafetyModeManager({ dstackDir: getDstackDir() }).read();
  return {
    provider: config.provider,
    // We can't know a key is valid without calling Gemini, so a present key is reported as unverified.
    geminiApiKeyStatus: config.geminiApiKey ? 'unverified' : 'missing',
    maskedKey: maskKey(config.geminiApiKey),
    defaultModel: config.defaultModel,
    proModel: config.proModel,
    maxTokens: config.maxTokens,
    requestTimeoutMs: config.requestTimeoutMs,
    safetyMode: safety.mode
  };
}

settingsRouter.get('/', asyncRoute(async (_req, res) => {
  res.json(await readSettings());
}));

const STRING_FIELDS = ['defaultModel', 'proModel'] as const;
const INT_FIELDS = ['maxTokens', 'requestTimeoutMs', 'maxRetries'] as const;
// Read-only fields the UI may echo back from GET are ignored rather than rejected.
const READ_ONLY_FIELDS = ['geminiApiKeyStatus', 'maskedKey', 'safetyMode'] as const;
const ALLOWED_FIELDS = new Set<string>([...STRING_FIELDS, ...INT_FIELDS, ...READ_ONLY_FIELDS, 'provider']);

settingsRouter.put('/', asyncRoute(async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (ALLOWED_FIELDS.has(key)) continue;
    if (/api.?key|secret|password|credential/i.test(key)) {
      throw new HttpError(400, 'API keys cannot be set through this endpoint. Add GEMINI_API_KEY to your .env file.', 'SECRET_NOT_ALLOWED');
    }
    throw new HttpError(400, `Unknown setting: ${key}`, 'VALIDATION');
  }
  const patch: ConfigFileUpdate = {};
  for (const field of STRING_FIELDS) {
    const value = body[field];
    if (value === undefined) continue;
    if (typeof value !== 'string' || !/^[\w.-]{1,100}$/.test(value)) throw new HttpError(400, `${field} must be a model name`, 'VALIDATION');
    patch[field] = value;
  }
  for (const field of INT_FIELDS) {
    const value = body[field];
    if (value === undefined) continue;
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) throw new HttpError(400, `${field} must be a positive integer`, 'VALIDATION');
    patch[field] = value;
  }
  if (body.provider !== undefined) {
    if (body.provider !== 'gemini' && body.provider !== 'fake') throw new HttpError(400, 'provider must be gemini or fake', 'VALIDATION');
    patch.provider = body.provider;
  }
  await ConfigManager.updateFile(getProjectRoot(), patch);
  res.json(await readSettings());
}));
