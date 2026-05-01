/**
 * BrowserStore - Storage and indexing for browser snapshots and screenshots
 * Persists metadata when browser_snapshot and browser_screenshot skills run
 */

import path from "node:path";
import fs from "node:fs/promises";
import { ensureDir, exists, shortHash, nowIso } from "../utils.js";

export interface BrowserStoreOptions {
  dstackDir: string;
  projectRoot: string;
  allowAbsolutePaths?: boolean;
}

export interface BrowserSnapshotMetadata {
  id: string;
  sessionId: string;
  url: string;
  title: string;
  timestamp: string;
  screenshotPath?: string;
  htmlPath?: string;
  viewport: {
    width: number;
    height: number;
  };
  cookiesCount: number;
  localStorageEntries: number;
  sessionStorageEntries: number;
  metadata?: Record<string, unknown>;
}

export interface ScreenshotAssetMetadata {
  id: string;
  sessionId: string;
  filename: string;
  timestamp: string;
  width: number;
  height: number;
  format: "png" | "jpg" | "webp";
  size: number;
  relativePath: string;
  absolutePath?: string;
  metadata?: Record<string, unknown>;
}

export class BrowserStore {
  private readonly browserDir: string;
  private readonly snapshotsPath: string;
  private readonly screenshotsPath: string;

  constructor(private readonly options: BrowserStoreOptions) {
    this.browserDir = path.join(options.dstackDir, "browser");
    this.snapshotsPath = path.join(this.browserDir, "snapshots.json");
    this.screenshotsPath = path.join(this.browserDir, "screenshots.json");
  }

  /**
   * Initialize the browser store directories and index files
   */
  async init(): Promise<void> {
    await ensureDir(this.browserDir);
    
    if (!(await exists(this.snapshotsPath))) {
      await fs.writeFile(this.snapshotsPath, JSON.stringify({ snapshots: [], lastUpdated: nowIso() }, null, 2));
    }
    
    if (!(await exists(this.screenshotsPath))) {
      await fs.writeFile(this.screenshotsPath, JSON.stringify({ screenshots: [], lastUpdated: nowIso() }, null, 2));
    }
  }

  /**
   * Save browser snapshot metadata
   */
  async saveSnapshot(metadata: Omit<BrowserSnapshotMetadata, "id">): Promise<BrowserSnapshotMetadata> {
    await this.init();

    const snapshot: BrowserSnapshotMetadata = {
      id: shortHash(`${metadata.sessionId}-${metadata.timestamp}`, 12),
      ...metadata
    };

    const index = await this.readSnapshotsIndex();
    index.snapshots.unshift(snapshot); // Add to beginning for newest-first order
    index.lastUpdated = nowIso();
    await this.writeSnapshotsIndex(index);

    return snapshot;
  }

  /**
   * Save screenshot asset metadata
   */
  async saveScreenshot(metadata: Omit<ScreenshotAssetMetadata, "id">): Promise<ScreenshotAssetMetadata> {
    await this.init();

    const screenshot: ScreenshotAssetMetadata = {
      id: shortHash(`${metadata.sessionId}-${metadata.filename}`, 12),
      ...metadata
    };

    const index = await this.readScreenshotsIndex();
    index.screenshots.unshift(screenshot); // Add to beginning for newest-first order
    index.lastUpdated = nowIso();
    await this.writeScreenshotsIndex(index);

    return screenshot;
  }

  /**
   * List all browser sessions
   */
  async listSessions(): Promise<string[]> {
    const snapshots = await this.readSnapshotsIndex();
    const sessionIds = new Set<string>();
    
    for (const snapshot of snapshots.snapshots) {
      sessionIds.add(snapshot.sessionId);
    }
    
    return Array.from(sessionIds).sort();
  }

  /**
   * List all browser snapshots
   */
  async listSnapshots(limit = 100): Promise<BrowserSnapshotMetadata[]> {
    const index = await this.readSnapshotsIndex();
    return index.snapshots.slice(0, limit);
  }

  /**
   * List snapshots for a specific session
   */
  async listSnapshotsBySession(sessionId: string, limit = 50): Promise<BrowserSnapshotMetadata[]> {
    const index = await this.readSnapshotsIndex();
    const sessionSnapshots = index.snapshots.filter(s => s.sessionId === sessionId);
    return sessionSnapshots.slice(0, limit);
  }

  /**
   * Get latest snapshot for a session
   */
  async getLatestSnapshot(sessionId: string): Promise<BrowserSnapshotMetadata | null> {
    const snapshots = await this.listSnapshotsBySession(sessionId, 1);
    return snapshots[0] || null;
  }

  /**
   * List all screenshots
   */
  async listScreenshots(limit = 100): Promise<ScreenshotAssetMetadata[]> {
    const index = await this.readScreenshotsIndex();
    return index.screenshots.slice(0, limit);
  }

  /**
   * List screenshots for a specific session
   */
  async listScreenshotsBySession(sessionId: string, limit = 50): Promise<ScreenshotAssetMetadata[]> {
    const index = await this.readScreenshotsIndex();
    const sessionScreenshots = index.screenshots.filter(s => s.sessionId === sessionId);
    return sessionScreenshots.slice(0, limit);
  }

  /**
   * Get browser session statistics
   */
  async getSessionStats(sessionId: string): Promise<{
    snapshotCount: number;
    screenshotCount: number;
    firstActivity: string | null;
    lastActivity: string | null;
    uniqueUrls: number;
  } | null> {
    const snapshots = await this.listSnapshotsBySession(sessionId);
    const screenshots = await this.listScreenshotsBySession(sessionId);
    
    if (snapshots.length === 0 && screenshots.length === 0) {
      return null;
    }

    const allTimestamps = [
      ...snapshots.map(s => s.timestamp),
      ...screenshots.map(s => s.timestamp)
    ].sort();

    const uniqueUrls = new Set(snapshots.map(s => s.url));

    return {
      snapshotCount: snapshots.length,
      screenshotCount: screenshots.length,
      firstActivity: allTimestamps[0] || null,
      lastActivity: allTimestamps[allTimestamps.length - 1] || null,
      uniqueUrls: uniqueUrls.size
    };
  }

  /**
   * Clean up old browser data (keep last N sessions)
   */
  async cleanup(keepSessions = 50): Promise<number> {
    const snapshotsIndex = await this.readSnapshotsIndex();
    const screenshotsIndex = await this.readScreenshotsIndex();
    
    // Get most recent sessions
    const recentSessions = new Set<string>();
    const sortedSnapshots = [...snapshotsIndex.snapshots].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    for (const snapshot of sortedSnapshots.slice(0, keepSessions)) {
      recentSessions.add(snapshot.sessionId);
    }

    // Filter out old sessions
    const originalSnapshotCount = snapshotsIndex.snapshots.length;
    const originalScreenshotCount = screenshotsIndex.screenshots.length;
    
    snapshotsIndex.snapshots = snapshotsIndex.snapshots.filter(s => recentSessions.has(s.sessionId));
    screenshotsIndex.screenshots = screenshotsIndex.screenshots.filter(s => recentSessions.has(s.sessionId));
    
    snapshotsIndex.lastUpdated = nowIso();
    screenshotsIndex.lastUpdated = nowIso();
    
    await this.writeSnapshotsIndex(snapshotsIndex);
    await this.writeScreenshotsIndex(screenshotsIndex);

    return (originalSnapshotCount - snapshotsIndex.snapshots.length) + 
           (originalScreenshotCount - screenshotsIndex.screenshots.length);
  }

  private async readSnapshotsIndex(): Promise<{ snapshots: BrowserSnapshotMetadata[]; lastUpdated: string }> {
    try {
      if (!(await exists(this.snapshotsPath))) {
        return { snapshots: [], lastUpdated: nowIso() };
      }
      const data = await fs.readFile(this.snapshotsPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      // Directory can't be read
      return { snapshots: [], lastUpdated: nowIso() };
    }
  }

  private async writeSnapshotsIndex(index: { snapshots: BrowserSnapshotMetadata[]; lastUpdated: string }): Promise<void> {
    await fs.writeFile(this.snapshotsPath, JSON.stringify(index, null, 2));
  }

  private async readScreenshotsIndex(): Promise<{ screenshots: ScreenshotAssetMetadata[]; lastUpdated: string }> {
    try {
      if (!(await exists(this.screenshotsPath))) {
        return { screenshots: [], lastUpdated: nowIso() };
      }
      const data = await fs.readFile(this.screenshotsPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return { screenshots: [], lastUpdated: nowIso() };
    }
  }

  private async writeScreenshotsIndex(index: { screenshots: ScreenshotAssetMetadata[]; lastUpdated: string }): Promise<void> {
    await fs.writeFile(this.screenshotsPath, JSON.stringify(index, null, 2));
  }
}
