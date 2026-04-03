import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Result of requiring an authenticated browser session (cookie-based SSR client).
 * Why: centralizes 401 handling so every protected route uses the same contract.
 */
export type RequireSessionResult =
  | { ok: true; supabase: SupabaseClient; user: User; userId: string }
  | { ok: false; response: NextResponse };

/**
 * Verifies identity via `getUser()` on the server Supabase client (not stale session alone).
 * Why: matches AGENTS.md — authenticate at the API boundary before touching the database.
 */
export async function requireSessionUser(): Promise<RequireSessionResult> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      ),
    };
  }

  return { ok: true, supabase, user, userId: user.id };
}
