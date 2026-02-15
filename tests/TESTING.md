# Testing Documentation

This directory contains test utilities, setup files, and documentation for the mBook testing framework.

## Quick Start

```bash
# Install dependencies (if not already installed)
npm install

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## Directory Structure

```
tests/
├── README.md              # Comprehensive testing guide
├── setup.ts               # Global test setup (runs before all tests)
├── smoke.test.ts          # Smoke tests to verify setup
└── utils/
    ├── test-helpers.ts    # Test utilities and fixtures
    └── supabase-mock.ts   # Supabase client mocks
```

## Files

### setup.ts

Global test configuration that runs before all tests:

- Loads `.env.test` environment variables
- Sets up global test hooks
- Configures extended timeouts

### test-helpers.ts

Utility functions for creating test data:

- `createTestSupabaseClient()` - Real Supabase client for integration tests
- `createMockProjectDTO()` - Generate mock project data
- `createMockAreaDTO()` - Generate mock area data
- `generateTestCode()` - Generate unique test codes
- `cleanupTestData()` - Clean up all test data
- `cleanupTestProject()` - Clean up specific project
- `expectProjectToMatch()` - Custom assertions
- `expectAreaToMatch()` - Custom assertions

### supabase-mock.ts

Mock Supabase client for isolated unit tests:

- `createMockSupabaseClient()` - Mock client without database calls
- `createMockError()` - Mock error responses
- `createMockSuccess()` - Mock success responses

### smoke.test.ts

Basic tests to verify the testing environment is working:

- Environment variable loading
- Supabase connection
- Test utilities

## Usage Examples

### Integration Test (Real Database)

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectRepository } from '@/lib/project-management/repositories/ProjectRepository';
import {
  createTestSupabaseClient,
  createMockProjectDTO,
  TEST_USER_ID,
  cleanupTestProject,
} from '@/tests/utils/test-helpers';

describe('ProjectRepository', () => {
  let db: SupabaseClient;
  let repository: ProjectRepository;
  let projectId: string;

  beforeEach(async () => {
    db = createTestSupabaseClient();
    repository = new ProjectRepository(db);
  });

  afterEach(async () => {
    if (projectId) {
      await cleanupTestProject(db, projectId);
    }
  });

  it('should create project', async () => {
    const dto = createMockProjectDTO();
    const project = await repository.create(dto, TEST_USER_ID);
    projectId = project.id;

    expect(project.name).toBe(dto.name);
  });
});
```

### Unit Test (Mocked Database)

```typescript
import { describe, it, expect } from 'vitest';
import { ProjectRepository } from '@/lib/project-management/repositories/ProjectRepository';
import { createMockSupabaseClient, createMockError } from '@/tests/utils/supabase-mock';

describe('ProjectRepository Error Handling', () => {
  it('should handle database errors', async () => {
    const mock = createMockSupabaseClient();
    mock.setMockResponse(null, createMockError('Connection failed'));

    const repo = new ProjectRepository(mock.client as any);
    await expect(repo.findById('123')).rejects.toThrow('Connection failed');
  });
});
```

## Configuration

Test configuration is in `vitest.config.ts` at the project root:

- Test environment: happy-dom (lightweight DOM)
- Setup files: `tests/setup.ts`
- Coverage thresholds: 80% lines, 80% functions, 75% branches
- Test patterns: `**/__tests__/**/*.test.ts`
- Timeout: 10 seconds per test

## Environment Variables

Tests use `.env.test` instead of `.env.local`:

```bash
# .env.test
NEXT_PUBLIC_SUPABASE_URL=your_test_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_test_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_test_service_role_key
NODE_ENV=test
```

**Important:** Always use a separate test database!

## Best Practices

1. **Cleanup After Tests** - Always clean up test data in `afterEach`
2. **Use Factories** - Use `createMockProjectDTO()` instead of manual objects
3. **Unique Codes** - Use `generateTestCode()` to avoid conflicts
4. **Test Isolation** - Each test should be independent
5. **Descriptive Names** - Use clear test descriptions
6. **AAA Pattern** - Arrange, Act, Assert

## Troubleshooting

### Tests Timing Out

Increase timeout in test file:

```typescript
it('slow test', async () => {
  // test code
}, { timeout: 30000 }); // 30 seconds
```

### Database Connection Issues

Verify `.env.test` credentials:

```bash
cat .env.test
```

### Cleanup Failures

Ensure cleanup order respects foreign keys:

1. Delete child records (team members, areas)
2. Delete parent records (projects)

## Next Steps

1. Run smoke tests: `npm test smoke.test.ts`
2. Read the full guide: `tests/README.md`
3. Run repository tests: `npm test`
4. Generate coverage: `npm run test:coverage`

## Resources

- Full Testing Guide: [tests/README.md](./README.md)
- Vitest Docs: https://vitest.dev/
- Testing Library: https://testing-library.com/
