import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { UserRepository } from '@/lib/user-management/repositories/UserRepository';
import type {
  CreateUserDTO,
  UserRole,
} from '@/lib/user-management/types';
import { getAuthenticatedAdmin } from '@/lib/auth';

export interface UserListItem {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
}

const VALID_ROLES: UserRole[] = ['admin', 'ho_qs', 'site_qs'];

/**
 * GET /api/users
 * List users - supports two modes:
 * 1. Paginated (admin users page): ?page=1&limit=50&search=&role=&sortBy=created_at&sortOrder=desc
 * 2. Simple (dropdowns): ?search= - returns up to 100 users, no pagination
 */
export async function GET(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: 'Database connection not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page');
    const limit = searchParams.get('limit');
    const usePagination = page !== null || limit !== null;

    const repository = new UserRepository(supabaseAdmin);

    if (usePagination) {
      const filters = {
        search: searchParams.get('search')?.trim() || undefined,
        role: (searchParams.get('role') as UserRole) || undefined,
        isActive:
          searchParams.get('isActive') === 'true'
            ? true
            : searchParams.get('isActive') === 'false'
              ? false
              : undefined,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 50,
        sortBy: searchParams.get('sortBy') || 'created_at',
        sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
      };

      const result = await repository.findAll(filters);
      return NextResponse.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    }

    // Simple mode for dropdowns (e.g. add team member)
    const search = searchParams.get('search')?.trim();
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
    console.error('Error in users API:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to fetch users',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users
 * Create a new user (admin only)
 * Body: { email, name, role, password [, phone] }
 */
export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: 'Database connection not configured' },
        { status: 500 }
      );
    }

    const adminCheck = await getAuthenticatedAdmin(request);
    if (adminCheck instanceof NextResponse) {
      return adminCheck;
    }

    const body = await request.json();

    // Validate required fields
    if (!body.email || typeof body.email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    const email = body.email.trim();
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    const name = body.name.trim();
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!body.role || !VALID_ROLES.includes(body.role)) {
      return NextResponse.json(
        {
          success: false,
          error: `Role must be one of: ${VALID_ROLES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    if (!body.password || typeof body.password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Password is required' },
        { status: 400 }
      );
    }

    const password = body.password;
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const dto: CreateUserDTO = {
      email,
      name,
      role: body.role as UserRole,
      password,
    };

    if (body.phone !== undefined && body.phone !== null) {
      dto.phone =
        typeof body.phone === 'string' ? body.phone.trim() : String(body.phone);
    }

    const repository = new UserRepository(supabaseAdmin);

    // Check if email already exists
    const existing = await repository.findByEmail(email);
    if (existing) {
      return NextResponse.json(
        { success: false, error: `User with email "${email}" already exists` },
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
    console.error('Error creating user:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create user',
      },
      { status: 500 }
    );
  }
}
