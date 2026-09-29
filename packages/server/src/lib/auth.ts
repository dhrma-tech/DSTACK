import { randomBytes, timingSafeEqual } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from 'express';
import { HttpError } from './http';

const TICKET_TTL_MS = 60_000;
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export async function loadOrCreateToken(tokenPath: string): Promise<string> {
  try {
    const existing = (await readFile(tokenPath, 'utf-8')).trim();
    if (existing.length >= 32) return existing;
  } catch {
    // No token yet; create one below.
  }
  await mkdir(path.dirname(tokenPath), { recursive: true });
  const token = randomBytes(32).toString('hex');
  await writeFile(tokenPath, token, { encoding: 'utf-8', mode: 0o600 });
  await chmod(tokenPath, 0o600).catch(() => undefined); // no-op on Windows
  return token;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function pathnameOf(url: string): string {
  return url.split('?')[0] ?? url;
}

// EventSource cannot send an Authorization header, so streams use single-use,
// short-lived tickets bound to one path.
export class StreamTickets {
  private readonly tickets = new Map<string, { path: string; expiresAt: number }>();

  issue(streamPath: string): string {
    this.sweep();
    const ticket = randomBytes(24).toString('hex');
    this.tickets.set(ticket, { path: streamPath, expiresAt: Date.now() + TICKET_TTL_MS });
    return ticket;
  }

  consume(ticket: string, requestPath: string): boolean {
    const entry = this.tickets.get(ticket);
    if (!entry) return false;
    this.tickets.delete(ticket);
    return entry.expiresAt > Date.now() && entry.path === requestPath;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, value] of this.tickets) if (value.expiresAt <= now) this.tickets.delete(key);
  }
}

export function isStreamPath(p: string): boolean {
  return p === '/api/events' || (p.startsWith('/api/') && p.endsWith('/stream'));
}

export function requireAuth(token: string, tickets: StreamTickets): RequestHandler {
  return (req, _res, next) => {
    if (req.method === 'OPTIONS') return next();
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ') && safeEqual(header.slice(7).trim(), token)) return next();
    const ticket = req.query.ticket;
    const requestPath = pathnameOf(req.originalUrl);
    if (req.method === 'GET' && typeof ticket === 'string' && isStreamPath(requestPath) && tickets.consume(ticket, requestPath)) {
      return next();
    }
    next(new HttpError(401, header ? 'Invalid API token.' : 'Authorization Bearer token required.', header ? 'INVALID_TOKEN' : 'MISSING_TOKEN'));
  };
}

// Blocks DNS-rebinding: a browser page on evil.com resolving to 127.0.0.1 still sends Host: evil.com.
export function hostGuard(extraHosts: string[] = []): RequestHandler {
  const allowed = new Set([...LOCAL_HOSTNAMES, ...extraHosts]);
  return (req, _res, next) => {
    const host = req.headers.host ?? '';
    const hostname = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0] ?? '';
    if (allowed.has(hostname)) return next();
    next(new HttpError(403, 'Requests must target localhost.', 'FORBIDDEN_HOST'));
  };
}
