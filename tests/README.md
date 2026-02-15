# Testing Setup Guide

## Overview

This project uses **Vitest** as the testing framework with comprehensive unit and integration tests for the project management system.

## Testing Stack

- **Vitest** - Fast unit testing framework (Jest alternative)
- **@vitest/ui** - Web UI for viewing test results
- **@testing-library/react** - React component testing utilities
- **happy-dom** - Lightweight DOM implementation for testing
- **Supabase Client** - Real database integration for integration tests

## Test Structure

```
mBook/
├── tests/
│   ├── setup.ts                    # Global test setup
│   └── utils/
│       ├── test-helpers.ts         # Test utilities and fixtures
│       └── supabase-mock.ts        # Supabase client mocks
├── lib/project-management/repositories/__tests__/
│   ├── ProjectRepository.test.ts   # Project repository tests
│   ├── AreaRepository.test.ts      # Area repository tests
│   └── ProjectTeamRepository.test.ts # Team repository tests
├── vitest.config.ts                # Vitest configuration
├── .env.test                       # Test environment variables
└── package.json                    # Test scripts
```

## Running Tests

### Run All Tests

```bash
npm test
```

### Watch Mode (Re-run on file changes)

```bash
npm run test:watch
```

### Coverage Report

```bash
npm run test:coverage
```

### UI Mode (Visual test runner)

```bash
npm run test:ui
```

Then open http://localhost:51204/__vitest__/

### Run Specific Test File

```bash
npx vitest run ProjectRepository.test.ts
```

### Run Tests Matching Pattern

```bash
npx vitest run -t "should create a new project"
```

## Test Environment Setup

### 1. Environment Variables

Tests use `.env.test` which is separate from `.env.local`:

```bash
# .env.test
NEXT_PUBLIC_SUPABASE_URL=your_test_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_test_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_test_service_role_key
NODE_ENV=test
```

**IMPORTANT:** Use a separate test database or Supabase project for testing!

### 2. Test Database Setup

**Option A: Separate Supabase Project (Recommended)**

1. Create a new Supabase project for testing
2. Run the schema migration: `npm run db:migrate`
3. Update `.env.test` with the test project credentials

**Option B: Local Supabase (Advanced)**

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Start local Supabase
supabase start

# Use local credentials in .env.test
```

**Option C: Shared Database with Cleanup (Not Recommended)**

- Uses the same database as development
- Tests clean up after themselves
- Risk of data conflicts

### 3. Database Migration

Before running tests, ensure the database schema is set up:

```bash
npm run db:migrate
```

## Writing Tests

### Unit Test Template

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectRepository } from '@/lib/project-management/repositories/ProjectRepository';
import {
  createTestSupabaseClient,
  createMockProjectDTO,
  TEST_USER_ID,
  cleanupTestProject,
} from '@/tests/utils/test-helpers';

describe('MyFeature', () => {
  let db: SupabaseClient;
  let repository: ProjectRepository;

  beforeEach(() => {
    db = createTestSupabaseClient();
    repository = new ProjectRepository(db);
  });

  afterEach(async () => {
    // Cleanup test data
  });

  it('should do something', async () => {
    // Arrange
    const dto = createMockProjectDTO();

    // Act
    const result = await repository.create(dto, TEST_USER_ID);

    // Assert
    expect(result).toBeDefined();
  });
});
```

### Using Test Helpers

```typescript
import {
  createTestSupabaseClient,      // Real Supabase client for integration tests
  createMockProjectDTO,           // Generate test project data
  createMockAreaDTO,              // Generate test area data
  TEST_USER_ID,                   // Consistent test user ID
  cleanupTestData,                // Clean all test data
  cleanupTestProject,             // Clean specific project
  generateTestCode,               // Generate unique test codes
  expectProjectToMatch,           // Custom assertions
  wait,                           // Async helper
} from '@/tests/utils/test-helpers';
```

### Mocking Supabase Client

For isolated unit tests without database calls:

```typescript
import { createMockSupabaseClient } from '@/tests/utils/supabase-mock';

it('should handle errors gracefully', async () => {
  const mock = createMockSupabaseClient();
  mock.setMockResponse(null, { message: 'Connection failed' });

  const repo = new ProjectRepository(mock.client as any);
  await expect(repo.findById('123')).rejects.toThrow();
});
```

## Test Types

### Unit Tests

- Test individual functions/methods in isolation
- Mock external dependencies (database, APIs)
- Fast execution (< 100ms per test)
- Location: `__tests__/` folders next to code

### Integration Tests

- Test interactions between components
- Use real database connections
- Test complete workflows
- Location: `__tests__/` folders

### Coverage Goals

- **Lines:** 80%
- **Functions:** 80%
- **Branches:** 75%
- **Statements:** 80%

Coverage thresholds are enforced in `vitest.config.ts`.

## Best Practices

### 1. Test Isolation

Each test should:

- Be independent of other tests
- Clean up its own data
- Not rely on execution order

```typescript
afterEach(async () => {
  for (const id of createdProjectIds) {
    await cleanupTestProject(db, id);
  }
});
```

### 2. Descriptive Test Names

```typescript
// ✅ Good
it('should return null for non-existent project ID', async () => {});

// ❌ Bad
it('works', async () => {});
```

### 3. AAA Pattern (Arrange, Act, Assert)

```typescript
it('should create a project', async () => {
  // Arrange
  const dto = createMockProjectDTO();

  // Act
  const project = await repository.create(dto, TEST_USER_ID);

  // Assert
  expect(project.name).toBe(dto.name);
});
```

### 4. Test Edge Cases

- Empty inputs
- Null/undefined values
- Boundary conditions
- Error scenarios
- Concurrent operations

### 5. Use Factories for Test Data

```typescript
// ✅ Good - Use factory
const dto = createMockProjectDTO({ name: 'Custom Name' });

// ❌ Bad - Manual creation
const dto = {
  name: 'Custom Name',
  code: 'TEST',
  // ... 10 more fields
};
```

## Debugging Tests

### Debug Specific Test

```bash
# Add --inspect flag
npx vitest run --inspect-brk ProjectRepository.test.ts
```

### Console Logging

```typescript
it('should debug', async () => {
  const result = await repository.findById('123');
  console.log('Result:', result);
  expect(result).toBeDefined();
});
```

### Vitest UI

Best way to debug:

```bash
npm run test:ui
```

Navigate to failing test and inspect:

- Test code
- Console output
- Error stack trace
- Test duration

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## Common Issues

### Issue: Tests Timing Out

**Solution:** Increase timeout in test file

```typescript
it('slow operation', async () => {
  // test code
}, { timeout: 30000 }); // 30 seconds
```

### Issue: Database Connection Failed

**Solution:** Check `.env.test` credentials

```bash
# Verify Supabase connection
npx tsx -e "
  import { createClient } from '@supabase/supabase-js';
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error } = await db.from('projects').select('count').limit(1);
  console.log(error ? 'Failed' : 'Connected');
"
```

### Issue: Foreign Key Violations

**Solution:** Clean up in correct order

```typescript
// 1. Delete child records first (team members, areas)
await db.from('project_team_members').delete().eq('project_id', projectId);
await db.from('areas').delete().eq('project_id', projectId);

// 2. Delete parent record last (project)
await db.from('projects').delete().eq('id', projectId);
```

### Issue: Flaky Tests

**Solution:** Use proper async/await patterns

```typescript
// ✅ Good
await repository.create(dto, TEST_USER_ID);
const result = await repository.findById(id);

// ❌ Bad
repository.create(dto, TEST_USER_ID); // Not awaited!
const result = await repository.findById(id);
```

## Performance

### Current Test Performance

- **Unit tests:** ~10-50ms per test
- **Integration tests:** ~100-500ms per test
- **Full suite:** ~10-30 seconds

### Optimization Tips

1. Use `test.concurrent` for independent tests
2. Mock database calls in unit tests
3. Reuse database connections
4. Use transactions with rollback
5. Run tests in parallel (default in Vitest)

## Next Steps

1. **Add API Route Tests** - Test Next.js API routes
2. **Add Service Layer Tests** - Once Phase 3 is complete
3. **Add E2E Tests** - Use Playwright for full user flows
4. **Add Performance Tests** - Load testing with k6
5. **Add Mutation Tests** - Use Stryker for test quality

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Supabase Testing Guide](https://supabase.com/docs/guides/getting-started/local-development)

## Support

If you encounter issues with the test setup:

1. Check `.env.test` configuration
2. Verify database schema is up to date
3. Review test output in UI mode
4. Check Supabase dashboard for connection issues
5. Run tests with `--reporter=verbose` for detailed output
