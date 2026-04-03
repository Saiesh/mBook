/**
 * Auth helpers for API routes
 * Used for admin-only operations after SSR session verification
 */

import { NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

/**
 * Verifies cookie session via SSR client, then loads role from `users` with service role.
 * Why: identity comes from `getUser()` (JWT verified server-side); role lookup uses admin to avoid RLS gaps on admin checks.
 */
export async function getAuthenticatedAdmin(): Promise<
  AuthenticatedUser | NextResponse
> {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { success: false, error: 'Authentication service not configured' },
      { status: 500 }
    );
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { data: userData, error: dbError } = await supabaseAdmin
    .from('users')
    .select('id, email, name, role')
    .eq('id', user.id)
    .maybeSingle();

  if (dbError || !userData) {
    console.error('[getAuthenticatedAdmin]', { userId: user.id, dbError });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user data' },
      { status: 500 }
    );
  }

  if (userData.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Admin role required' },
      { status: 403 }
    );
  }

  return {
    id: userData.id,
    email: userData.email ?? '',
    name: userData.name ?? '',
    role: userData.role,
  };
}

/**
 * Validate that a string is a valid UUID
 */
export function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  );
}
