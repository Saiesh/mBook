import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireSessionUser } from '@/lib/api/require-session';
import {
  createAreaBodySchema,
} from '@/lib/api/schemas/areas-team-api';
import { AreaRepository } from '@/lib/project-management/repositories/AreaRepository';
import { ProjectRepository } from '@/lib/project-management/repositories/ProjectRepository';
import type { CreateAreaDTO } from '@/lib/project-management/types';

const projectIdParamSchema = z.string().uuid();

/**
 * GET /api/projects/:id/areas
 * Get all areas for a project as a flat list
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  try {
    const { id: projectId } = await params;
    const idParsed = projectIdParamSchema.safeParse(projectId);
    if (!idParsed.success) {
      return NextResponse.json(
        { success: false, error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const projectRepo = new ProjectRepository(session.supabase);
    const project = await projectRepo.findById(idParsed.data);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    const repository = new AreaRepository(session.supabase);
    const areas = await repository.findByProjectId(idParsed.data);

    return NextResponse.json({
      success: true,
      data: areas,
    });
  } catch (error) {
    console.error('[GET /api/projects/:id/areas]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch areas',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/:id/areas
 * Create a new area
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  try {
    const { id: projectId } = await params;
    const idParsed = projectIdParamSchema.safeParse(projectId);
    if (!idParsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid project id' },
        { status: 400 }
      );
    }

    const projectRepo = new ProjectRepository(session.supabase);
    const project = await projectRepo.findById(idParsed.data);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = createAreaBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const p = parsed.data;
    const dto: CreateAreaDTO = {
      projectId: idParsed.data,
      code: p.code.trim().toUpperCase(),
      name: p.name.trim(),
    };

    if (p.description !== undefined && p.description !== null) {
      dto.description =
        typeof p.description === 'string' ? p.description.trim() : String(p.description);
    }

    if (p.sortOrder !== undefined && p.sortOrder !== null) {
      dto.sortOrder = p.sortOrder;
    }

    const repository = new AreaRepository(session.supabase);
    const existingArea = await repository.findByCode(idParsed.data, dto.code);
    if (existingArea) {
      return NextResponse.json(
        {
          success: false,
          error: `Area with code "${dto.code}" already exists in this project`,
        },
        { status: 409 }
      );
    }

    const area = await repository.create(dto);

    return NextResponse.json(
      {
        success: true,
        data: area,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/projects/:id/areas]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create area',
      },
      { status: 500 }
    );
  }
}
