import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { ProjectRepository } from '@/lib/project-management/repositories/ProjectRepository';
import type {
  UpdateProjectDTO,
  ProjectStatus,
} from '@/lib/project-management/types';

const VALID_STATUSES: ProjectStatus[] = [
  'active',
  'completed',
  'on_hold',
  'cancelled',
];

/**
 * GET /api/projects/:id
 * Get project details by ID
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

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const repository = new ProjectRepository(supabaseAdmin);
    const project = await repository.findById(id);

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to fetch project',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/projects/:id
 * Update project
 * Body: UpdateProjectDTO - all fields optional
 * Fields: name, clientName, location{city, state, address}, startDate, endDate, status, description, budget
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

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Build UpdateProjectDTO - all fields optional
    const updates: UpdateProjectDTO = {};

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return NextResponse.json(
          { success: false, error: 'Project name must be a non-empty string' },
          { status: 400 }
        );
      }
      updates.name = body.name.trim();
    }

    if (body.clientName !== undefined) {
      updates.clientName =
        body.clientName === null
          ? undefined
          : typeof body.clientName === 'string'
            ? body.clientName.trim()
            : body.clientName;
    }

    if (body.location !== undefined) {
      if (body.location !== null && typeof body.location !== 'object') {
        return NextResponse.json(
          { success: false, error: 'Location must be an object' },
          { status: 400 }
        );
      }
      updates.location = body.location
        ? {
            city: body.location.city?.trim() ?? undefined,
            state: body.location.state?.trim() ?? undefined,
            address: body.location.address?.trim() ?? undefined,
          }
        : { city: '', state: '', address: '' };
    }

    if (body.startDate !== undefined) {
      updates.startDate =
        body.startDate === null ? undefined : body.startDate;
    }

    if (body.endDate !== undefined) {
      updates.endDate = body.endDate === null ? undefined : body.endDate;
    }

    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json(
          {
            success: false,
            error: `Status must be one of: ${VALID_STATUSES.join(', ')}`,
          },
          { status: 400 }
        );
      }
      updates.status = body.status;
    }

    if (body.description !== undefined) {
      updates.description =
        body.description === null
          ? undefined
          : typeof body.description === 'string'
            ? body.description.trim()
            : body.description;
    }

    if (body.budget !== undefined && body.budget !== null) {
      const budget = Number(body.budget);
      if (isNaN(budget) || budget < 0) {
        return NextResponse.json(
          { success: false, error: 'Budget must be a positive number' },
          { status: 400 }
        );
      }
      updates.budget = budget;
    }

    const repository = new ProjectRepository(supabaseAdmin);
    const project = await repository.update(id, updates);

    return NextResponse.json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to update project',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/:id
 * Soft delete project
 */
export async function DELETE(
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

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const repository = new ProjectRepository(supabaseAdmin);

    // Verify project exists before deleting
    const project = await repository.findById(id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    await repository.softDelete(id);

    return NextResponse.json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to delete project',
      },
      { status: 500 }
    );
  }
}
