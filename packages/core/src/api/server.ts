/**
 * HTTP JSON API Server for DStack
 * Provides local-only API access to DStack functionality
 */

import { createServer } from "node:http";
import path from "node:path";
import { ApiRouter } from "./router.js";
import { ApiAuth } from "./auth.js";

export interface ServerOptions {
  host?: string;
  port?: number;
  tokenFile?: string;
  allowAbsolutePaths?: boolean;
  projectRoot: string;
  bindLocalOnly?: boolean; // Explicit flag for 0.0.0.0 binding
  allowExternalOrigins?: boolean; // Allow non-local origins for development
}

export interface ServerInfo {
  server: unknown; // TODO: Use proper Server type
  host: string;
  port: number;
  tokenFileRelative: string;
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startDstackApiServer(options: ServerOptions): Promise<ServerInfo> {
  // Security: Default to localhost-only binding
  const host = options.host ?? "127.0.0.1";
  
  // Security: Require explicit flag to bind to 0.0.0.0
  if (host === "0.0.0.0" && !options.bindLocalOnly) {
    throw new Error("Binding to 0.0.0.0 requires bindLocalOnly flag for security");
  }
  
  const port = options.port ?? 4570;
  const tokenFile = options.tokenFile ?? ".dstack/api/token";
  const tokenFileRelative = path.relative(options.projectRoot, tokenFile).replace(/\\/g, '/');
  
  // Initialize authentication
  const auth = new ApiAuth({
    tokenFile,
    projectRoot: options.projectRoot
  });
  
  // Generate or read token (token is managed internally by ApiAuth)
  await auth.generateOrReadToken();
  
  // Initialize router with all routes
  const router = new ApiRouter({
    auth,
    projectRoot: options.projectRoot,
    allowAbsolutePaths: options.allowAbsolutePaths ?? false,
    allowExternalOrigins: options.allowExternalOrigins ?? false
  });
  
  const server = createServer((req, res) => {
    router.handleRequest(req, res);
  });
  
  let actualPort = port;
  await new Promise<void>((resolve, reject) => {
    server.listen(port, host, () => {
      // Get the actual bound port (important when port is 0)
      const address = server.address();
      if (address && typeof address === 'object') {
        actualPort = address.port;
      }
      resolve();
    });
    server.on('error', reject);
  });
  
  const baseUrl = `http://${host}:${actualPort}`;
  
  return {
    server,
    host,
    port: actualPort,
    tokenFileRelative,
    baseUrl,
    close: async () => {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  };
}

// Old functions removed - now using ApiRouter and ApiAuth
