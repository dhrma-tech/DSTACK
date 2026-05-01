/**
 * Assets API routes
 * Handles asset serving with path safety and traversal protection
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Contracts } from "@dstack/shared";
import { readFile, access } from "node:fs/promises";
import { sendApiSuccess, sendApiError, NotFoundError, ForbiddenError, BadRequestError } from "../errors.js";
import { AssetSecurity, PathSecurity, isSafeExtension } from "../security.js";

export class AssetsRoutes {
  private readonly assetSecurity: AssetSecurity;
  private readonly pathSecurity: PathSecurity;

  constructor(projectRoot: string, allowAbsolutePaths: boolean = false) {
    this.assetSecurity = new AssetSecurity(projectRoot, allowAbsolutePaths);
    this.pathSecurity = new PathSecurity(projectRoot, allowAbsolutePaths);
  }

  async handleGetAsset(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string
  ): Promise<void> {
    try {
      if (req.method !== 'GET') {
        throw new BadRequestError('Asset requests must use GET method');
      }

      const pathMatch = url.pathname.match(/^\/v1\/assets\/(.+)$/);
      if (!pathMatch) {
        throw new NotFoundError('Invalid asset endpoint');
      }

      const assetId = decodeURIComponent(pathMatch[1] || '');
      
      // Validate asset access
      const validation = this.assetSecurity.validateAssetAccess(assetId);
      if (!validation.allowed) {
        throw new ForbiddenError(`Asset access denied: ${validation.error}`);
      }

      const assetPath = validation.safePath!;

      // Check if file exists
      try {
        await access(assetPath);
      } catch {
        throw new NotFoundError(`Asset not found: ${assetId}`);
      }

      // Check file extension is safe
      if (!isSafeExtension(assetPath || '')) {
        throw new ForbiddenError(`Asset type not allowed: ${assetPath}`);
      }

      // Read and serve file
      const fileContent = await readFile(assetPath || '');
      
      // Set appropriate content type
      const contentType = this.getContentType(assetPath || '');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      
      sendApiSuccess(res, fileContent, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }

  async handleListAssets(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string
  ): Promise<void> {
    try {
      if (req.method !== 'GET') {
        throw new BadRequestError('Asset list requests must use GET method');
      }

      const includePaths = url.searchParams.get('includePaths') === 'true';
      const limit = parseInt(url.searchParams.get('limit') || '50');
      
      // List assets from .dstack/assets directory
      const assets = await this.listAssetFiles(includePaths, limit);
      
      const assetList: Contracts.AssetList = {
        assets: assets,
        total: assets.length,
        limit,
        includePaths
      };

      sendApiSuccess(res, assetList, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }

  async handleAssetMetadata(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string
  ): Promise<void> {
    try {
      if (req.method !== 'GET') {
        throw new BadRequestError('Asset metadata requests must use GET method');
      }

      const pathMatch = url.pathname.match(/^\/v1\/assets\/(.+)\/metadata$/);
      if (!pathMatch) {
        throw new NotFoundError('Invalid asset metadata endpoint');
      }

      const assetId = decodeURIComponent(pathMatch[1] || '');
      
      // Validate asset access
      const validation = this.assetSecurity.validateAssetAccess(assetId);
      if (!validation.allowed) {
        throw new ForbiddenError(`Asset access denied: ${validation.error}`);
      }

      const assetPath = validation.safePath!;

      // Check if file exists
      try {
        await access(assetPath);
      } catch {
        throw new NotFoundError(`Asset not found: ${assetId}`);
      }

      // Get file stats
      const { stat } = await import('node:fs/promises');
      const stats = await stat(assetPath);

      const metadata = this.assetSecurity.sanitizeAssetMetadata({
        assetId,
        filename: await import('node:path').then(p => p.basename(assetPath)),
        size: stats.size,
        createdAt: stats.birthtime.toISOString(),
        modifiedAt: stats.mtime.toISOString(),
        contentType: this.getContentType(assetPath || ''),
        path: this.pathSecurity.createSafeRelativePath(assetPath || ''),
        fullPath: null // Never expose full paths for security
      });

      sendApiSuccess(res, metadata, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }

  private async listAssetFiles(includePaths: boolean, limit: number): Promise<Contracts.Asset[]> {
    const { readdir, stat } = await import('node:fs/promises');
    const path = await import('node:path');
    
    const assetsDir = path.join(this.pathSecurity['projectRoot'], '.dstack', 'assets');
    const assets: Contracts.Asset[] = [];

    try {
      const files = await readdir(assetsDir, { withFileTypes: true });
      
      for (const file of files.slice(0, limit)) {
        if (file.isFile() && isSafeExtension(file.name)) {
          const filePath = path.join(assetsDir, file.name);
          const stats = await stat(filePath);
          
          const asset: Contracts.Asset = {
            assetId: file.name,
            filename: file.name,
            size: stats.size,
            createdAt: stats.birthtime.toISOString(),
            modifiedAt: stats.mtime.toISOString(),
            contentType: this.getContentType(filePath),
            path: includePaths ? this.pathSecurity.createSafeRelativePath(filePath) : null
          };

          assets.push(asset);
        }
      }
    } catch {
      // Assets directory doesn't exist, return empty list
    }

    return assets;
  }

  private getContentType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    
    const contentTypes: Record<string, string> = {
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.log': 'text/plain',
      '.yml': 'text/yaml',
      '.yaml': 'text/yaml',
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.html': 'text/html',
      '.css': 'text/css',
      '.xml': 'application/xml',
      '.csv': 'text/csv',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };

    return contentTypes[ext] || 'application/octet-stream';
  }
}
