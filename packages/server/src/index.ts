import { startServer } from './server';

export { createApp } from './app';
export { startServer } from './server';
export type { RunningServer, StartServerOptions } from './server';

// Printed when DSTACK_READY_SIGNAL is set so a parent process (the `ds --serve` CLI) knows the real port.
export const READY_PREFIX = 'DSTACK_READY ';

// Run directly (`pnpm server`, `ds --serve`) rather than imported by tests.
if (require.main === module) {
  const port = Number.parseInt(process.env.API_PORT ?? process.env.PORT ?? '3001', 10);
  startServer({
    port,
    host: process.env.API_HOST ?? '127.0.0.1',
    ...(process.env.DSTACK_TOKEN_FILE ? { tokenFile: process.env.DSTACK_TOKEN_FILE } : {})
  })
    .then((server) => {
      if (process.env.DSTACK_READY_SIGNAL) {
        console.log(READY_PREFIX + JSON.stringify({ url: server.url, host: server.host, port: server.port, tokenFile: server.tokenFileRelative }));
      } else {
        console.log(`DStack server listening at ${server.url}`);
        console.log(`API token: ${server.tokenFileRelative}`);
      }
      const shutdown = () => void server.close().finally(() => process.exit(0));
      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
    })
    .catch((error: unknown) => {
      console.error('Failed to start DStack server:', error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
