---
description: 
alwaysApply: true
---

---
description: 
alwaysApply: true
---

# Cursor Agent Guidelines — Staff-Level Engineering Standards

> This file governs how every agent in this repo writes, edits, and reasons about code. Treat every rule here as a first-class constraint, not a suggestion. When in doubt, ask rather than assume.

---

## 0. Core Philosophy

- **Correctness first.** Clever code that is wrong is worse than boring code that is right.
- **Explicit over implicit.** If a decision is not obvious from reading the code, leave a comment or name things better.
- **Fail loudly, early, at the boundary.** Validate inputs at the edge (API routes, form submission). Never propagate `unknown` or `any` inward.
- **Security is not a feature.** Auth, RLS, and input validation are baseline requirements, not enhancements.
- **Smallest diff that solves the problem.** Do not refactor unrelated code in the same PR/edit unless it's a blocker.

---

## 1. TypeScript

### 1.1 Strictness
- `strict: true` is non-negotiable. Never use `// @ts-ignore` or `// @ts-nocheck`. If you must suppress, use `// @ts-expect-error` with a comment explaining why and a ticket reference.
- Never use `any`. Prefer `unknown` with a type-guard, or a well-typed generic.
- Every function must have explicit return types when the return is non-trivial or the function is exported.

```ts
// ❌ Bad
export async function getUser(id) {
  const { data } = await supabase.from("users").select("*").eq("id", id).single();
  return data;
}

// ✅ Good
export async function getUser(id: string): Promise<User | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, role")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}
```

### 1.2 Type Definitions
- Co-locate types with the feature they belong to, not in a global `types.ts` dumping ground.
- Use `type` for unions/aliases, `interface` for object shapes that may be extended.
- Derive DB types from Supabase's generated types (`database.types.ts`) — never hand-write DB row types.

```ts
// lib/supabase/database.types.ts — generated, never manually edited
// Usage:
import type { Database } from "@/lib/supabase/database.types";
type Project = Database["public"]["Tables"]["projects"]["Row"];
```

### 1.3 Path Aliases
- Always use `@/*` imports. Never use relative `../../` imports that cross feature boundaries.

---

## 2. Next.js App Router

### 2.1 Server vs. Client Components
- Default to **Server Components**. Add `"use client"` only when you need browser APIs, event handlers, or React hooks.
- Never import server-only modules (Supabase service role client, `fs`, secrets) inside a Client Component — they will leak to the client bundle.
- Use the `server-only` package for modules that must never run client-side.

```ts
// lib/supabase/server.ts
import "server-only";
```

### 2.2 Data Fetching
- Fetch data in Server Components or Route Handlers. Do not `useEffect` + `fetch` for initial page data.
- Use `async/await` with `Promise.all` for parallel fetches. Never waterfall independent requests.
- Always handle the `error` returned by Supabase — never assume `data` is truthy.

```ts
// ✅ Parallel fetches in a Server Component
const [{ data: project }, { data: members }] = await Promise.all([
  supabase.from("projects").select("*").eq("id", id).single(),
  supabase.from("project_members").select("*").eq("project_id", id),
]);
```

### 2.3 Route Handlers (`app/api/**`)
- Every Route Handler must:
  1. Authenticate the session using the SSR Supabase client.
  2. Validate and parse the request body with a schema (Zod preferred).
  3. Return typed `NextResponse.json()` with explicit HTTP status codes.
  4. Wrap logic in `try/catch` and return a structured error response.

```ts
// app/api/projects/route.ts
import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ name: z.string().min(1).max(100) });

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({ name: parsed.data.name, owner_id: user.id })
    .select()
    .single();

  if (error) {
    console.error("[POST /api/projects]", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
```

### 2.4 Middleware (`middleware.ts`)
- Middleware runs on every matched request. Keep it thin — only auth session refresh and redirects.
- Never do DB queries in middleware (latency). Use session claims/JWT for coarse-grained access checks.
- Always list explicit matchers; do not match `_next/static`, `_next/image`, `favicon.ico`.

### 2.5 `loading.tsx` and `error.tsx`
- Every significant route segment must have a `loading.tsx` (skeleton) and `error.tsx`.
- `error.tsx` must be a Client Component (`"use client"`). Log the error and render a retry button.

### 2.6 Metadata & SEO
- Define `generateMetadata()` for all public-facing pages. Never hard-code titles.

---

## 3. Supabase

### 3.1 Client Instantiation
- **Server Components / Route Handlers**: use `createServerClient()` from `@/lib/supabase/server.ts` (uses cookies via `@supabase/ssr`).
- **Client Components**: use `createBrowserClient()` from `@/lib/supabase/client.ts`. One instance per component tree via a provider, not re-created on every render.
- **Admin operations** (bypassing RLS): use the service role client **only** in Route Handlers or server scripts — never in Client Components and never exposed via `NEXT_PUBLIC_*`.

```ts
// ❌ Never do this
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
// in a "use client" file — service role key is now in the browser bundle.
```

### 3.2 Row-Level Security (RLS)
- **All tables must have RLS enabled.** Verify with `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`
- Every policy must be as restrictive as possible. Start from `DENY ALL`, then add permissive policies.
- When writing a new table migration, include the RLS policies in the same migration file.
- Test RLS policies explicitly in `database/` seed/test scripts — do not trust them blindly.

### 3.3 Querying
- **Never `select("*")`** in production query paths. Always name columns explicitly to avoid over-fetching and accidental exposure of future columns.
- Use `.single()` only when you expect exactly one row. Use `.maybeSingle()` when zero rows is a valid case.
- Handle both `data` and `error` in every query. Pattern:

```ts
const { data, error } = await supabase.from("table").select("id, name").eq("id", id).single();
if (error) throw new Error(`DB query failed: ${error.message}`);
```

### 3.4 Realtime
- Unsubscribe from realtime channels in `useEffect` cleanup. Leaked subscriptions cause memory issues in long-running sessions.

```ts
useEffect(() => {
  const channel = supabase.channel("room").on(...).subscribe();
  return () => { supabase.removeChannel(channel); };
}, []);
```

### 3.5 Auth
- Always use `supabase.auth.getUser()` server-side to verify identity — never trust `getSession()` alone (session can be stale).
- Store user metadata (roles, org membership) in a `profiles` table with RLS, not inside the JWT `user_metadata` (which is user-writable).

---

## 4. Database & Migrations

### 4.1 Migrations
- All schema changes go through SQL migration files in `database/migrations/`. Never mutate the schema via the Supabase dashboard without a corresponding migration file.
- Migrations are **append-only**. Never edit an already-applied migration. Create a new one.
- Naming: `YYYYMMDDHHMMSS_short_description.sql`.

### 4.2 Schema Design
- Always add `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` and `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` to every table.
- Use `UUID` primary keys (`gen_random_uuid()`), not serial integers.
- Add `ON DELETE` behaviour explicitly on every foreign key — never rely on the default `NO ACTION` silently.
- Add indices for every foreign key column and every column used in a `WHERE` clause in hot paths.

### 4.3 Generated Types
- Regenerate `database.types.ts` after every migration: `npx supabase gen types typescript --local > lib/supabase/database.types.ts`.
- Commit the regenerated types in the same PR as the migration.

---

## 5. React Patterns

### 5.1 Component Structure
- One component per file. File name = component name (PascalCase).
- Keep components small (<200 lines). Extract sub-components aggressively.
- Folder structure per feature, not per type:

```
app/
  projects/
    [id]/
      page.tsx
      loading.tsx
      error.tsx
      _components/
        ProjectHeader.tsx
        MemberList.tsx
```

### 5.2 State Management
- Server state: use Supabase queries in Server Components or SWR/React Query for client-side caching — do not manually `useState` + `useEffect` for remote data.
- UI state: `useState` / `useReducer` co-located with the component that owns it.
- Global UI state (modals, toasts): use a lightweight context or Zustand. Do not abuse `Context` for high-frequency updates (it re-renders all consumers).

### 5.3 Forms
- Use `react-hook-form` + Zod for all forms. Never manage form state with raw `useState` per field.
- Define the Zod schema once and derive the TypeScript type from it (`z.infer<typeof schema>`). Share the schema between client validation and the Route Handler.

### 5.4 Error Boundaries
- Wrap async-heavy subtrees in `<ErrorBoundary>`. Pair with `error.tsx` for route-level errors.

### 5.5 Hooks Rules
- Custom hooks are named `use*` and live in `lib/hooks/` or co-located in the feature folder.
- Never call a hook conditionally. Follow the Rules of Hooks with zero exceptions.

---

## 6. Offline / PWA (Dexie + Service Worker)

### 6.1 Dexie
- Define the DB schema version and upgrade paths in `lib/capture/offline-store.ts`. Never mutate a version — increment it and write an `upgrade()` handler.
- Always wrap Dexie mutations in `db.transaction()` when touching multiple tables.
- When syncing offline records to Supabase, use an idempotent operation (upsert with a stable local UUID as the PK) to survive retries.

```ts
// ✅ Idempotent sync
await supabase.from("captures").upsert(
  offlineRecords.map(r => ({ ...r, synced_at: new Date().toISOString() })),
  { onConflict: "id" }
);
```

### 6.2 Service Worker (`public/sw.js`)
- Cache only static assets and API responses that are safe to serve stale (non-auth, non-financial).
- Never cache authenticated API responses in the service worker — this leaks data between users on shared devices.
- Always version the cache name. On activate, delete old cache versions.

---

## 7. Security

### 7.1 Environment Variables
- `NEXT_PUBLIC_*` variables are **inlined into the client bundle**. Only non-secret, public values go here.
- Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, etc.) are server-only. Validate they are defined at startup:

```ts
// lib/env.ts (server-only)
import "server-only";
export const env = {
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
};
if (!env.supabaseServiceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
```

### 7.2 Input Validation
- Validate every external input (request bodies, query params, URL params, file uploads) before processing. Use Zod.
- Sanitize file uploads: check MIME type server-side (not just file extension), enforce size limits, store in Supabase Storage (not the local filesystem).

### 7.3 CSRF
- Route Handlers that mutate state must require authentication. Supabase's cookie-based session + `SameSite=Lax` mitigates most CSRF. For sensitive mutations, add an explicit check.

### 7.4 Rate Limiting
- Add rate limiting to all public-facing mutation endpoints (auth flows, form submissions). Use Supabase Edge Functions or an upstash/redis-based limiter.

### 7.5 Dependency Safety
- Run `npm audit` before merging. Do not add packages with known high-severity vulnerabilities.
- Pin exact versions for security-sensitive packages (e.g. auth, crypto). Use `~` or exact, not `^` for those.

---

## 8. Performance

### 8.1 Bundle Size
- Check bundle size with `next build && next analyze` (add `@next/bundle-analyzer`). No single page chunk should exceed 200KB gzipped without justification.
- Lazy-load heavy components (Excel parser, rich-text editors, charts) with `next/dynamic`:

```ts
const ExcelImporter = dynamic(() => import("@/components/ExcelImporter"), {
  ssr: false,
  loading: () => <Skeleton />,
});
```

### 8.2 Images
- Use `next/image` for all images. Never use a raw `<img>` tag for content images.
- Always provide `width`, `height`, and `alt`. Use `priority` only for above-the-fold LCP images.

### 8.3 Database Query Performance
- Use `EXPLAIN ANALYZE` to profile slow queries during development.
- Paginate all list queries. Never fetch unbounded rows (no `limit`).
- For full-text search, use Postgres `tsvector` columns + GIN indices, not `LIKE '%query%'`.

---

## 9. Tailwind CSS 4

### 9.1 Usage
- Import via `@import "tailwindcss"` in `app/globals.css`. Do not use `@tailwind base/components/utilities` (deprecated in v4).
- Use Tailwind utility classes as the primary styling mechanism. Do not write custom CSS unless there is no utility equivalent.
- For design tokens (brand colors, spacing scale), define them as CSS custom properties in `globals.css` under `:root`, then reference them in Tailwind config or with `var()`.

### 9.2 Class Hygiene
- Use `cn()` (a `clsx` + `tailwind-merge` utility) for all conditional class composition — never string interpolation.

```ts
import { cn } from "@/lib/utils";
<div className={cn("base-class", isActive && "active-class", className)} />
```

- Do not construct Tailwind class names dynamically from variables (e.g. `` `bg-${color}-500` ``). Tailwind's JIT scanner is static — the class will not be included in the build.

---

## 10. Testing (Vitest)

### 10.1 What to Test
- **Unit tests**: pure functions, Zod schemas, utility helpers, Dexie store logic.
- **Integration tests**: Route Handlers with a test Supabase instance or mocked client.
- **Do not** write UI snapshot tests — they are brittle and low-value. Use interaction tests (Testing Library) instead.

### 10.2 Test File Conventions
- Co-locate tests: `lib/utils.ts` → `lib/utils.test.ts`.
- Use descriptive names: `describe("getUser") > it("returns null when user does not exist")`.
- Never test implementation details. Test behaviour and outputs.

### 10.3 Mocking
- Mock Supabase clients with `vi.mock("@/lib/supabase/server")`. Return typed mock data that matches `database.types.ts`.
- Reset all mocks between tests with `beforeEach(() => { vi.clearAllMocks(); })`.

### 10.4 Coverage
- Maintain >80% branch coverage on `lib/` and `app/api/`. Enforce via CI with `--coverage --coverage-threshold`.

---

## 11. Error Handling & Logging

### 11.1 Pattern
- Never `throw` raw strings. Throw `Error` instances with descriptive messages.
- Catch errors at the boundary (Route Handler, Server Component), log with context, and return a user-safe message.

```ts
try {
  // ...
} catch (err) {
  console.error("[createProject]", { userId: user.id, err });
  return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
}
```

### 11.2 Structured Logging
- Include a `[scope]` tag in every `console.error` and `console.warn`. This makes log filtering trivial.
- In production, integrate a log sink (e.g. Axiom, Datadog, Sentry). Never rely on `console.log` for observability in production.

### 11.3 Never Swallow Errors
- Empty `catch` blocks are forbidden. At minimum, log the error.

---

## 12. Code Style & Conventions

### 12.1 Naming
| Thing | Convention | Example |
|---|---|---|
| Files (components) | PascalCase | `ProjectCard.tsx` |
| Files (everything else) | kebab-case | `offline-store.ts` |
| Variables / functions | camelCase | `getUserById` |
| Constants | SCREAMING_SNAKE | `MAX_UPLOAD_SIZE_MB` |
| DB tables | snake_case | `project_members` |
| Env vars | SCREAMING_SNAKE | `NEXT_PUBLIC_SUPABASE_URL` |

### 12.2 Imports Order
1. Node built-ins
2. External packages
3. Internal `@/*` aliases
4. Relative imports
5. Type-only imports last

Use ESLint `import/order` to enforce this automatically.

### 12.3 Comments
- Comments explain **why**, not **what**. If you need to explain what, the code needs to be simplified.
- Use `// TODO(username): description` for deferred work. Never commit `// FIXME` without a linked issue.

### 12.4 No Magic Numbers
```ts
// ❌ Bad
if (file.size > 5242880) { ... }

// ✅ Good
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
if (file.size > MAX_FILE_SIZE_BYTES) { ... }
```

---

## 13. Git & PR Hygiene

- Commits follow Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`.
- Each PR must:
  - Have a single, clear purpose.
  - Include tests for new logic.
  - Pass `tsc --noEmit`, `eslint`, and `vitest run` in CI.
  - Not include unrelated formatting diffs.
- Never commit: `.env`, `*.local`, generated files (`database.types.ts` is the exception — it is committed intentionally).

---

## 14. What NOT to Do (Common Anti-Patterns)

| Anti-pattern | Why it's wrong | Correct approach |
|---|---|---|
| `select("*")` in Supabase queries | Over-fetches; exposes new columns automatically | Name columns explicitly |
| Service role client in Client Components | Leaks secret to browser bundle | Only use in Route Handlers / Server |
| `useEffect` for initial data fetch | Creates waterfall, no SSR benefit | Fetch in Server Component |
| Dynamic Tailwind class names | JIT scanner misses them; class not generated | Use full class names + `cn()` |
| `any` in TypeScript | Defeats the type system | Use `unknown` + type guard |
| Missing RLS policies | Any authenticated user can read/write all rows | Implement RLS for every table |
| Secrets in `NEXT_PUBLIC_*` | Inlined into client bundle | Use server-only env vars |
| Unchecked Supabase `error` | Silent data corruption / wrong app state | Always destructure and check `error` |
| Unbounded DB queries (no `limit`) | Will fetch millions of rows as data grows | Always paginate |
| Empty `catch` blocks | Swallowed errors are invisible bugs | Always log at minimum |
