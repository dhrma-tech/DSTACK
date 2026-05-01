# API Routes

This document describes all available HTTP API routes in the DStack backend.

## Base URL

```
http://127.0.0.1:4570
```

## Authentication

All routes except `/v1/health` require a Bearer token:
```
Authorization: Bearer <token>
```

Token is stored in `.dstack/api/token` file.

## Currently Implemented Routes

### Health Check

**GET** `/v1/health`

Health check endpoint that does not require authentication.

**Response:**
```json
{
  "ok": true,
  "data": {
    "status": "healthy",
    "version": "0.1.0",
    "timestamp": "2025-01-01T00:00:00.000Z",
    "apiVersion": "v1"
  },
  "warnings": [],
  "error": null,
  "meta": {
    "requestId": "abc123",
    "timestamp": "2025-01-01T00:00:00.000Z",
    "apiVersion": "v1"
  }
}
```

### Projects

**GET** `/v1/projects/current`

Get information about the current project.

**Response:**
```json
{
  "ok": true,
  "data": {
    "id": "temp-project-id",
    "name": "Current Project",
    "rootDisplayPath": "/path/to/project",
    "dstackDirRelative": ".dstack",
    "workflowStage": "planning",
    "updatedAt": "2025-01-01T00:00:00.000Z",
    "provider": {
      "current": "fake",
      "available": ["gemini", "fake"],
      "geminiConfigured": false,
      "fakeAvailable": true,
      "allowLive": false,
      "defaultProvider": "fake"
    },
    "safetyMode": {
      "mode": "NORMAL",
      "blockedOperations": [],
      "gatedOperations": []
    },
    "freezeState": {
      "frozen": false,
      "reason": null,
      "scope": "all"
    },
    "artifactCounts": {
      "total": 0,
      "latest": 0,
      "stale": 0
    },
    "learningCount": 0
  },
  "warnings": [],
  "error": null,
  "meta": {
    "requestId": "abc123",
    "timestamp": "2025-01-01T00:00:00.000Z",
    "apiVersion": "v1"
  }
}
```

## Planned Routes (Not Yet Implemented)

The following routes are planned but not yet implemented in the current backend:

### Skills
- **GET** `/v1/skills` - List available skills
- **POST** `/v1/skills/{skillName}/run` - Execute a skill

### Artifacts
- **GET** `/v1/artifacts` - List artifacts
- **GET** `/v1/artifacts/{artifactId}` - Get specific artifact
- **POST** `/v1/artifacts` - Create artifact

### Workflow
- **GET** `/v1/workflow` - Get workflow state

### Deploy
- **GET** `/v1/deploy/status` - Get deployment status
- **POST** `/v1/deploy` - Deploy project

### Benchmark
- **GET** `/v1/benchmark` - Get benchmark results
- **POST** `/v1/benchmark` - Run benchmark

## Current Limitations

1. **Limited API Surface** - Only health and projects endpoints are implemented
2. **No Skill Execution** - Skills must be executed via CLI, not API
3. **No Artifact Management** - Artifacts managed through CLI only
4. **No Workflow Control** - Workflow state not exposed via API
5. **No Deployment Control** - Deployment controlled via CLI only

## Frontend Integration Strategy

For current frontend development:

1. **Use CLI for Core Operations** - Execute skills via CLI commands
2. **Use API for Project Info** - Get project configuration via `/v1/projects/current`
3. **Use Health Endpoint** - Check backend status via `/v1/health`
4. **Monitor CLI Output** - Parse CLI JSON output for skill results
5. **Implement CLI Bridge** - Create backend service that wraps CLI commands

## CLI Bridge Example

Frontend can implement a CLI bridge service:

```javascript
class DStackBridge {
  async executeSkill(skillName, inputs = {}, flags = {}) {
    const command = `DSTACK_PROVIDER=fake pnpm ds -- /${skillName} --json`;
    // Execute command and parse JSON output
    // Return standardized response format
  }
  
  async getProjectInfo() {
    const response = await fetch('/v1/projects/current', {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    return response.json();
  }
  
  async checkHealth() {
    const response = await fetch('/v1/health');
    return response.json();
  }
}
```

## Error Responses

All routes may return error responses in the standard format:

```json
{
  "ok": false,
  "data": null,
  "warnings": [],
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "retryable": false,
    "details": null,
    "fieldErrors": [],
    "approvalRequired": false,
    "requiredHash": null,
    "requestId": "abc123"
  },
  "meta": {
    "requestId": "abc123",
    "timestamp": "2025-01-01T00:00:00.000Z",
    "apiVersion": "v1"
  }
}
```

## CORS Headers

The API sets CORS headers for allowed origins:

```
Access-Control-Allow-Origin: <origin>
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
```

## Rate Limiting

Currently no rate limiting is implemented, but this may change in future versions.
