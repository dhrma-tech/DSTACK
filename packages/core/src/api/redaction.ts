/**
 * Data Redaction Utilities
 * Handles secret and session redaction for security
 */


// Common secret patterns to redact
const SECRET_PATTERNS = [
  /password\s*[:=]\s*["']?([^"'\s]+)/gi,
  /secret\s*[:=]\s*["']?([^"'\s]+)/gi,
  /token\s*[:=]\s*["']?([^"'\s]+)/gi,
  /key\s*[:=]\s*["']?([^"'\s]+)/gi,
  /api[_-]?key\s*[:=]\s*["']?([^"'\s]+)/gi,
  /auth[_-]?token\s*[:=]\s*["']?([^"'\s]+)/gi,
  /bearer\s+([a-zA-Z0-9._-]+)/gi,
  /[_-]?secret[_-]?=/gi,
  /[_-]?password[_-]?=/gi,
  /[_-]?token[_-]?=/gi,
];

// Environment variable patterns
const ENV_VAR_PATTERNS = [
  /([A-Z_]*SECRET[A-Z_]*)/gi,
  /([A-Z_]*PASSWORD[A-Z_]*)/gi,
  /([A-Z_]*TOKEN[A-Z_]*)/gi,
  /([A-Z_]*KEY[A-Z_]*)/gi,
  /([A-Z_]*AUTH[A-Z_]*)/gi,
];

// File path patterns that might contain secrets
const SECRET_FILE_PATTERNS = [
  /\.env(\.[a-zA-Z0-9]+)?$/i,
  /.*\/secrets\/.*/,
  /.*\/private\/.*/,
  /.*\/\.ssh\/.*/,
  /.*\/\.aws\/.*/,
  /.*\/\.docker\/.*/,
];

export class DataRedactor {
  private readonly redactionString: string;

  constructor(redactionString: string = '[REDACTED]') {
    this.redactionString = redactionString;
  }

  /**
   * Redacts secrets from a string
   */
  redactSecrets(input: string): string {
    let redacted = input;

    // Apply secret patterns
    for (const pattern of SECRET_PATTERNS) {
      redacted = redacted.replace(pattern, (match) => {
        return match.replace(/[^:=\s]+$/g, this.redactionString);
      });
    }

    // Redact potential environment variable values
    redacted = redacted.replace(/([A-Z_]*(?:SECRET|PASSWORD|TOKEN|KEY|AUTH)[A-Z_]*)\s*[:=]\s*["']?([^"'\s]+)["']?/gi, `$1=${this.redactionString}`);

    return redacted;
  }

  /**
   * Redacts environment variable names but keeps their structure
   */
  redactEnvVars(input: string): string {
    let redacted = input;

    for (const pattern of ENV_VAR_PATTERNS) {
      redacted = redacted.replace(pattern, (match) => {
        return match.substring(0, 3) + '*'.repeat(match.length - 3);
      });
    }

    return redacted;
  }

  /**
   * Redacts sensitive file paths
   */
  redactFilePaths(input: string): string {
    let redacted = input;

    for (const pattern of SECRET_FILE_PATTERNS) {
      redacted = redacted.replace(pattern, '[SECRET_FILE]');
    }

    return redacted;
  }

  /**
   * Redacts provider configuration to only expose env var names/status
   */
  redactProviderConfig(config: Record<string, unknown>): Record<string, unknown> {
    if (!config || typeof config !== 'object') {
      return config;
    }

    const redacted = { ...config };

    // Redact sensitive provider fields
    const sensitiveFields = ['apiKey', 'apiSecret', 'token', 'password', 'privateKey', 'secretKey'];
    
    for (const field of sensitiveFields) {
      if (redacted[field]) {
        redacted[field] = this.redactionString;
      }
    }

    // For environment variables, only show names, not values
    if (redacted.environment) {
      const env = redacted.environment as Record<string, unknown>;
      const redactedEnv: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(env)) {
        if (this.isSensitiveEnvVar(key)) {
          redactedEnv[key] = this.redactionString;
        } else {
          redactedEnv[key] = value;
        }
      }

      redacted.environment = redactedEnv;
    }

    return redacted;
  }

  /**
   * Redacts browser session information
   */
  redactBrowserSession(session: Record<string, unknown>): Record<string, unknown> {
    if (!session || typeof session !== 'object') {
      return session;
    }

    const redacted = { ...session };

    // Redact sensitive session data
    const sensitiveFields = [
      'cookies',
      'localStorage',
      'sessionStorage',
      'sessionFile',
      'cookieFile',
      'authToken',
      'sessionId'
    ];

    for (const field of sensitiveFields) {
      if (redacted[field]) {
        if (typeof redacted[field] === 'string') {
          // Redact file paths
          redacted[field] = this.redactFilePaths(redacted[field] as string);
        } else if (typeof redacted[field] === 'object') {
          // Redact object contents but keep structure
          redacted[field] = this.redactObject(redacted[field] as Record<string, unknown>);
        }
      }
    }

    return redacted;
  }

  /**
   * Redacts tool call arguments and logs
   */
  redactToolCall(toolCall: Record<string, unknown>): Record<string, unknown> {
    if (!toolCall || typeof toolCall !== 'object') {
      return toolCall;
    }

    const redacted = { ...toolCall };

    // Redact arguments
    if (redacted.args) {
      redacted.args = this.redactObject(redacted.args as Record<string, unknown>);
    }

    // Redact sensitive tool names
    if (redacted.name && this.isSensitiveTool(redacted.name as string)) {
      redacted.name = '[SENSITIVE_TOOL]';
    }

    return redacted;
  }

  /**
   * Redacts DSTACK.md injection content
   */
  redactDstackMd(content: string): string {
    // Mark DSTACK.md content as untrusted
    const marker = '[UNTRUSTED_CONTENT]';
    return `${marker}\n${this.redactSecrets(content)}\n${marker}`;
  }

  /**
   * Redacts an object recursively
   */
  private redactObject(obj: Record<string, unknown>): Record<string, unknown> {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.redactObject(item as Record<string, unknown>)) as unknown as Record<string, unknown>;
    }

    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        redacted[key] = this.redactSecrets(value);
      } else if (typeof value === 'object') {
        redacted[key] = this.redactObject(value as Record<string, unknown>);
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
  }

  /**
   * Checks if an environment variable name is sensitive
   */
  private isSensitiveEnvVar(varName: string): boolean {
    const upperName = varName.toUpperCase();
    return ENV_VAR_PATTERNS.some(pattern => pattern.test(upperName));
  }

  /**
   * Checks if a tool name is sensitive
   */
  private isSensitiveTool(toolName: string): boolean {
    const sensitiveTools = [
      'execute',
      'shell',
      'bash',
      'cmd',
      'powershell',
      'sudo',
      'git',
      'curl',
      'wget',
      'ssh',
      'scp'
    ];

    return sensitiveTools.some(tool => toolName.toLowerCase().includes(tool));
  }

  /**
   * Redacts common secret patterns from any data structure
   */
  redact(data: unknown): unknown {
    if (typeof data === 'string') {
      return this.redactSecrets(data);
    }

    if (Array.isArray(data)) {
      return data.map(item => this.redact(item));
    }

    if (typeof data === 'object' && data !== null) {
      return this.redactObject(data as Record<string, unknown>);
    }

    return data;
  }

  /**
   * Creates a safe DTO by redacting sensitive information
   */
  createSafeDto<T>(data: T): T {
    return this.redact(data) as T;
  }

  /**
   * Validates that no secrets are present in data
   */
  validateNoSecrets(data: unknown): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    const dataString = JSON.stringify(data);

    for (const pattern of SECRET_PATTERNS) {
      const matches = dataString.match(pattern);
      if (matches) {
        issues.push(`Secret pattern detected: ${matches[0]}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

/**
 * Global redactor instance
 */
export const redactor = new DataRedactor();

/**
 * Convenience functions for common redaction tasks
 */
export function redactSecrets(input: string): string {
  return redactor.redactSecrets(input);
}

export function redactProviderConfig(config: Record<string, unknown>): Record<string, unknown> {
  return redactor.redactProviderConfig(config);
}

export function redactBrowserSession(session: Record<string, unknown>): Record<string, unknown> {
  return redactor.redactBrowserSession(session);
}

export function redactToolCall(toolCall: Record<string, unknown>): Record<string, unknown> {
  return redactor.redactToolCall(toolCall);
}

export function redactDstackMd(content: string): string {
  return redactor.redactDstackMd(content);
}
