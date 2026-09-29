import { randomBytes } from 'node:crypto';
import { SkillRegistry } from '@dstack/core';
import type { RunRequest } from '../stream/skill-runner';
import { HttpError } from './http';

const INPUT_KEY = /^[a-z][a-z0-9-]{0,40}$/;
const MAX_INPUT_LENGTH = 20_000;

// CLI options that change how the CLI itself behaves. They must never arrive as skill inputs.
const RESERVED_KEYS = new Set([
  'help', 'version', 'list-skills', 'skill-check', 'serve', 'host', 'port', 'token-file',
  'allow-absolute-paths', 'allow-secrets', 'force', 'dry-run', 'no-stream', 'model', 'provider',
  'json', 'json-events', 'verbose', 'conditions', 'import', 'require'
]);

const registry = new SkillRegistry();

export function newRunId(): string {
  return `run-${Date.now()}-${randomBytes(4).toString('hex')}`;
}

/** Throws 404 unless the name is a registered skill. Returns the canonical name. */
export async function resolveSkillName(raw: unknown): Promise<string> {
  if (typeof raw !== 'string' || !/^\/?[a-z][a-z0-9-]{0,60}$/.test(raw)) throw new HttpError(400, 'Invalid skill name', 'VALIDATION');
  try {
    return (await registry.resolve(raw)).name;
  } catch {
    throw new HttpError(404, `Unknown skill: ${raw}`, 'UNKNOWN_SKILL');
  }
}

export function parseInputs(raw: unknown): Record<string, string> {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new HttpError(400, 'inputs must be an object', 'VALIDATION');
  const inputs: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!INPUT_KEY.test(key) || RESERVED_KEYS.has(key)) throw new HttpError(400, `Input name not allowed: ${key}`, 'VALIDATION');
    if (value === undefined || value === null || value === '') continue;
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      throw new HttpError(400, `Input ${key} must be a string, number or boolean`, 'VALIDATION');
    }
    const text = String(value);
    if (text.length > MAX_INPUT_LENGTH) throw new HttpError(400, `Input ${key} is too long`, 'VALIDATION');
    inputs[key] = text;
  }
  return inputs;
}

export function parseRunRequest(body: unknown): RunRequest {
  const source = (body ?? {}) as Record<string, unknown>;
  const flags: RunRequest['flags'] = {};
  if (source.force === true) flags.force = true;
  if (source.dryRun === true) flags.dryRun = true;
  if (source.provider !== undefined) {
    if (source.provider !== 'gemini' && source.provider !== 'fake') throw new HttpError(400, 'provider must be gemini or fake', 'VALIDATION');
    flags.provider = source.provider;
  }
  return { inputs: parseInputs(source.inputs), flags };
}
