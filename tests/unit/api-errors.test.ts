/**
 * API Error Handling Tests
 * Tests for standardized error responses and error codes
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import type { ServerResponse } from "node:http";
import { 
  ApiError, 
  NotFoundError, 
  BadRequestError, 
  UnauthorizedError,
  ForbiddenError,
  MethodNotAllowedError,
  InternalServerError,
  ValidationError,
  ApprovalRequiredError,
  sendApiError,
  sendApiSuccess,
  createRequestId
} from "../../packages/core/src/api/errors.js";

describe("API Error Handling", () => {
  let mockRes: Partial<ServerResponse>;
  let mockWriteHead: ReturnType<typeof vi.fn>;
  let mockEnd: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockWriteHead = vi.fn();
    mockEnd = vi.fn();
    mockRes = {
      writeHead: mockWriteHead,
      end: mockEnd
    };
  });

  describe("ApiError classes", () => {
    it("creates ApiError with default values", () => {
      const error = new ApiError("TEST_ERROR", "Test message");
      
      expect(error.code).toBe("TEST_ERROR");
      expect(error.message).toBe("Test message");
      expect(error.statusCode).toBe(500);
      expect(error.retryable).toBe(false);
      expect(error.details).toBeUndefined();
    });

    it("creates ApiError with custom values", () => {
      const details = { field: "test" };
      const error = new ApiError("CUSTOM_ERROR", "Custom message", 400, true, details);
      
      expect(error.code).toBe("CUSTOM_ERROR");
      expect(error.message).toBe("Custom message");
      expect(error.statusCode).toBe(400);
      expect(error.retryable).toBe(true);
      expect(error.details).toBe(details);
    });

    it("creates NotFoundError", () => {
      const error = new NotFoundError();
      expect(error.code).toBe("NOT_FOUND");
      expect(error.statusCode).toBe(404);
      expect(error.retryable).toBe(false);
    });

    it("creates BadRequestError", () => {
      const error = new BadRequestError("Bad request");
      expect(error.code).toBe("BAD_REQUEST");
      expect(error.statusCode).toBe(400);
      expect(error.retryable).toBe(false);
    });

    it("creates UnauthorizedError", () => {
      const error = new UnauthorizedError();
      expect(error.code).toBe("UNAUTHORIZED");
      expect(error.statusCode).toBe(401);
      expect(error.retryable).toBe(false);
    });

    it("creates ForbiddenError", () => {
      const error = new ForbiddenError();
      expect(error.code).toBe("FORBIDDEN");
      expect(error.statusCode).toBe(403);
      expect(error.retryable).toBe(false);
    });

    it("creates MethodNotAllowedError", () => {
      const error = new MethodNotAllowedError();
      expect(error.code).toBe("METHOD_NOT_ALLOWED");
      expect(error.statusCode).toBe(405);
      expect(error.retryable).toBe(false);
    });

    it("creates InternalServerError", () => {
      const details = { error: "Internal error" };
      const error = new InternalServerError("Server error", details);
      expect(error.code).toBe("INTERNAL_ERROR");
      expect(error.statusCode).toBe(500);
      expect(error.retryable).toBe(false);
      expect(error.details).toBe(details);
    });

    it("creates ValidationError", () => {
      const fieldErrors = [{ field: "name", message: "Required" }];
      const error = new ValidationError("Validation failed", fieldErrors);
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.statusCode).toBe(400);
      expect(error.retryable).toBe(false);
      expect(error.fieldErrors).toBe(fieldErrors);
    });

    it("creates ApprovalRequiredError", () => {
      const error = new ApprovalRequiredError("Approval needed", "abc123");
      expect(error.code).toBe("APPROVAL_REQUIRED");
      expect(error.statusCode).toBe(403);
      expect(error.retryable).toBe(false);
      expect(error.requiredHash).toBe("abc123");
    });
  });

  describe("sendApiError", () => {
    it("sends ApiError response", () => {
      const error = new NotFoundError("Resource not found");
      const requestId = "test-request-id";
      
      sendApiError(mockRes as ServerResponse, error, requestId);
      
      expect(mockWriteHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' });
      expect(mockEnd).toHaveBeenCalledWith(
        expect.stringMatching(/"ok":false.*"code":"NOT_FOUND".*"message":"Resource not found"/)
      );
    });

    it("sends generic Error response", () => {
      const error = new Error("Generic error");
      
      sendApiError(mockRes as ServerResponse, error);
      
      expect(mockWriteHead).toHaveBeenCalledWith(500, { 'Content-Type': 'application/json' });
      expect(mockEnd).toHaveBeenCalledWith(
        expect.stringMatching(/"ok":false.*"code":"INTERNAL_ERROR".*"message":"Generic error"/)
      );
    });

    it("includes requestId in response", () => {
      const error = new BadRequestError("Bad request");
      const requestId = "custom-request-id";
      
      sendApiError(mockRes as ServerResponse, error, requestId);
      
      const response = mockEnd.mock.calls[0][0];
      const parsed = JSON.parse(response);
      expect(parsed.error.requestId).toBe(requestId);
      expect(parsed.meta.requestId).toBe(requestId);
    });
  });

  describe("sendApiSuccess", () => {
    it("sends success response", () => {
      const data = { message: "Success" };
      const requestId = "success-request-id";
      
      sendApiSuccess(mockRes as ServerResponse, data, requestId);
      
      expect(mockWriteHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
      expect(mockEnd).toHaveBeenCalledWith(
        expect.stringMatching(/"ok":true.*"data":{.*"message":"Success".*}/)
      );
    });

    it("includes requestId in response", () => {
      const data = { result: "test" };
      const requestId = "success-request-id";
      
      sendApiSuccess(mockRes as ServerResponse, data, requestId);
      
      const response = mockEnd.mock.calls[0][0];
      const parsed = JSON.parse(response);
      expect(parsed.meta.requestId).toBe(requestId);
    });

    it("includes warnings in response", () => {
      const data = { result: "test" };
      const requestId = "success-request-id";
      const warnings = [{ code: "WARN", message: "Warning message", severity: "warning" as const }];
      
      sendApiSuccess(mockRes as ServerResponse, data, requestId, warnings);
      
      const response = mockEnd.mock.calls[0][0];
      const parsed = JSON.parse(response);
      expect(parsed.warnings).toEqual(warnings);
    });
  });

  describe("createRequestId", () => {
    it("creates unique request IDs", () => {
      const id1 = createRequestId();
      const id2 = createRequestId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(id1.length).toBe(32); // 16 bytes * 2 hex chars
      expect(id2.length).toBe(32);
    });
  });
});
