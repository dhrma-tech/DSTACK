/**
 * Error handling utilities for DStack API
 * Provides standardized error responses and error codes
 */

import { randomBytes } from "node:crypto";
import type { ServerResponse } from "node:http";
import type { Contracts } from "@dstack/shared";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public retryable: boolean = false,
    public details?: object
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function sendApiError(
  res: ServerResponse,
  error: ApiError | Error,
  requestId?: string
): void {
  const errorDetails = error instanceof ApiError ? error.details : undefined;
  
  const envelope: Contracts.ApiEnvelope = {
    ok: false,
    data: null,
    warnings: [],
    error: {
      code: error instanceof ApiError ? error.code : 'INTERNAL_ERROR',
      message: error.message,
      retryable: error instanceof ApiError ? error.retryable : false,
      ...(errorDetails !== undefined && { details: errorDetails }),
      requestId: requestId ?? randomBytes(16).toString('hex')
    },
    meta: {
      requestId: requestId ?? randomBytes(16).toString('hex'),
      timestamp: new Date().toISOString(),
      apiVersion: 'v1'
    }
  };

  const statusCode = error instanceof ApiError ? error.statusCode : 500;
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(envelope, null, 0));
}

export function sendApiSuccess<T>(
  res: ServerResponse,
  data: T,
  requestId?: string,
  warnings?: Contracts.ApiEnvelope['warnings']
): void {
  const envelope: Contracts.ApiEnvelope<T> = {
    ok: true,
    data,
    warnings: warnings ?? [],
    error: null,
    meta: {
      requestId: requestId ?? randomBytes(16).toString('hex'),
      timestamp: new Date().toISOString(),
      apiVersion: 'v1'
    }
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(envelope, null, 0));
}

// Predefined error types
export class NotFoundError extends ApiError {
  constructor(message: string = 'Resource not found') {
    super('NOT_FOUND', message, 404, false);
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string = 'Bad request') {
    super('BAD_REQUEST', message, 400, false);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401, false);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = 'Forbidden') {
    super('FORBIDDEN', message, 403, false);
  }
}

export class MethodNotAllowedError extends ApiError {
  constructor(message: string = 'Method not allowed') {
    super('METHOD_NOT_ALLOWED', message, 405, false);
  }
}

export class InternalServerError extends ApiError {
  constructor(message: string = 'Internal server error', details?: object) {
    super('INTERNAL_ERROR', message, 500, false, details);
  }
}

export class ValidationError extends ApiError {
  constructor(
    message: string = 'Validation failed',
    public fieldErrors?: Array<{ field: string; message: string }>
  ) {
    super('VALIDATION_ERROR', message, 400, false, { fieldErrors });
  }
}

export class HiddenSkillError extends ApiError {
  constructor(message: string = 'Hidden skill cannot be executed') {
    super('HIDDEN_SKILL', message, 403, false);
  }
}

export class MissingParameterError extends ApiError {
  constructor(message: string = 'Missing required parameter') {
    super('MISSING_PARAMETER', message, 400, false);
  }
}

export class InvalidHashError extends ApiError {
  constructor(message: string = 'Invalid hash format') {
    super('INVALID_HASH', message, 400, false);
  }
}

export class ApprovalRequiredError extends ApiError {
  constructor(
    message: string = 'Approval required',
    public requiredHash?: string
  ) {
    super('APPROVAL_REQUIRED', message, 403, false, { requiredHash });
  }
}

export function createRequestId(): string {
  return randomBytes(16).toString('hex');
}
