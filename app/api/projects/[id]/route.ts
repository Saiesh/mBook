import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireSessionUser } from '@/lib/api/require-session';
import { updateProjectBodySchema } from '@/lib/api/schemas/project-api';
import { ProjectRepository } from '@/lib/project-management/repositories/ProjectRepository';
import type { UpdateProjectDTO } from '@/lib/project-management/types';

const idParamSchema = z.string().uuid('Invalid project id');

/**
 * GET /api/projects/:id
 * Get project details by ID
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  try {
    const { id } = await params;
    const idParsed = idParamSchema.safeParse(id);
    if (!idParsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid project id' },
        { status: 400 }
      );
    }

    const repository = new ProjectRepository(session.supabase);
    const project = await repository.findById(idParsed.data);

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
    console.error('[GET /api/projects/:id]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch project',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/projects/:id
 * Update project
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  try {
    const { id } = await params;
    const idParsed = idParamSchema.safeParse(id);
    if (!idParsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid project id' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = updateProjectBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const p = parsed.data;
    const updates: UpdateProjectDTO = {};

    if (p.name !== undefined) updates.name = p.name.trim();
    if (p.clientName !== undefined) {
      updates.clientName =
        p.clientName === null ? undefined : p.clientName.trim();
    }
    if (p.location !== undefined) {
      if (p.location === null) {
        updates.location = { city: '', state: '', address: '' };
      } else {
        updates.location = {
          city: p.location.city?.trim() ?? undefined,
          state: p.location.state?.trim() ?? undefined,
          address: p.location.address?.trim() ?? undefined,
        };
      }
    }
    if (p.startDate !== undefined) {
      updates.startDate = p.startDate === null ? undefined : p.startDate;
    }
    if (p.endDate !== undefined) {
      updates.endDate = p.endDate === null ? undefined : p.endDate;
    }
    if (p.status !== undefined) updates.status = p.status;
    if (p.description !== undefined) {
      updates.description =
        p.description === null ? undefined : p.description.trim();
    }
    if (p.budget !== undefined && p.budget !== null) {
      updates.budget = p.budget;
    }

    const repository = new ProjectRepository(session.supabase);
    const project = await repository.update(idParsed.data, updates);

    return NextResponse.json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error('[PUT /api/projects/:id]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update project',
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
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  try {
    const { id } = await params;
    const idParsed = idParamSchema.safeParse(id);
    if (!idParsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid project id' },
        { status: 400 }
      );
    }

    const repository = new ProjectRepository(session.supabase);
    const project = await repository.findById(idParsed.data);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    await repository.softDelete(idParsed.data);

    return NextResponse.json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/projects/:id]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete project',
      },
      { status: 500 }
    );
  }
}
