# Backend Contracts

This document defines the stable contracts between the DStack backend and frontend systems.

## API Response Format

All API responses use the `ApiEnvelope` format:

```typescript
interface ApiEnvelope<T = unknown> {
  ok: boolean;
  data: T | null;
  warnings: Array<{
    code: string;
    message: string;
    severity: "info" | "warning" | "error";
  }>;
  error: null | {
    code: string;
    message: string;
    retryable: boolean;
    details?: object | null;
    fieldErrors?: Array<{
      field: string;
      message: string;
    }>;
    approvalRequired?: boolean;
    requiredHash?: string | null;
    requestId: string;
  };
  meta: {
    requestId: string;
    timestamp: string;
    apiVersion: string;
  };
}
```

## DTO Groups

### Project DTO
```typescript
interface Project {
  id: string;
  name: string;
  rootDisplayPath: string;
  dstackDirRelative: string;
  workflowStage: "planning" | "design" | "build" | "qa" | "shipped" | "unknown";
  updatedAt: string;
  provider: {
    current: "gemini" | "fake";
    available: string[];
    geminiConfigured: boolean;
    fakeAvailable: boolean;
    allowLive: boolean;
    defaultProvider: string;
  };
  safetyMode: {
    mode: "NORMAL" | "CAREFUL" | "GUARD";
    blockedOperations: string[];
    gatedOperations: string[];
  };
  freezeState: {
    frozen: boolean;
    reason: string | null;
    scope: "all" | "deploy" | "skills";
  };
  artifactCounts: {
    total: number;
    latest: number;
    stale: number;
  };
  learningCount: number;
}
```

### Skill DTO
```typescript
interface Skill {
  name: string;
  command: string;
  description: string;
  stage: string;
  maturity: "complete" | "partial" | "experimental";
  handlerType: "model" | "direct" | "fallback" | "central-shim";
  registered: boolean;
  available: boolean;
  hidden: boolean;
  model: string;
  streaming: boolean;
  allowedTools: string[];
  requiresArtifacts: string[];
  artifactPath: string;
  hasLatestArtifact: boolean;
  lastRunAt: string | null;
  lastRunStatus: "running" | "complete" | "error" | "interrupted" | null;
  lastRunVerdict: "PASS" | "REVISE" | "FAIL" | null;
}
```

### SkillRun DTO
```typescript
interface SkillRun {
  id: string;
  skillName: string;
  status: "queued" | "running" | "complete" | "error" | "interrupted" | "blocked";
  verdict: "PASS" | "REVISE" | "FAIL" | null;
  startedAt: string;
  completedAt?: string | null;
  input: Record<string, JsonValue>;
  output?: JsonValue | null;
  artifacts: Artifact[];
  error?: string | null;
  requestId: string;
}
```

### Artifact DTO
```typescript
interface Artifact {
  id: string;
  name: string;
  type: "design" | "code" | "test" | "deploy" | "benchmark" | "other";
  path: string;
  relativePath: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  checksum: string;
  metadata: Record<string, JsonValue>;
  isLatest: boolean;
  isStale: boolean;
}
```

### Workflow DTO
```typescript
interface Workflow {
  id: string;
  name: string;
  stage: "planning" | "design" | "build" | "qa" | "shipped" | "unknown";
  status: "not_run" | "ready" | "running" | "complete" | "error" | "blocked" | "stale";
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
}

interface WorkflowNode {
  id: string;
  type: "skill" | "artifact" | "gate";
  label: string;
  stage: string;
  status: "not_run" | "ready" | "running" | "complete" | "error" | "blocked" | "stale";
  isRequired: boolean;
  isStale: boolean;
  skillName?: string;
  artifactId?: string;
  metadata: Record<string, JsonValue>;
}

interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  condition?: string;
}
```

## CLI JSON Output

The CLI uses the same `ApiEnvelope` format for `--json` output:

```bash
ds --list-skills --json
ds --skill-check --json
ds --run /skill-name --json
ds --workflow --json
```

Example skill list output:
```json
{
  "ok": true,
  "data": [
    {
      "name": "autoplan",
      "command": "/autoplan",
      "description": "Generate project plan",
      "stage": "planning",
      "maturity": "complete",
      "handlerType": "model",
      "registered": true,
      "available": true,
      "hidden": false,
      "model": "fake",
      "streaming": false,
      "allowedTools": [],
      "requiresArtifacts": [],
      "artifactPath": "",
      "hasLatestArtifact": false,
      "lastRunAt": null,
      "lastRunStatus": null,
      "lastRunVerdict": null
    }
  ],
  "warnings": [],
  "error": null,
  "meta": {
    "requestId": "abc123",
    "timestamp": "2025-01-01T00:00:00.000Z",
    "apiVersion": "v1"
  }
}
```

## Error Codes

Common error codes that frontend should handle:

- `MISSING_TOKEN` - Authorization Bearer token required
- `INVALID_TOKEN` - Token is invalid or expired
- `ORIGIN_NOT_ALLOWED` - External origins not allowed
- `NOT_FOUND` - Route or resource not found
- `INTERNAL_ERROR` - Server error
- `PERMISSION_DENIED` - Operation not permitted
- `APPROVAL_REQUIRED` - Operation requires user approval
- `INVALID_INPUT` - Request validation failed
- `SKILL_NOT_FOUND` - Skill not found
- `ARTIFACT_NOT_FOUND` - Artifact not found

## Security Considerations

### Token Authentication
- All non-health endpoints require `Authorization: Bearer <token>` header
- Token is stored in `.dstack/api/token`
- Tokens are 64-character hex strings
- Health endpoint (`/v1/health`) does not require authentication

### Origin Validation
- By default, only localhost origins are allowed
- External origins require `allowExternalOrigins: true` server option
- Allowed origins: `localhost`, `127.0.0.1`, `0.0.0.0`, `[::1]` on any port

### Hidden Skills
High-risk skills are hidden by default and require `includeHidden=true` parameter:
- `pair-agent`
- `setup-browser-cookies`
- `skillify`
- `dstack-upgrade`
- `make-pdf`
- `canary`
- `design-html`

### Experimental Skills
Experimental skills require `includeExperimental=true` parameter:
- Skills marked with `maturity: "experimental"` or `maturity: "partial"`

## Versioning

Backend contracts are versioned via the `apiVersion` field in the meta object.
Current version: `v1`

Breaking changes will increment the version and require frontend updates.
