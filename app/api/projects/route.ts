import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { ProjectRepository } from '@/lib/project-management/repositories/ProjectRepository';
import type {
  CreateProjectDTO,
  ProjectFilters,
  ProjectStatus,
} from '@/lib/project-management/types';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getCreatorUserId(request: NextRequest): Promise<string | null> {
  // 1. Try authenticated user from Bearer token
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ') && supabaseAdmin) {
    const token = authHeader.slice(7);
    const {
      data: { user },
    } = await supabaseAdmin.auth.getUser(token);
    if (user?.id && UUID_REGEX.test(user.id)) return user.id;
  }

  // 2. Fallback: SYSTEM_USER_ID env (for development or service accounts)
  const envUserId = process.env.SYSTEM_USER_ID?.trim();
  if (envUserId && UUID_REGEX.test(envUserId)) return envUserId;

  // 3. Last resort: use first user in public.users (works after /api/test-supabase or signup)
  if (supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from('users')
      .select('id')
      .limit(1)
      .maybeSingle();
    if (data?.id && UUID_REGEX.test(data.id)) return data.id;
  }

  return null;
}

/**
 * GET /api/projects
 * List projects with optional filters, search, and pagination
 * Query params:
 * - status: active | completed | on_hold | cancelled
 * - search: search term for name/code
 * - createdBy: filter by creator user ID
 * - startDateFrom: filter start date >= this value (ISO string)
 * - startDateTo: filter start date <= this value (ISO string)
 * - page: page number (default: 1)
 * - limit: items per page (default: 20, max: 100)
 * - sortBy: name | code | created_at | updated_at (default: created_at)
 * - sortOrder: asc | desc (default: desc)
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

    // Build filters from query parameters
    const filters: ProjectFilters = {};

    const status = searchParams.get('status');
    if (status) {
      filters.status = status as ProjectStatus;
    }

    const search = searchParams.get('search');
    if (search) {
      filters.search = search;
    }

    const createdBy = searchParams.get('createdBy');
    if (createdBy) {
      filters.createdBy = createdBy;
    }

    const startDateFrom = searchParams.get('startDateFrom');
    if (startDateFrom) {
      filters.startDateFrom = startDateFrom;
    }

    const startDateTo = searchParams.get('startDateTo');
    if (startDateTo) {
      filters.startDateTo = startDateTo;
    }

    const page = searchParams.get('page');
    if (page) {
      filters.page = parseInt(page, 10);
    }

    const limit = searchParams.get('limit');
    if (limit) {
      filters.limit = parseInt(limit, 10);
    }

    const sortBy = searchParams.get('sortBy');
    if (sortBy) {
      filters.sortBy = sortBy as ProjectFilters['sortBy'];
    }

    const sortOrder = searchParams.get('sortOrder');
    if (sortOrder) {
      filters.sortOrder = sortOrder as 'asc' | 'desc';
    }

    // Query database via repository
    const repository = new ProjectRepository(supabaseAdmin);
    const result = await repository.findAll(filters);

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Error listing projects:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list projects',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects
 * Create a new project
 * Body: CreateProjectDTO
 * Required fields: name, code
 * Optional: clientName, location{city, state, address}, startDate, endDate, description, budget
 */
export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: 'Database connection not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Project name is required' },
        { status: 400 }
      );
    }

    if (!body.code || typeof body.code !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Project code is required' },
        { status: 400 }
      );
    }

    // Validate code format (alphanumeric, hyphens, underscores)
    const codeRegex = /^[A-Z0-9_-]+$/i;
    if (!codeRegex.test(body.code)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project code must contain only letters, numbers, hyphens, and underscores',
        },
        { status: 400 }
      );
    }

    // Build DTO
    const dto: CreateProjectDTO = {
      name: body.name.trim(),
      code: body.code.trim().toUpperCase(),
    };

    if (body.clientName) {
      dto.clientName = body.clientName.trim();
    }

    if (body.location && typeof body.location === 'object') {
      dto.location = {};
      if (body.location.city) dto.location.city = body.location.city.trim();
      if (body.location.state) dto.location.state = body.location.state.trim();
      if (body.location.address)
        dto.location.address = body.location.address.trim();
    }

    if (body.startDate) {
      dto.startDate = body.startDate;
    }

    if (body.endDate) {
      dto.endDate = body.endDate;
    }

    if (body.description) {
      dto.description = body.description.trim();
    }

    if (body.budget !== undefined && body.budget !== null) {
      const budget = Number(body.budget);
      if (isNaN(budget) || budget < 0) {
        return NextResponse.json(
          { success: false, error: 'Budget must be a positive number' },
          { status: 400 }
        );
      }
      dto.budget = budget;
    }

    // Get creator user ID: from auth session when available, else from SYSTEM_USER_ID env
    // created_by must be a valid UUID referencing auth.users (required by DB schema)
    const createdBy = await getCreatorUserId(request);
    if (!createdBy) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Project creation requires a creator user. Either sign in with a Bearer token, run GET /api/test-supabase to create a test user, or set SYSTEM_USER_ID in .env.local to a valid user UUID.',
        },
        { status: 401 }
      );
    }

    // Check if project code already exists
    const repository = new ProjectRepository(supabaseAdmin);
    const codeExists = await repository.exists(dto.code);
    if (codeExists) {
      return NextResponse.json(
        {
          success: false,
          error: `Project with code "${dto.code}" already exists`,
        },
        { status: 409 }
      );
    }

    // Create project
    const project = await repository.create(dto, createdBy);

    return NextResponse.json(
      {
        success: true,
        data: project,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create project',
      },
      { status: 500 }
    );
  }
}
