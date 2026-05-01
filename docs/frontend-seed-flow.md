# Frontend Seed Flow

This document provides deterministic data seeding commands for frontend development and testing.

## Overview

Frontend developers need predictable, repeatable data for development, testing, and demos. The DStack backend supports deterministic data generation through the `fake` provider and specific skills.

## Environment Setup

Set the provider to fake mode for deterministic behavior:

```bash
export DSTACK_PROVIDER=fake
# or
DSTACK_PROVIDER=fake pnpm ds [command]
```

## Core Seed Commands

### 1. Project Planning Seed

Generate a complete project plan with deterministic structure:

```bash
DSTACK_PROVIDER=fake pnpm ds -- /autoplan --json
```

**Expected Output:**
```json
{
  "ok": true,
  "data": {
    "id": "run-123",
    "skillName": "autoplan",
    "status": "complete",
    "verdict": "PASS",
    "output": {
      "title": "Project Plan",
      "sections": [
        {
          "title": "Overview",
          "content": "Project overview and goals"
        },
        {
          "title": "Architecture",
          "content": "System architecture and components"
        },
        {
          "title": "Implementation",
          "content": "Implementation phases and timeline"
        }
      ],
      "artifacts": ["design-plan", "tech-spec", "implementation-plan"]
    },
    "artifacts": [...]
  }
}
```

### 2. Office Hours Simulation

Simulate client requirements gathering:

```bash
DSTACK_PROVIDER=fake pnpm ds -- /office-hours --json
```

**Expected Output:**
```json
{
  "ok": true,
  "data": {
    "id": "run-124",
    "skillName": "office-hours",
    "status": "complete",
    "verdict": "PASS",
    "output": {
      "client": "Acme Corp",
      "requirements": [
        "User authentication system",
        "Real-time collaboration",
        "Mobile responsive design"
      ],
      "constraints": [
        "Budget: $50k",
        "Timeline: 3 months",
        "Team: 4 developers"
      ],
      "artifacts": ["requirements-doc", "user-stories", "acceptance-criteria"]
    },
    "artifacts": [...]
  }
}
```

### 3. Design Variants Generation

Generate multiple design options:

```bash
DSTACK_PROVIDER=fake pnpm ds -- /design-variants --json
```

**Expected Output:**
```json
{
  "ok": true,
  "data": {
    "id": "run-125",
    "skillName": "design-variants",
    "status": "complete",
    "verdict": "PASS",
    "output": {
      "variants": [
        {
          "name": "Modern Minimal",
          "description": "Clean, minimalist design with focus on typography",
          "components": ["Header", "Sidebar", "Content", "Footer"],
          "colors": ["#ffffff", "#000000", "#f0f0f0"],
          "artifacts": ["design-variant-1"]
        },
        {
          "name": "Bold Creative",
          "description": "Vibrant design with creative elements",
          "components": ["Hero", "Features", "Testimonials", "CTA"],
          "colors": ["#ff6b6b", "#4ecdc4", "#45b7d1"],
          "artifacts": ["design-variant-2"]
        }
      ]
    },
    "artifacts": [...]
  }
}
```

## API Equivalent Commands

For frontend applications that prefer API calls over CLI commands:

### 1. Start Backend Server

```bash
pnpm ds --serve --port 4570 --allow-external-origins
```

### 2. Get Authentication Token

```bash
# Read token from file
cat .dstack/api/token
```

### 3. Execute Skills via API

```javascript
// Autoplan via API
const autoplanResponse = await fetch('http://127.0.0.1:4570/v1/skills/autoplan/run', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    inputs: {},
    flags: {
      dryRun: false,
      noStream: true,
      provider: 'fake'
    }
  })
});

const autoplanData = await autoplanResponse.json();
```

```javascript
// Office Hours via API
const officeHoursResponse = await fetch('http://127.0.0.1:4570/v1/skills/office-hours/run', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    inputs: {
      client: "Acme Corp",
      project: "Web Application"
    },
    flags: {
      dryRun: false,
      noStream: true,
      provider: 'fake'
    }
  })
});

const officeHoursData = await officeHoursResponse.json();
```

```javascript
// Design Variants via API
const designResponse = await fetch('http://127.0.0.1:4570/v1/skills/design-variants/run', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    inputs: {
      projectType: "web-application",
      style: "modern"
    },
    flags: {
      dryRun: false,
      noStream: true,
      provider: 'fake'
    }
  })
});

const designData = await designResponse.json();
```

## Complete Seeding Script

Create a complete seeding script for frontend development:

```bash
#!/bin/bash
# seed-frontend-data.sh

echo "🌱 Seeding frontend data..."

export DSTACK_PROVIDER=fake

# 1. Generate project plan
echo "📋 Generating project plan..."
pnpm ds -- /autoplan --json > frontend-data/project-plan.json

# 2. Simulate office hours
echo "💼 Simulating office hours..."
pnpm ds -- /office-hours --json > frontend-data/office-hours.json

# 3. Generate design variants
echo "🎨 Generating design variants..."
pnpm ds -- /design-variants --json > frontend-data/design-variants.json

# 4. Generate implementation plan
echo "🔧 Generating implementation plan..."
pnpm ds -- /implement --json > frontend-data/implementation.json

# 5. Generate test plan
echo "🧪 Generating test plan..."
pnpm ds -- /test-plan --json > frontend-data/test-plan.json

echo "✅ Frontend data seeded successfully!"
echo "📁 Data available in frontend-data/ directory"
```

## Deterministic Data Properties

When using `DSTACK_PROVIDER=fake`, the following properties are deterministic:

### timestamps
- Always use consistent date format
- Predictable time increments
- Stable timezone handling

### IDs
- Consistent ID generation patterns
- Predictable sequence numbers
- Stable checksums

### Content Structure
- Consistent JSON structure
- Predictable field names
- Stable data types

### Random Elements
- Seeded random number generation
- Consistent "random" selections
- Predictable variations within bounds

## Frontend Integration Examples

### React Example

```javascript
// hooks/useSeededData.js
import { useState, useEffect } from 'react';

export function useSeededData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const seedData = async () => {
      try {
        const response = await fetch('/api/seed-data');
        const seededData = await response.json();
        setData(seededData);
      } catch (error) {
        console.error('Failed to seed data:', error);
      } finally {
        setLoading(false);
      }
    };

    seedData();
  }, []);

  return { data, loading };
}
```

### Vue Example

```javascript
// composables/useSeededData.js
import { ref, onMounted } from 'vue';

export function useSeededData() {
  const data = ref(null);
  const loading = ref(true);

  const seedData = async () => {
    try {
      const response = await fetch('/api/seed-data');
      const seededData = await response.json();
      data.value = seededData;
    } catch (error) {
      console.error('Failed to seed data:', error);
    } finally {
      loading.value = false;
    }
  };

  onMounted(seedData);

  return { data, loading };
}
```

## Testing with Seeded Data

### Unit Tests

```javascript
// tests/frontend.test.js
import { render, screen } from '@testing-library/react';
import { SeededDataProvider } from '../providers/SeededDataProvider';
import Dashboard from '../components/Dashboard';

// Use deterministic seeded data for tests
const mockSeededData = {
  projectPlan: {
    title: "Test Project",
    sections: [...]
  },
  designVariants: [...],
  officeHours: [...]
};

test('Dashboard renders with seeded data', () => {
  render(
    <SeededDataProvider data={mockSeededData}>
      <Dashboard />
    </SeededDataProvider>
  );

  expect(screen.getByText('Test Project')).toBeInTheDocument();
});
```

### E2E Tests

```javascript
// tests/e2e/seeding.spec.js
import { test, expect } from '@playwright/test';

test('frontend loads with seeded data', async ({ page }) => {
  // Navigate to app
  await page.goto('/');
  
  // Wait for seeded data to load
  await page.waitForSelector('[data-testid="project-plan"]');
  
  // Verify deterministic content
  await expect(page.locator('text=Test Project')).toBeVisible();
  await expect(page.locator('text=Modern Minimal')).toBeVisible();
});
```

## Performance Considerations

### Data Caching
- Cache seeded data in localStorage for development
- Implement cache invalidation strategy
- Use service workers for offline support

### Lazy Loading
- Load seed data on demand
- Implement progressive loading
- Use skeleton states for better UX

### Data Size
- Keep seed data minimal for performance
- Use compression for large datasets
- Implement pagination when needed

## Troubleshooting

### Common Issues

1. **Non-deterministic output**
   - Ensure `DSTACK_PROVIDER=fake` is set
   - Check for environment variable conflicts
   - Verify no external dependencies

2. **Missing skills**
   - Run `pnpm ds --list-skills` to verify availability
   - Check skill manifests are valid
   - Ensure skills are registered

3. **API authentication errors**
   - Verify token file exists: `.dstack/api/token`
   - Check token permissions
   - Ensure server allows external origins

### Debug Commands

```bash
# Check available skills
pnpm ds --list-skills --json

# Verify provider setting
echo $DSTACK_PROVIDER

# Check server status
curl http://127.0.0.1:4570/v1/health

# Test authentication
curl -H "Authorization: Bearer $(cat .dstack/api/token)" \
     http://127.0.0.1:4570/v1/projects/current
```

## Best Practices

1. **Always use fake provider for development and testing**
2. **Cache seeded data to improve performance**
3. **Validate seeded data structure before using**
4. **Use consistent data seeding across environments**
5. **Document any custom seed data requirements**
6. **Implement proper error handling for seeding failures**
7. **Use deterministic data for screenshots and visual testing**
8. **Regularly update seed data as backend evolves**
