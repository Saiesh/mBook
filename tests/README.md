# Tests

This folder holds Vitest configuration entrypoints (`setup.ts`), smoke checks, and shared test utilities. Feature-specific tests live next to the code they cover (for example under `lib/**/__tests__/`).

## Commands

```bash
npm test              # Run the full suite once
npm run test:watch    # Watch mode while developing
npm run test:ui       # Vitest UI
npm run test:coverage # Coverage report
```

Configuration lives in `vitest.config.ts` at the repository root. Environment for integration-style tests is loaded from `.env.test` when present.

## Layout

| Path | Purpose |
|------|---------|
| `setup.ts` | Runs before tests; wires globals and test env. |
| `smoke.test.ts` | Minimal sanity checks that the harness runs. |
| `utils/test-helpers.ts` | Shared fixtures and helpers for repository/API tests. |
| `utils/supabase-mock.ts` | Typed Supabase client mocks for unit tests. |

For manual QA flows (browser, Supabase, admin routes), use `docs/MANUAL_TESTING_GUIDE.md`.
