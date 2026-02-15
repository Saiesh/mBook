import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { AreaRepository } from '@/lib/project-management/repositories/AreaRepository';
import { ProjectRepository } from '@/lib/project-management/repositories/ProjectRepository';
import type { CreateAreaDTO } from '@/lib/project-management/types';

/**
 * GET /api/projects/:id/areas
 * Get area hierarchy for a project (zones and sub-areas as tree)
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

    const { id: projectId } = await params;
    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Verify project exists
    const projectRepo = new ProjectRepository(supabaseAdmin);
    const project = await projectRepo.findById(projectId);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    const repository = new AreaRepository(supabaseAdmin);
    const hierarchy = await repository.getHierarchy(projectId);

    return NextResponse.json({
      success: true,
      data: hierarchy,
    });
  } catch (error) {
    console.error('Error fetching area hierarchy:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch area hierarchy',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/:id/areas
 * Create a new area (zone or sub-area)
 * Body: { code, name, description?, parentAreaId?, sortOrder? }
 * - parentAreaId: null/omit for zone (level 1), set for sub-area (level 2)
 */
export async function POST(
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

    const { id: projectId } = await params;
    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Verify project exists
    const projectRepo = new ProjectRepository(supabaseAdmin);
    const project = await projectRepo.findById(projectId);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.code || typeof body.code !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Area code is required' },
        { status: 400 }
      );
    }

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Area name is required' },
        { status: 400 }
      );
    }

    // Validate code format (alphanumeric, hyphens, underscores)
    const codeRegex = /^[A-Z0-9_-]+$/i;
    if (!codeRegex.test(body.code)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Area code must contain only letters, numbers, hyphens, and underscores',
        },
        { status: 400 }
      );
    }

    // Build CreateAreaDTO
    const dto: CreateAreaDTO = {
      projectId,
      code: body.code.trim().toUpperCase(),
      name: body.name.trim(),
    };

    if (body.description !== undefined && body.description !== null) {
      dto.description = typeof body.description === 'string'
        ? body.description.trim()
        : String(body.description);
    }

    if (body.parentAreaId !== undefined && body.parentAreaId !== null) {
      dto.parentAreaId = body.parentAreaId;
    }

    if (body.sortOrder !== undefined && body.sortOrder !== null) {
      const sortOrder = Number(body.sortOrder);
      if (isNaN(sortOrder) || sortOrder < 0) {
        return NextResponse.json(
          { success: false, error: 'Sort order must be a non-negative number' },
          { status: 400 }
        );
      }
      dto.sortOrder = sortOrder;
    }

    // Check if area code already exists in this project
    const repository = new AreaRepository(supabaseAdmin);
    const existingArea = await repository.findByCode(projectId, dto.code);
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
    console.error('Error creating area:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create area',
      },
      { status: 500 }
    );
  }
}
