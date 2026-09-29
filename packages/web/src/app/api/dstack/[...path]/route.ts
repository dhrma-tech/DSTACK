import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Same-origin proxy to the DStack server. The API token is read here, on the server,
// and never sent to the browser.

export const dynamic = 'force-dynamic';

const UPSTREAM = process.env.DSTACK_API_URL ?? `http://127.0.0.1:${process.env.API_PORT ?? '3001'}`;
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);
const PASSTHROUGH_HEADERS = ['content-type', 'cache-control'];

function projectRoot(): string {
  if (process.env.DSTACK_PROJECT_ROOT) return path.resolve(process.env.DSTACK_PROJECT_ROOT);
  let current = process.cwd();
  while (current !== path.parse(current).root) {
    if (existsSync(path.join(current, 'pnpm-workspace.yaml'))) return current;
    current = path.dirname(current);
  }
  return process.cwd();
}

async function readToken(): Promise<string | null> {
  const tokenFile = process.env.DSTACK_TOKEN_FILE ?? path.join('.dstack', 'api', 'token');
  try {
    return (await readFile(path.resolve(projectRoot(), tokenFile), 'utf-8')).trim() || null;
  } catch {
    return null;
  }
}

function error(status: number, message: string, code: string): Response {
  return Response.json({ error: message, code }, { status });
}

function hostnameOf(host: string | null): string {
  if (!host) return '';
  return host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0] ?? '';
}

async function proxy(request: Request, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  // DNS-rebinding and cross-site request guards: only same-origin requests to localhost.
  if (!LOCAL_HOSTNAMES.has(hostnameOf(request.headers.get('host')))) return error(403, 'Requests must target localhost.', 'FORBIDDEN_HOST');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') return error(403, 'Cross-site requests are not allowed.', 'FORBIDDEN_ORIGIN');

  const { path: segments } = await ctx.params;
  if (segments.some((segment) => segment === '..' || segment === '.' || /[\\/]/.test(segment))) return error(400, 'Invalid path.', 'VALIDATION');

  const token = await readToken();
  if (!token) return error(503, 'The DStack server has not started yet. Run `pnpm server`, then reload.', 'SERVER_NOT_STARTED');

  const search = new URL(request.url).search;
  const target = `${UPSTREAM}/api/${segments.map(encodeURIComponent).join('/')}${search}`;
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: request.headers.get('accept') ?? 'application/json',
        ...(hasBody ? { 'Content-Type': request.headers.get('content-type') ?? 'application/json' } : {})
      },
      ...(hasBody ? { body: await request.arrayBuffer() } : {}),
      signal: request.signal,
      cache: 'no-store'
    });
  } catch {
    return error(502, `Can't reach the DStack server at ${UPSTREAM}. Start it with \`pnpm server\`.`, 'SERVER_UNREACHABLE');
  }

  const headers = new Headers();
  for (const name of PASSTHROUGH_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (headers.get('content-type')?.startsWith('text/event-stream')) headers.set('X-Accel-Buffering', 'no');
  return new Response(upstream.body, { status: upstream.status, headers });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
