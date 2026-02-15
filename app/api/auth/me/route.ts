import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/auth/me
 * Get current authenticated user from session
 * Requires: Bearer token in Authorization header
 * Returns: { success: true, data: User } or { success: false, error: string }
 */
export async function GET(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: 'Authentication service not configured' },
        { status: 500 }
      );
    }

    // Get Bearer token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authorization token required' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7); // Remove 'Bearer ' prefix

    // Get user from token using Supabase Admin
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Fetch full user data from public.users table
    const { data: userData, error: dbError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, phone, role, is_active, last_login_at, created_at, updated_at')
      .eq('id', user.id)
      .maybeSingle();

    if (dbError) {
      console.error('Database error fetching user:', dbError);
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

    // Return user data in consistent format
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
    console.error('Error in auth/me API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get current user',
      },
      { status: 500 }
    );
  }
}
