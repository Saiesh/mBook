import { NextResponse } from 'next/server';

import { requireSessionUser } from '@/lib/api/require-session';

/**
 * GET /api/auth/me
 * Get current authenticated user from SSR session.
 */
export async function GET() {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  try {
    const { data: userData, error: dbError } = await session.supabase
      .from('users')
      .select('id, email, name, phone, role, is_active, last_login_at, created_at, updated_at')
      .eq('id', session.userId)
      .maybeSingle();

    if (dbError) {
      console.error('[GET /api/auth/me]', dbError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch user data' },
        { status: 500 }
      );
    }

    if (!userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        phone: userData.phone,
        role: userData.role,
        isActive: userData.is_active,
        lastLoginAt: userData.last_login_at,
        createdAt: userData.created_at,
        updatedAt: userData.updated_at,
      },
    });
  } catch (error) {
    console.error('[GET /api/auth/me]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get current user',
      },
      { status: 500 }
    );
  }
}
