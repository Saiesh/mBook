# Testing Quick Reference Card

## 🚀 Quick Start

```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:ui             # Visual UI
npm run test:coverage       # Coverage report
```

## 📁 Key Files

- **`vitest.config.ts`** - Test configuration
- **`.env.test`** - Test environment variables (⚠️ use separate DB)
- **`tests/setup.ts`** - Global test setup
- **`tests/utils/test-helpers.ts`** - Test utilities
- **`tests/README.md`** - Full documentation

## 🧪 Writing Tests

### Integration Test (Real DB)

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
  let repo: ProjectRepository;
  let projectIds: string[] = [];

  beforeEach(() => {
    db = createTestSupabaseClient();
    repo = new ProjectRepository(db);
  });

  afterEach(async () => {
    for (const id of projectIds) {
      await cleanupTestProject(db, id);
    }
  });

  it('should create project', async () => {
    const dto = createMockProjectDTO();
    const project = await repo.create(dto, TEST_USER_ID);
    projectIds.push(project.id);

    expect(project.name).toBe(dto.name);
  });
});
```

### Unit Test (Mocked)

```typescript
import { createMockSupabaseClient, createMockError } from '@/tests/utils/supabase-mock';

it('should handle errors', async () => {
  const mock = createMockSupabaseClient();
  mock.setMockResponse(null, createMockError('Failed'));

  const repo = new ProjectRepository(mock.client as any);
  await expect(repo.findById('123')).rejects.toThrow('Failed');
});
```

## 🛠️ Test Helpers

```typescript
// Create test data
createMockProjectDTO({ name: 'Custom' })
createMockAreaDTO(projectId, { name: 'Custom' })
generateTestCode('PREFIX')

// Database
createTestSupabaseClient()
cleanupTestData(db)
cleanupTestProject(db, projectId)

// Assertions
expectProjectToMatch(actual, expected)
expectAreaToMatch(actual, expected)

// Utilities
wait(1000)  // Wait 1 second
createBulkTestProjects(10)
```

## 🎯 Test Patterns

### AAA Pattern

```typescript
it('should do something', async () => {
  // Arrange
  const dto = createMockProjectDTO();
  
  // Act
  const result = await repo.create(dto, TEST_USER_ID);
  
  // Assert
  expect(result).toBeDefined();
});
```

### Cleanup Pattern

```typescript
let projectIds: string[] = [];

afterEach(async () => {
  for (const id of projectIds) {
    await cleanupTestProject(db, id);
  }
  projectIds = [];
});
```

## 📊 Coverage

```bash
npm run test:coverage

# Open coverage/index.html
```

**Thresholds:** 80% lines, 80% functions, 75% branches

## 🔍 Debugging

```bash
# UI Mode (best for debugging)
npm run test:ui

# Verbose output
npx vitest run --reporter=verbose

# Debug mode
npx vitest run --inspect-brk

# Run specific test
npx vitest run ProjectRepository.test.ts

# Run tests matching pattern
npx vitest run -t "should create"
```

## ⚠️ Important Notes

1. **Always clean up test data** in `afterEach`
2. **Use unique test codes** with `generateTestCode()`
3. **Use separate test database** (update `.env.test`)
4. **Test isolation** - each test should be independent
5. **Mock external calls** in unit tests
6. **Use factories** for test data (`createMockProjectDTO`)

## 📝 Test Types

| Type | Description | Use When |
|------|-------------|----------|
| **Unit** | Isolated, mocked | Testing single function |
| **Integration** | Real DB | Testing repository layer |
| **E2E** | Full flow | Testing user workflows |

## 🚦 Running Specific Tests

```bash
# By file
npx vitest run ProjectRepository

# By pattern
npx vitest run -t "create"

# Single test file
npm test smoke.test.ts

# Watch specific file
npx vitest watch ProjectRepository
```

## 📚 Documentation

- **Full Guide:** `tests/README.md` (400+ lines)
- **Setup Summary:** `tests/SETUP_COMPLETE.md`
- **Quick Ref:** `tests/TESTING.md`
- **This Card:** `tests/QUICK_REFERENCE.md`

## 🐛 Common Issues

### Tests timeout
```typescript
it('slow test', async () => {
  // test code
}, { timeout: 30000 }); // 30 seconds
```

### Database connection failed
- Check `.env.test` credentials
- Verify network access
- Check Supabase project status

### Foreign key violations
- Clean up in correct order (children first)
- Use `cleanupTestProject()` helper

### Flaky tests
- Add proper `await` statements
- Ensure test isolation
- Check for race conditions

## 🎨 Test Structure

```
lib/project-management/repositories/__tests__/
├── ProjectRepository.test.ts
├── AreaRepository.test.ts
└── ProjectTeamRepository.test.ts
```

Each file follows:
1. Imports
2. Describe block
3. Setup (beforeEach)
4. Cleanup (afterEach)
5. Test groups (describe)
6. Individual tests (it)

## ✅ Checklist

- [ ] Run smoke tests: `npm test smoke.test.ts`
- [ ] Run all tests: `npm test`
- [ ] Check coverage: `npm run test:coverage`
- [ ] Review in UI: `npm run test:ui`
- [ ] Update `.env.test` with separate DB (recommended)
- [ ] Read full guide: `tests/README.md`

## 🎓 Best Practices

1. ✅ **One assertion per test** (when possible)
2. ✅ **Descriptive test names** ("should create project with all fields")
3. ✅ **Test edge cases** (null, empty, boundary)
4. ✅ **Clean up after tests** (no side effects)
5. ✅ **Use factories** (consistent test data)
6. ✅ **Mock external deps** (in unit tests)
7. ✅ **Fast tests** (< 100ms for unit, < 500ms for integration)
8. ✅ **Independent tests** (no execution order dependency)

---

**Need help?** Check `tests/README.md` for comprehensive documentation.

**Setup complete?** See `tests/SETUP_COMPLETE.md` for summary.
