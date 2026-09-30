import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import notifier from 'node-notifier';
import { createApp } from './app';
import { getDstackDir, getProjectRoot, setProjectRoot } from './context';
import { loadOrCreateToken } from './lib/auth';
import { globalSkillRunner, type RunEvent } from './stream/skill-runner';

export interface StartServerOptions {
  projectRoot?: string;
  host?: string;
  port?: number;
  /** Path to the token file, relative to the project root. */
  tokenFile?: string;
  allowedOrigins?: string[];
  notifications?: boolean;
}

export interface RunningServer {
  url: string;
  host: string;
  port: number;
  tokenFileRelative: string;
  close: () => Promise<void>;
}

const DEFAULT_TOKEN_FILE = path.join('.dstack', 'api', 'token');

function attachNotifications(): () => void {
  const listener = ({ event }: { event: RunEvent }) => {
    if (event.type === 'complete') {
      notifier.notify({ title: 'DStack Skill Run', message: `/${event.skillName} finished: ${event.status}`, sound: true, wait: false });
    } else if (event.type === 'approval-required') {
      notifier.notify({ title: 'DStack Approval Required', message: `${event.toolName} needs your approval.`, sound: true, wait: false });
    }
  };
  globalSkillRunner.globalEmitter.on('global_event', listener);
  return () => globalSkillRunner.globalEmitter.off('global_event', listener);
}

export async function startServer(options: StartServerOptions = {}): Promise<RunningServer> {
  if (options.projectRoot) setProjectRoot(options.projectRoot);
  const projectRoot = getProjectRoot();
  const host = options.host ?? '127.0.0.1';
  const tokenFileRelative = options.tokenFile ?? DEFAULT_TOKEN_FILE;
  const tokenPath = path.resolve(projectRoot, tokenFileRelative);
  if (!tokenPath.startsWith(getDstackDir())) throw new Error('The token file must live inside the project .dstack folder.');
  const token = await loadOrCreateToken(tokenPath);

  const app = createApp({ token, ...(options.allowedOrigins ? { allowedOrigins: options.allowedOrigins } : {}), extraHosts: [host] });
  const detachNotifications = options.notifications === false ? () => undefined : attachNotifications();

  const server = await new Promise<Server>((resolve, reject) => {
    const listening = app.listen(options.port ?? 3001, host, () => resolve(listening));
    listening.on('error', reject);
  });
  const address = server.address() as AddressInfo;
  const displayHost = host.includes(':') ? `[${host}]` : host;

  return {
    url: `http://${displayHost}:${address.port}`,
    host,
    port: address.port,
    tokenFileRelative,
    close: () => new Promise((resolve, reject) => {
      detachNotifications();
      server.closeAllConnections();
      server.close((error) => (error ? reject(error) : resolve()));
    })
  };
}
