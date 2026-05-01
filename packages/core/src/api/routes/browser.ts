/**
 * Browser API routes
 * Handles browser snapshots, screenshots, and logs
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Contracts } from "@dstack/shared";
import { BrowserService } from "../../services/browser-service.js";
import { BrowserStore, type BrowserSnapshotMetadata, type ScreenshotAssetMetadata } from "../../browser/store.js";
import { sendApiSuccess, sendApiError, ValidationError } from "../errors.js";
import path from "node:path";

export class BrowserRoutes {
  private readonly browserService: BrowserService;
  private readonly browserStore: BrowserStore;

  constructor(private projectRoot: string, private options: { allowSecrets?: boolean; allowAbsolutePaths?: boolean } = {}) {
    const serviceOptions: { projectRoot: string; allowSecrets?: boolean; allowAbsolutePaths?: boolean } = {
      projectRoot,
      ...(options.allowSecrets !== undefined && { allowSecrets: options.allowSecrets }),
      ...(options.allowAbsolutePaths !== undefined && { allowAbsolutePaths: options.allowAbsolutePaths })
    };
    this.browserService = new BrowserService(serviceOptions);
    this.browserStore = new BrowserStore({
      dstackDir: path.join(projectRoot, ".dstack"),
      projectRoot,
      allowAbsolutePaths: options.allowAbsolutePaths ?? false
    });
  }

  async handleListSnapshots(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string
  ): Promise<void> {
    try {
      const session = url.searchParams.get('session');
      const limit = url.searchParams.get('limit');

      let snapshots: BrowserSnapshotMetadata[];
      
      if (session) {
        snapshots = await this.browserStore.listSnapshotsBySession(session, limit ? parseInt(limit, 10) : 50);
      } else {
        snapshots = await this.browserStore.listSnapshots(limit ? parseInt(limit, 10) : 100);
      }

      // Convert to BrowserSnapshot DTO format
      const snapshotDtos: Contracts.BrowserSnapshot[] = snapshots.map(snapshot => ({
        id: snapshot.id,
        projectId: "unknown", // TODO: Get from project config
        session: snapshot.sessionId,
        createdAt: snapshot.timestamp,
        url: snapshot.url,
        title: snapshot.title,
        text: "", // TODO: Extract from snapshot content if available
        ariaTree: "", // TODO: Extract from snapshot content if available
        interactiveRefs: [], // TODO: Extract from snapshot content if available
        promptInjectionDetected: false, // TODO: Detect from snapshot metadata
        promptInjectionFragments: [],
        scannerSummary: {
          detected: false,
          fragmentCount: 0
        },
        consoleLogsCount: 0, // TODO: Get from session logs
        networkLogsCount: 0, // TODO: Get from session logs
        latestScreenshotId: snapshot.screenshotPath ? path.basename(snapshot.screenshotPath) : null,
        relativeArtifactPath: snapshot.screenshotPath ? path.relative(this.projectRoot, snapshot.screenshotPath) : null
      }));

      sendApiSuccess(res, snapshotDtos, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }

  async handleGetLatestSnapshot(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string
  ): Promise<void> {
    try {
      const pathParts = url.pathname.split('/');
      const session = pathParts[pathParts.length - 2]; // /browser/snapshots/:session/latest

      if (!session) {
        throw new ValidationError('Session is required');
      }

      const snapshot = await this.browserStore.getLatestSnapshot(session);
      
      if (!snapshot) {
        sendApiSuccess(res, null, requestId);
        return;
      }

      // Convert to BrowserSnapshot DTO format
      const snapshotDto: Contracts.BrowserSnapshot = {
        id: snapshot.id,
        projectId: "unknown", // TODO: Get from project config
        session: snapshot.sessionId,
        createdAt: snapshot.timestamp,
        url: snapshot.url,
        title: snapshot.title,
        text: "", // TODO: Extract from snapshot content if available
        ariaTree: "", // TODO: Extract from snapshot content if available
        interactiveRefs: [], // TODO: Extract from snapshot content if available
        promptInjectionDetected: false, // TODO: Detect from snapshot metadata
        promptInjectionFragments: [],
        scannerSummary: {
          detected: false,
          fragmentCount: 0
        },
        consoleLogsCount: 0, // TODO: Get from session logs
        networkLogsCount: 0, // TODO: Get from session logs
        latestScreenshotId: snapshot.screenshotPath ? path.basename(snapshot.screenshotPath) : null,
        relativeArtifactPath: snapshot.screenshotPath ? path.relative(this.projectRoot, snapshot.screenshotPath) : null
      };

      sendApiSuccess(res, snapshotDto, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }

  async handleListScreenshots(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string
  ): Promise<void> {
    try {
      const session = url.searchParams.get('session');

      let screenshots: ScreenshotAssetMetadata[];
      
      if (session) {
        screenshots = await this.browserStore.listScreenshotsBySession(session, 50);
      } else {
        screenshots = await this.browserStore.listScreenshots(100);
      }

      // Convert to ScreenshotAsset DTO format
      const screenshotDtos: Contracts.ScreenshotAsset[] = screenshots.map(screenshot => {
        const dto: Contracts.ScreenshotAsset = {
          id: screenshot.id,
          session: screenshot.sessionId,
          createdAt: screenshot.timestamp,
          relativePath: screenshot.relativePath,
          mimeType: "image/png",
          label: screenshot.filename,
          width: screenshot.width,
          height: screenshot.height,
          sizeBytes: screenshot.size
        };

        // Only add absolute path if allowed
        if (this.options.allowAbsolutePaths && screenshot.absolutePath) {
          dto.absolutePath = screenshot.absolutePath;
        }

        return dto;
      });

      sendApiSuccess(res, screenshotDtos, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }

  async handleGetSessionLogs(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string
  ): Promise<void> {
    try {
      const pathParts = url.pathname.split('/');
      const session = pathParts[pathParts.length - 1]; // /browser/logs/:session

      if (!session) {
        throw new ValidationError('Session is required');
      }

      // For now, return empty array since logs aren't implemented in BrowserStore
      // TODO: Implement proper log retrieval from browser session data
      const logs: Contracts.LogEntry[] = [];

      sendApiSuccess(res, logs, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }
}
