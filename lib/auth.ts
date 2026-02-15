/**
 * Auth helpers for API routes
 * Used for admin-only operations requiring Bearer token + admin role
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

/**
 * Get authenticated user with admin role from Bearer token.
 * Returns the user if valid and admin, or a NextResponse for 401/403.
 */
export async function getAuthenticatedAdmin(
  request: NextRequest
): Promise<AuthenticatedUser | NextResponse> {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { success: false, error: 'Authentication service not configured' },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: 'Authorization token required' },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7);
  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Invalid or expired token' },
      { status: 401 }
    );
  }

  const { data: userData, error: dbError } = await supabaseAdmin
    .from('users')
    .select('id, email, name, role')
    .eq('id', user.id)
    .maybeSingle();

  if (dbError || !userData) {
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
  return UUID_REGEX.test(id);
}
