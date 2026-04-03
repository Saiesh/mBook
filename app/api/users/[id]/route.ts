import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getAuthenticatedAdmin, isValidUUID } from '@/lib/auth';
import { UserRepository } from '@/lib/user-management/repositories/UserRepository';
import { supabaseAdmin } from '@/lib/supabase';
import type { UserRole } from '@/lib/user-management/types';

const USER_ROLE_VALUES = ['admin', 'ho_qs', 'site_qs'] as const satisfies readonly UserRole[];

const updateUserRoleSchema = z.object({
  role: z.enum(USER_ROLE_VALUES),
});

/**
 * GET /api/users/:id
 * Get single user by ID (admin only)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: 'Database connection not configured' },
        { status: 500 }
      );
    }

    const adminCheck = await getAuthenticatedAdmin();
    if (adminCheck instanceof NextResponse) {
      return adminCheck;
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!isValidUUID(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid user ID format' },
        { status: 400 }
      );
    }

    const repository = new UserRepository(supabaseAdmin);
    const user = await repository.findById(id);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('[GET /api/users/:id]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch user',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/users/:id
 * Update user role (admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: 'Database connection not configured' },
        { status: 500 }
      );
    }

    const adminCheck = await getAuthenticatedAdmin();
    if (adminCheck instanceof NextResponse) {
      return adminCheck;
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!isValidUUID(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid user ID format' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = updateUserRoleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const repository = new UserRepository(supabaseAdmin);

    const existing = await repository.findById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const user = await repository.updateRole(id, parsed.data.role);

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('[PUT /api/users/:id]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update user role',
      },
      { status: 500 }
    );
  }
}
