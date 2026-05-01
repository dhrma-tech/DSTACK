# Frontend Readiness

This document describes how the DStack backend is prepared for frontend development and what frontend developers need to know.

## Backend Status

The DStack backend is ready for frontend development with the following characteristics:

### Stable API Contracts
- All API responses use the standardized `ApiEnvelope` format
- DTOs are well-defined and versioned
- Error codes are consistent and documented
- API version is tracked in response metadata

### Authentication System
- Token-based authentication using Bearer tokens
- Tokens stored in `.dstack/api/token`
- Health endpoint (`/v1/health`) does not require authentication
- Origin validation for security (localhost by default)

### Data Availability
- Project information and configuration
- Skill listings with hidden/experimental filtering
- Artifact management and content access
- Workflow state and execution status
- Deployment status and control
- Benchmark results and execution

## Frontend Integration Points

### 1. API Server
Start the backend API server:
```bash
pnpm ds --serve --port 4570
```

Or programmatically:
```javascript
import { startDstackApiServer } from '@dstack/core';

const serverInfo = await startDstackApiServer({
  projectRoot: '/path/to/project',
  port: 4570,
  allowExternalOrigins: true // for frontend development
});
```

### 2. Authentication
Frontend should:
1. Read token from `.dstack/api/token` or obtain via CLI
2. Include `Authorization: Bearer <token>` header in API requests
3. Handle token validation errors gracefully

### 3. Error Handling
Frontend should handle these common error scenarios:
- `MISSING_TOKEN` - Prompt user to authenticate
- `INVALID_TOKEN` - Refresh token or re-authenticate
- `ORIGIN_NOT_ALLOWED` - Configure server to allow frontend origin
- `NOT_FOUND` - Handle missing resources gracefully
- `PERMISSION_DENIED` - Show appropriate access denied UI

### 4. Real-time Updates
Backend does not currently provide WebSocket or SSE endpoints. Frontend should:
- Poll for status updates on long-running operations
- Use skill run status endpoints for progress tracking
- Implement appropriate polling intervals (every 1-5 seconds for active operations)

## Development Workflow

### Local Development Setup
1. Ensure DStack is installed and configured
2. Start backend API server with external origins allowed
3. Configure frontend to use `http://127.0.0.1:4570` as API base URL
4. Implement authentication flow using token from `.dstack/api/token`

### Data Seeding
Use these commands for deterministic test data:
```bash
# Generate project plan
DSTACK_PROVIDER=fake pnpm ds -- /autoplan --json

# Generate design variants
DSTACK_PROVIDER=fake pnpm ds -- /design-variants --json

# Run office hours simulation
DSTACK_PROVIDER=fake pnpm ds -- /office-hours --json
```

Or use API equivalents:
```javascript
// Run skill via API
const response = await fetch('/v1/skills/autoplan/run', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    inputs: {},
    flags: { dryRun: false }
  })
});
```

### Skill Categories for Frontend
Frontend should organize skills by stage and maturity:

**Planning Skills:**
- `/autoplan` - Generate project plan
- `/office-hours` - Simulate client requirements
- `/research` - Research project context

**Design Skills:**
- `/design-variants` - Generate design options
- `/design-html` - Create HTML designs (hidden)
- `/ui-review` - Review UI/UX

**Build Skills:**
- `/implement` - Generate implementation code
- `/test-plan` - Create test plans
- `/deploy-plan` - Plan deployment

**QA Skills:**
- `/test-run` - Execute tests
- `/bug-hunt` - Find and fix bugs
- `/performance-audit` - Performance analysis

## Security Considerations

### Token Management
- Tokens are sensitive and should be treated like passwords
- Frontend should store tokens securely (e.g., in memory, not localStorage)
- Implement token refresh/re-authentication flow

### Origin Validation
- Backend validates origins by default for security
- Frontend development requires `allowExternalOrigins: true` server option
- Production should use proper origin allowlisting

### Content Security
- Backend redacts sensitive information in responses
- Frontend should not expose raw error details to users
- Implement proper content sanitization for user inputs

## Performance Guidelines

### API Usage
- Use appropriate polling intervals for status updates
- Cache static data (skill lists, project info) appropriately
- Implement request deduplication for concurrent requests
- Handle rate limiting gracefully when implemented

### Data Loading
- Load skill lists on app initialization
- Implement progressive loading for large artifact lists
- Use pagination for large datasets when available
- Implement skeleton loading states for better UX

## Testing Integration

### Mock API Responses
Frontend should mock API responses using the documented DTOs:
```javascript
const mockProject = {
  id: "test-project",
  name: "Test Project",
  // ... other Project fields
};

const mockApiResponse = {
  ok: true,
  data: mockProject,
  warnings: [],
  error: null,
  meta: {
    requestId: "test-request",
    timestamp: new Date().toISOString(),
    apiVersion: "v1"
  }
};
```

### Integration Tests
- Test against actual backend API in CI/CD
- Use deterministic data with `DSTACK_PROVIDER=fake`
- Clean up test artifacts and runs after tests
- Test error scenarios and edge cases

## Browser Compatibility

Backend API is designed to work with modern browsers:
- Supports CORS headers for cross-origin requests
- Uses standard HTTP methods and status codes
- Provides JSON responses compatible with fetch API
- No browser-specific features required

## Deployment Considerations

### Production Setup
- Backend should be deployed with proper HTTPS certificates
- Configure appropriate CORS origins for production domains
- Use environment-specific configuration for API URLs
- Implement proper logging and monitoring

### Environment Variables
Frontend should support these environment variables:
- `DSTACK_API_URL` - Backend API base URL
- `DSTACK_PROJECT_ROOT` - Project directory path
- `DSTACK_ENVIRONMENT` - Development/staging/production

## Future Enhancements

Planned backend features that may affect frontend:
- WebSocket support for real-time updates
- File upload/download endpoints
- Advanced artifact management
- User management and permissions
- Multi-project support

Frontend should be designed to accommodate these future enhancements without breaking changes.

## Support and Troubleshooting

### Common Issues
1. **Origin validation errors** - Ensure `allowExternalOrigins: true` in development
2. **Token authentication failures** - Check token file exists and is readable
3. **API not responding** - Verify backend server is running on correct port
4. **Skill execution failures** - Check skill inputs and provider configuration

### Debug Information
Backend provides request IDs in all responses for debugging:
```javascript
const requestId = response.meta.requestId;
// Use requestId for logging and support tickets
```

### Getting Help
- Check API documentation in `docs/api-routes.md`
- Review backend contracts in `docs/backend-contracts.md`
- Use `pnpm backend:smoke` to verify backend health
- Check backend logs for detailed error information
