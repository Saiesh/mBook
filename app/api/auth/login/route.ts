import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * POST /api/auth/login
 * Login with email and password
 * Body: { email: string, password: string }
 * Returns: { success: true, data: { user, session } } or { success: false, error: string }
 */
export async function POST(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Authentication service not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.email || typeof body.email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!body.password || typeof body.password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Password is required' },
        { status: 400 }
      );
    }

    // Attempt to sign in with Supabase Auth
    const emailForLogin = body.email.trim();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailForLogin,
      password: body.password,
    });

    if (error) {
      // Log full Supabase error response for debugging
      console.error('[Auth] Supabase signInWithPassword error:', {
        message: error.message,
        status: error.status,
        name: error.name,
        email: emailForLogin,
        fullError: JSON.stringify(error, null, 2),
      });
      return NextResponse.json(
        { success: false, error: 'Invalid email or password', _debug: process.env.NODE_ENV === 'development' ? { supabaseMessage: error.message, status: error.status } : undefined },
        { status: 401 }
      );
    }

    if (!data.user || !data.session) {
      return NextResponse.json(
        { success: false, error: 'Authentication failed' },
        { status: 401 }
      );
    }

    // Return user and session data
    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name || '',
          role: data.user.user_metadata?.role || 'site_qs',
        },
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        },
      },
    });
  } catch (error) {
    console.error('Error in login API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to login',
      },
      { status: 500 }
    );
  }
}
