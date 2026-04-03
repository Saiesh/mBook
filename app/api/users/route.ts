import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireSessionUser } from '@/lib/api/require-session';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { UserRepository } from '@/lib/user-management/repositories/UserRepository';
import { supabaseAdmin } from '@/lib/supabase';
import type {
  CreateUserDTO,
  UserRole,
} from '@/lib/user-management/types';

export interface UserListItem {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
}

const USER_CREATE_ROLES = ['admin', 'ho_qs', 'site_qs'] as const satisfies readonly UserRole[];

const userListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  search: z.string().optional(),
  role: z.enum(['admin', 'ho_qs', 'site_qs']).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * GET /api/users
 * List users — paginated or simple dropdown mode.
 */
export async function GET(request: NextRequest) {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  try {
    const raw = Object.fromEntries(new URL(request.url).searchParams.entries());
    const parsed = userListQuerySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters', details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const q = parsed.data;
    const usePagination = q.page !== undefined || q.limit !== undefined;

    const repository = new UserRepository(session.supabase);

    if (usePagination) {
      const filters = {
        search: q.search?.trim() || undefined,
        role: q.role,
        isActive:
          q.isActive === 'true' ? true : q.isActive === 'false' ? false : undefined,
        page: q.page ?? 1,
        limit: q.limit ?? 50,
        sortBy: q.sortBy || 'created_at',
        sortOrder: q.sortOrder || 'desc',
      };

      const result = await repository.findAll(filters);
      return NextResponse.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    }

    const search = q.search?.trim();
    const result = await repository.findAll({
      search: search || undefined,
      page: 1,
      limit: 100,
      sortBy: 'name',
      sortOrder: 'asc',
    });

    const users: UserListItem[] = result.data.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone,
    }));

    return NextResponse.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('[GET /api/users]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch users',
      },
      { status: 500 }
    );
  }
}

const createUserBodySchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(USER_CREATE_ROLES),
  password: z.string().min(6),
  phone: z.string().optional(),
});

/**
 * POST /api/users
 * Create a new user (admin only)
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => null);
    const parsed = createUserBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const p = parsed.data;
    const dto: CreateUserDTO = {
      email: p.email.trim(),
      name: p.name.trim(),
      role: p.role,
      password: p.password,
    };

    if (p.phone !== undefined) {
      dto.phone = p.phone.trim();
    }

    const repository = new UserRepository(supabaseAdmin);

    const existing = await repository.findByEmail(dto.email);
    if (existing) {
      return NextResponse.json(
        { success: false, error: `User with email "${dto.email}" already exists` },
        { status: 409 }
      );
    }

    const user = await repository.create(dto);

    return NextResponse.json(
      {
        success: true,
        data: user,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/users]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create user',
      },
      { status: 500 }
    );
  }
}
