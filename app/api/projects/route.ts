import { NextRequest, NextResponse } from 'next/server';

import {
  createProjectBodySchema,
  projectListQuerySchema,
  toProjectFilters,
} from '@/lib/api/schemas/project-api';
import { requireSessionUser } from '@/lib/api/require-session';
import { ProjectRepository } from '@/lib/project-management/repositories/ProjectRepository';
import type { CreateProjectDTO } from '@/lib/project-management/types';

/**
 * GET /api/projects
 * List projects with optional filters, search, and pagination
 */
export async function GET(request: NextRequest) {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  try {
    const raw = Object.fromEntries(new URL(request.url).searchParams.entries());
    const parsed = projectListQuerySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters', details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const filters = toProjectFilters(parsed.data);
    const repository = new ProjectRepository(session.supabase);
    const result = await repository.findAll(filters);

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('[GET /api/projects]', error);
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
 */
export async function POST(request: NextRequest) {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  try {
    const body = await request.json().catch(() => null);
    const parsed = createProjectBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const p = parsed.data;
    const dto: CreateProjectDTO = {
      name: p.name.trim(),
      code: p.code.trim().toUpperCase(),
    };

    if (p.clientName !== undefined) dto.clientName = p.clientName.trim();
    if (p.location) {
      dto.location = {};
      if (p.location.city) dto.location.city = p.location.city.trim();
      if (p.location.state) dto.location.state = p.location.state.trim();
      if (p.location.address) dto.location.address = p.location.address.trim();
    }
    if (p.startDate) dto.startDate = p.startDate;
    if (p.endDate) dto.endDate = p.endDate;
    if (p.description) dto.description = p.description.trim();
    if (p.budget !== undefined) dto.budget = p.budget;

    const repository = new ProjectRepository(session.supabase);
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

    const project = await repository.create(dto, session.userId);

    return NextResponse.json(
      {
        success: true,
        data: project,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/projects]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create project',
      },
      { status: 500 }
    );
  }
}
