/**
 * API Security Utilities
 * Handles path validation, traversal protection, and asset safety
 */

import path from "node:path";
import { BadRequestError, ForbiddenError } from "./errors.js";

export class PathSecurity {
  private readonly projectRoot: string;
  private readonly allowAbsolutePaths: boolean;

  constructor(projectRoot: string, allowAbsolutePaths: boolean = false) {
    this.projectRoot = path.resolve(projectRoot);
    this.allowAbsolutePaths = allowAbsolutePaths;
  }

  /**
   * Validates and sanitizes file paths
   */
  validatePath(inputPath: string, allowAbsolute: boolean = false): string {
    if (!inputPath) {
      throw new BadRequestError('Path cannot be empty');
    }

    // Normalize path
    const normalizedPath = path.normalize(inputPath);

    // Check for path traversal attempts
    if (this.containsPathTraversal(normalizedPath)) {
      throw new ForbiddenError('Path traversal detected');
    }

    // Check if absolute paths are allowed
    if (!allowAbsolute && !this.allowAbsolutePaths) {
      if (path.isAbsolute(normalizedPath)) {
        throw new ForbiddenError('Absolute paths not allowed');
      }
    }

    // Resolve relative to project root if not absolute
    let finalPath: string;
    if (path.isAbsolute(normalizedPath)) {
      finalPath = normalizedPath;
    } else {
      finalPath = path.join(this.projectRoot, normalizedPath);
    }

    // Ensure final path is within project bounds (for relative paths)
    if (!path.isAbsolute(normalizedPath) && !this.isWithinProject(finalPath)) {
      throw new ForbiddenError('Path outside project bounds');
    }

    return finalPath;
  }

  /**
   * Validates asset IDs and converts to safe paths
   */
  validateAssetPath(assetId: string): string {
    if (!assetId) {
      throw new BadRequestError('Asset ID cannot be empty');
    }

    // Asset IDs should be alphanumeric with safe separators
    if (!/^[a-zA-Z0-9._-]+$/.test(assetId)) {
      throw new BadRequestError('Invalid asset ID format');
    }

    // Construct safe asset path within .dstack/assets
    const assetPath = path.join(this.projectRoot, '.dstack', 'assets', assetId);

    // Ensure asset path is within project bounds
    if (!this.isWithinProject(assetPath)) {
      throw new ForbiddenError('Asset path outside project bounds');
    }

    return assetPath;
  }

  /**
   * Redacts absolute paths from DTOs unless explicitly allowed
   */
  sanitizePathForDto(inputPath: string | null | undefined): string | null {
    if (!inputPath) {
      return null;
    }

    if (!this.allowAbsolutePaths && path.isAbsolute(inputPath)) {
      // Return only the filename for absolute paths
      return path.basename(inputPath);
    }

    return inputPath;
  }

  /**
   * Checks for path traversal patterns
   */
  private containsPathTraversal(inputPath: string): boolean {
    const traversalPatterns = [
      '../',
      '..\\',
      '%2e%2e%2f',
      '%2e%2e%5c',
      '..%2f',
      '..%5c',
      '%2e%2e/',
      '%2e%2e\\',
      '.../',
    ];

    const normalizedPath = inputPath.toLowerCase();
    return traversalPatterns.some(pattern => normalizedPath.includes(pattern));
  }

  /**
   * Checks if a path is within the project directory
   */
  private isWithinProject(testPath: string): boolean {
    const resolvedTestPath = path.resolve(testPath);
    return resolvedTestPath.startsWith(this.projectRoot);
  }

  /**
   * Validates Windows-style paths specifically
   */
  validateWindowsPath(inputPath: string): string {
    // Check for Windows drive letters
    const windowsDrivePattern = /^[a-zA-Z]:/;
    if (windowsDrivePattern.test(inputPath)) {
      if (!this.allowAbsolutePaths) {
        throw new ForbiddenError('Windows drive paths not allowed');
      }
    }

    // Check for UNC paths
    if (inputPath.startsWith('\\\\')) {
      throw new ForbiddenError('UNC paths not allowed');
    }

    // Normalize Windows path separators
    const normalizedPath = inputPath.replace(/\\/g, '/');

    return this.validatePath(normalizedPath);
  }

  /**
   * Creates a safe relative path for API responses
   */
  createSafeRelativePath(fullPath: string): string {
    const resolvedPath = path.resolve(fullPath);
    
    if (resolvedPath.startsWith(this.projectRoot)) {
      return path.relative(this.projectRoot, resolvedPath);
    }

    // If outside project, return just the basename
    return path.basename(resolvedPath);
  }

  /**
   * Validates multiple paths at once
   */
  validatePaths(paths: string[]): string[] {
    return paths.map(p => this.validatePath(p));
  }

  /**
   * Checks if a path is safe for asset serving
   */
  isAssetPathSafe(assetPath: string): boolean {
    try {
      const validatedPath = this.validateAssetPath(assetPath);
      return this.isWithinProject(validatedPath);
    } catch {
      return false;
    }
  }
}

/**
 * Asset serving security
 */
export class AssetSecurity {
  private readonly pathSecurity: PathSecurity;

  constructor(projectRoot: string, allowAbsolutePaths: boolean = false) {
    this.pathSecurity = new PathSecurity(projectRoot, allowAbsolutePaths);
  }

  /**
   * Validates asset access
   */
  validateAssetAccess(assetId: string): { allowed: boolean; safePath?: string; error?: string } {
    try {
      const safePath = this.pathSecurity.validateAssetPath(assetId);
      return { allowed: true, safePath };
    } catch (error) {
      return { 
        allowed: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Creates safe asset URLs
   */
  createAssetUrl(assetId: string, baseUrl: string): string {
    const validation = this.validateAssetAccess(assetId);
    if (!validation.allowed) {
      throw new ForbiddenError(`Asset access denied: ${validation.error}`);
    }

    return `${baseUrl}/v1/assets/${assetId}`;
  }

  /**
   * Redacts sensitive information from asset metadata
   */
  sanitizeAssetMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    if (!metadata) return metadata;

const sanitized = { ...metadata };

// Redact absolute paths unless allowed
if (sanitized.path) {
  sanitized.path = this.pathSecurity.sanitizePathForDto(sanitized.path as string);
}

if (sanitized.fullPath) {
  sanitized.fullPath = null; // Never expose full paths
}

// Redact any other potential path fields
['filePath', 'directory', 'folder'].forEach(field => {
  if (sanitized[field]) {
    sanitized[field] = this.pathSecurity.sanitizePathForDto(sanitized[field] as string);
      }
    });

    return sanitized;
  }
}

/**
 * Common path traversal patterns to block
 */
export const BLOCKED_PATTERNS = [
  /\.\.\//g,  // Unix traversal
  /\.\.\\/g,  // Windows traversal
  /%2e%2e%2f/gi,  // URL encoded Unix traversal
  /%2e%2e%5c/gi,  // URL encoded Windows traversal
];

/**
 * Safe file extensions for asset serving
 */
export const SAFE_EXTENSIONS = new Set([
  '.json', '.txt', '.md', '.log', '.yml', '.yaml',
  '.js', '.ts', '.html', '.css', '.xml', '.csv',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico'
]);

/**
 * Validates file extension is safe for serving
 */
export function isSafeExtension(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return SAFE_EXTENSIONS.has(ext);
}
