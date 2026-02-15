# Auth Login & Session Fixes

## Issues Resolved

### 1. "Database error querying schema" (500)
**Cause:** NULL values in `auth.users` token columns (`confirmation_token`, `recovery_token`, etc.). Supabase Auth's GoTrue expects strings, not NULL.

**Fix:** Run `scripts/fix-auth-token-nulls.sql` in Supabase Dashboard → SQL Editor to:
- Update NULL token columns to empty strings
- Recreate the sync trigger with explicit `search_path`

### 2. "Database error granting user" (500)
**Cause:** The `sync_auth_user_to_users()` trigger function lacked explicit `search_path`. When Auth updates `auth.users` on login (e.g. `last_sign_in_at`), the trigger runs but can't resolve `public.users` or `public.user_role` in Auth's transaction context.

**Fix:** Added `SET search_path = public` to the trigger function in `scripts/fix-auth-token-nulls.sql`.

### 3. Login successful but no redirect / middleware redirects back to login
**Cause:** The login page and AuthContext used `@supabase/supabase-js`'s `createClient()`, which doesn't properly manage cookies for Next.js middleware. The middleware uses `@supabase/ssr`'s `createServerClient()`, so cookies weren't being set correctly.

**Fix:** 
- Created `lib/supabase/client.ts` with `getSupabaseBrowserClient()` using `@supabase/ssr`'s `createBrowserClient()`
- Created `lib/supabase/server.ts` with `getSupabaseServerClient()` using `@supabase/ssr`'s `createServerClient()`
- Updated `app/login/page.tsx` to use `getSupabaseBrowserClient()`
- Updated `app/contexts/AuthContext.tsx` to use `getSupabaseBrowserClient()`
- Updated `app/admin/users/page.tsx` to use `getSupabaseBrowserClient()`

## Files Changed

### New files:
- `lib/supabase/client.ts` - Browser client with cookie handling for Next.js
- `lib/supabase/server.ts` - Server client with cookie handling for Next.js
- `scripts/fix-auth-token-nulls.sql` - SQL script to fix both auth errors
- `scripts/check-admin-user.ts` - Verification script for admin user

### Modified files:
- `app/login/page.tsx` - Use browser client from `@supabase/ssr`
- `app/contexts/AuthContext.tsx` - Use browser client from `@supabase/ssr`
- `app/admin/users/page.tsx` - Use browser client from `@supabase/ssr`
- `project-management/database/003_supabase_full.sql` - Add `SET search_path` to trigger
- `project-management/database/migrations/001_add_user_roles.sql` - Add `SET search_path` to trigger
- `app/api/auth/login/route.ts` - Enhanced logging for debugging

## How to Test

1. **Run the SQL fix** (if not already done):
   - Open Supabase Dashboard → SQL Editor
   - Paste and execute contents of `scripts/fix-auth-token-nulls.sql`

2. **Test login**:
   - Go to `http://localhost:3000/login`
   - Enter: `saiesh.nat@gmail.com` / `Dolphin@123`
   - Should redirect to `/admin` after successful login

3. **Test middleware protection**:
   - Log out
   - Try accessing `http://localhost:3000/admin`
   - Should redirect to `/login?redirect=/admin`

4. **Test session persistence**:
   - Log in
   - Refresh the page
   - Should remain logged in (middleware reads cookies properly)

## Architecture Notes

### Supabase Client Types

**`@supabase/supabase-js` (deprecated for Next.js App Router):**
- `createClient()` - Basic client, no cookie management
- Used in API routes via `lib/supabase.ts` (for admin operations)

**`@supabase/ssr` (correct for Next.js App Router):**
- `createBrowserClient()` - Client-side, manages cookies automatically
- `createServerClient()` - Server-side (middleware, Server Components), manages cookies via Next.js APIs

### Session Flow

1. **Login** → `createBrowserClient()` calls `signInWithPassword()` → sets cookies
2. **Middleware** → `createServerClient()` reads cookies → validates session → allows/blocks routes
3. **Client Components** → `createBrowserClient()` reads cookies → provides user context

## References

- [Supabase issue #1940](https://github.com/supabase/auth/issues/1940) - "Database error querying schema"
- [Supabase issue #563](https://github.com/supabase/supabase/issues/563) - "Database error granting user" with triggers
- [Supabase SSR docs](https://supabase.com/docs/guides/auth/server-side/nextjs) - Next.js App Router auth
