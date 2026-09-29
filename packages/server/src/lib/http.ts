import type { NextFunction, Request, RequestHandler, Response } from 'express';

export class HttpError extends Error {
  constructor(readonly status: number, message: string, readonly code?: string) {
    super(message);
  }
}

// Wraps an async handler so thrown errors reach the error middleware.
export function asyncRoute(handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) return;
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, ...(err.code ? { code: err.code } : {}) });
    return;
  }
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL' });
}

export function openSse(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
}

export function writeSse(res: Response, data: unknown): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// Fixed-window in-memory limiter; enough for a single-user local server.
export function rateLimit(maxPerMinute: number): RequestHandler {
  const hits = new Map<string, { count: number; windowStart: number }>();
  return (req, _res, next) => {
    const key = `${req.ip ?? 'local'}:${req.baseUrl}${req.route?.path ?? req.path}`;
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now - entry.windowStart > 60_000) {
      hits.set(key, { count: 1, windowStart: now });
      return next();
    }
    entry.count += 1;
    if (entry.count > maxPerMinute) return next(new HttpError(429, 'Too many requests. Try again in a minute.', 'RATE_LIMITED'));
    next();
  };
}
