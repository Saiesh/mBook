# Testing Framework Documentation Index

Welcome to the mBook testing framework! This comprehensive testing setup uses Vitest and provides everything you need to test the project management system.

## 📚 Documentation Guide

Choose your starting point based on your needs:

### 🚀 Quick Start (New to the project?)

**Start here:** [`QUICK_REFERENCE.md`](./QUICK_REFERENCE.md)
- One-page cheat sheet
- Common commands
- Code examples
- Quick troubleshooting

### 📖 Comprehensive Learning

**For deep understanding:** [`README.md`](./README.md)
- Complete testing guide (400+ lines)
- Detailed explanations
- Best practices
- Debugging strategies
- Performance tips
- CI/CD setup

### 🎯 Quick Overview

**For quick understanding:** [`TESTING.md`](./TESTING.md)
- Directory structure
- File descriptions
- Usage examples
- Basic troubleshooting

### ✅ Setup Information

**What was installed:** [`SETUP_COMPLETE.md`](./SETUP_COMPLETE.md)
- Complete installation details
- Test coverage breakdown
- Success criteria checklist
- Next steps

**Visual overview:** [`SETUP_SUMMARY.md`](./SETUP_SUMMARY.md)
- Statistics and metrics
- File structure overview
- Quick verification steps

**Architecture diagrams:** [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- Visual architecture diagrams
- Component interactions
- Data flow diagrams
- Execution patterns

---

## 🎯 Quick Navigation by Task

### I want to...

#### Run Tests
```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:ui             # Visual UI
npm run test:coverage       # Coverage report
```
→ See: [`QUICK_REFERENCE.md`](./QUICK_REFERENCE.md#quick-start)

#### Write New Tests
→ See: [`README.md` - Writing Tests](./README.md#writing-tests)
→ See: [`QUICK_REFERENCE.md` - Test Templates](./QUICK_REFERENCE.md#writing-tests)

#### Understand Test Utilities
→ See: [`TESTING.md` - Usage Examples](./TESTING.md#usage-examples)
→ See: [`utils/test-helpers.ts`](./utils/test-helpers.ts) (source code)

#### Mock Supabase Client
→ See: [`README.md` - Mocking Supabase](./README.md#mocking-supabase-client)
→ See: [`utils/supabase-mock.ts`](./utils/supabase-mock.ts) (source code)

#### Debug Failing Tests
→ See: [`README.md` - Debugging Tests](./README.md#debugging-tests)
→ See: [`QUICK_REFERENCE.md` - Debugging](./QUICK_REFERENCE.md#debugging)

#### Check Test Coverage
```bash
npm run test:coverage
open coverage/index.html
```
→ See: [`README.md` - Coverage](./README.md#coverage-goals)

#### Set Up Test Database
→ See: [`README.md` - Test Database Setup](./README.md#test-database-setup)
→ See: [`SETUP_COMPLETE.md` - Test Environment](./SETUP_COMPLETE.md#test-environment-setup)

#### Understand Architecture
→ See: [`ARCHITECTURE.md`](./ARCHITECTURE.md)

---

## 📁 File Organization

```
tests/
├── 📚 Documentation
│   ├── INDEX.md                    ← You are here
│   ├── QUICK_REFERENCE.md          ← Start here (cheat sheet)
│   ├── TESTING.md                  ← Quick overview
│   ├── README.md                   ← Complete guide
│   ├── SETUP_COMPLETE.md           ← What was installed
│   ├── SETUP_SUMMARY.md            ← Statistics
│   └── ARCHITECTURE.md             ← Visual diagrams
│
├── 🔧 Test Utilities
│   └── utils/
│       ├── test-helpers.ts         ← Test factories & cleanup
│       └── supabase-mock.ts        ← Mocking utilities
│
├── ⚙️  Configuration
│   ├── setup.ts                    ← Global test setup
│   └── smoke.test.ts               ← Setup verification tests
│
└── 📊 Reports (generated)
    └── coverage/                   ← Coverage reports (npm run test:coverage)
```

---

## 🎓 Learning Path

### Day 1: Get Started
1. Read: [`QUICK_REFERENCE.md`](./QUICK_REFERENCE.md)
2. Run: `npm test smoke.test.ts`
3. Run: `npm run test:ui`
4. Explore: UI test runner

### Day 2: Write Tests
1. Read: [`README.md` - Writing Tests](./README.md#writing-tests)
2. Study: Existing test files in `lib/project-management/repositories/__tests__/`
3. Write: Your first test
4. Run: `npm run test:watch`

### Day 3: Deep Dive
1. Read: [`README.md`](./README.md) (complete)
2. Study: [`ARCHITECTURE.md`](./ARCHITECTURE.md)
3. Experiment: Different test patterns
4. Generate: `npm run test:coverage`

---

## 🧪 Test Examples

### Integration Test (Real Database)
```typescript
import { createTestSupabaseClient, createMockProjectDTO, TEST_USER_ID } from '@/tests/utils/test-helpers';

it('should create project', async () => {
  const db = createTestSupabaseClient();
  const repo = new ProjectRepository(db);
  const dto = createMockProjectDTO();
  
  const project = await repo.create(dto, TEST_USER_ID);
  
  expect(project.name).toBe(dto.name);
});
```
→ See more: [`TESTING.md` - Integration Test](./TESTING.md#integration-test-real-db)

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
→ See more: [`TESTING.md` - Unit Test](./TESTING.md#unit-test-mocked)

---

## 📊 Current Status

### ✅ What's Complete

- [x] Vitest framework installed and configured
- [x] Test utilities and helpers created
- [x] Mocking framework implemented
- [x] 54 test cases written
- [x] Coverage reporting configured
- [x] Smoke tests passing
- [x] Comprehensive documentation (6 guides)
- [x] Test scripts added to package.json

### ⏳ Next Steps

- [ ] Run repository tests with real database
- [ ] Generate initial coverage report
- [ ] Set up separate test database (recommended)
- [ ] Add service layer tests (Phase 3)
- [ ] Add API route tests (Phase 4)
- [ ] Set up CI/CD pipeline

---

## 🔗 External Resources

- **Vitest Docs:** https://vitest.dev/
- **Testing Library:** https://testing-library.com/
- **Supabase Testing:** https://supabase.com/docs/guides/getting-started/local-development
- **Jest to Vitest Migration:** https://vitest.dev/guide/migration.html

---

## 🆘 Common Issues

| Issue | Solution | Doc Link |
|-------|----------|----------|
| Tests timeout | Increase timeout in test | [`README.md` - Issues](./README.md#tests-timing-out) |
| DB connection failed | Check `.env.test` | [`README.md` - Issues](./README.md#database-connection-failed) |
| Coverage below threshold | Write more tests | [`README.md` - Coverage](./README.md#coverage-goals) |
| Foreign key violations | Cleanup order matters | [`README.md` - Issues](./README.md#foreign-key-violations) |
| Flaky tests | Check async/await | [`README.md` - Issues](./README.md#flaky-tests) |

---

## 🎯 Key Concepts

### Test Types

| Type | Speed | Database | Use Case |
|------|-------|----------|----------|
| **Unit** | Fast (~10ms) | Mocked | Test logic in isolation |
| **Integration** | Medium (~100ms) | Real | Test DB interactions |
| **E2E** | Slow (~1s) | Real | Test user workflows |

### Test Patterns

- **AAA:** Arrange, Act, Assert
- **Setup/Teardown:** beforeEach, afterEach
- **Factories:** createMockProjectDTO()
- **Cleanup:** Always clean up test data

### Best Practices

1. ✅ Test isolation (no side effects)
2. ✅ Descriptive test names
3. ✅ One assertion per test (when possible)
4. ✅ Test edge cases
5. ✅ Clean up after tests
6. ✅ Use factories for test data

---

## 📞 Getting Help

1. **Check the docs first:**
   - Quick answer → [`QUICK_REFERENCE.md`](./QUICK_REFERENCE.md)
   - Detailed answer → [`README.md`](./README.md)

2. **Run smoke tests:**
   ```bash
   npm test smoke.test.ts
   ```

3. **Use the UI:**
   ```bash
   npm run test:ui
   ```

4. **Check test examples:**
   - Look at `lib/project-management/repositories/__tests__/*.test.ts`

---

## 🎉 Summary

You have access to:

- ✅ **54 test cases** covering 3 repositories
- ✅ **6 documentation guides** (1400+ lines)
- ✅ **Comprehensive utilities** for testing
- ✅ **Visual test runner** (npm run test:ui)
- ✅ **Coverage tracking** (80% threshold)
- ✅ **Best practices** implemented throughout

**Choose your path:**
- 🚀 Quick start? → [`QUICK_REFERENCE.md`](./QUICK_REFERENCE.md)
- 📖 Deep learning? → [`README.md`](./README.md)
- 🎨 Visual overview? → [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- ✅ Setup details? → [`SETUP_COMPLETE.md`](./SETUP_COMPLETE.md)

**Ready to test! 🚀**

---

*Last updated: February 15, 2026*  
*Framework: Vitest 4.0.18*  
*Test Cases: 54*  
*Documentation: 6 guides*
