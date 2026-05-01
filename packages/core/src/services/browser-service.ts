/**
 * Browser service for frontend-ready browser information
 * Provides DTO-compatible data without console output
 */

import path from "node:path";
import { BrowserStore } from "../browser/store.js";

export interface ServiceOptions {
  projectRoot: string;
  allowSecrets?: boolean;
  allowAbsolutePaths?: boolean;
}

export class BrowserService {
  private readonly browserStore: BrowserStore;

  constructor(private readonly options: ServiceOptions) {
    this.browserStore = new BrowserStore({
      dstackDir: path.join(options.projectRoot, ".dstack"),
      projectRoot: options.projectRoot,
      allowAbsolutePaths: options.allowAbsolutePaths ?? false
    });
  }

  /**
   * Get browser sessions
   */
  async getBrowserSessions(): Promise<string[]> {
    return await this.browserStore.listSessions();
  }

  /**
   * Get browser session by ID
   */
  async getBrowserSession(sessionId: string): Promise<unknown> {
    const snapshot = await this.browserStore.getLatestSnapshot(sessionId);
    const stats = await this.browserStore.getSessionStats(sessionId);
    
    return {
      sessionId,
      latestSnapshot: snapshot,
      stats: stats || {
        snapshotCount: 0,
        screenshotCount: 0,
        firstActivity: null,
        lastActivity: null,
        uniqueUrls: 0
      }
    };
  }

  /**
   * Create browser session
   */
  async createBrowserSession(config?: {
    headless?: boolean;
    url?: string;
  }): Promise<unknown> {
    // TODO: Implement browser session creation
    // For now, create a placeholder session
    const sessionId = `session-${Date.now()}`;
    
    // Save initial snapshot metadata if URL provided
    if (config?.url) {
      await this.browserStore.saveSnapshot({
        sessionId,
        url: config.url,
        title: "Initial Page",
        timestamp: new Date().toISOString(),
        viewport: { width: 1024, height: 768 },
        cookiesCount: 0,
        localStorageEntries: 0,
        sessionStorageEntries: 0,
        metadata: {
          userAgent: "dstack-browser",
          cookies: [],
          localStorage: {},
          sessionStorage: {}
        }
      });
    }
    
    return { sessionId, config };
  }

  /**
   * Close browser session
   */
  async closeBrowserSession(sessionId: string): Promise<void> {
    // TODO: Implement browser session closure
    // For now, just log that session would be closed
    console.log(`Browser session ${sessionId} would be closed`);
  }
}
