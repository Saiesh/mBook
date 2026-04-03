import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireSessionUser } from '@/lib/api/require-session';
import { updateAreaBodySchema } from '@/lib/api/schemas/areas-team-api';
import { AreaRepository } from '@/lib/project-management/repositories/AreaRepository';
import { ProjectRepository } from '@/lib/project-management/repositories/ProjectRepository';
import type { UpdateAreaDTO } from '@/lib/project-management/types';

const uuidParam = z.string().uuid();

/**
 * PUT /api/projects/:id/areas/:areaId
 * Update an area
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; areaId: string }> }
) {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  try {
    const { id: projectId, areaId } = await params;
    const pid = uuidParam.safeParse(projectId);
    const aid = uuidParam.safeParse(areaId);
    if (!pid.success || !aid.success) {
      return NextResponse.json(
        { success: false, error: 'Project ID and Area ID must be valid UUIDs' },
        { status: 400 }
      );
    }

    const projectRepo = new ProjectRepository(session.supabase);
    const project = await projectRepo.findById(pid.data);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    const repository = new AreaRepository(session.supabase);
    const existingArea = await repository.findById(aid.data);

    if (!existingArea) {
      return NextResponse.json(
        { success: false, error: 'Area not found' },
        { status: 404 }
      );
    }

    if (existingArea.projectId !== pid.data) {
      return NextResponse.json(
        { success: false, error: 'Area does not belong to this project' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = updateAreaBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const p = parsed.data;
    const updates: UpdateAreaDTO = {};

    if (p.code !== undefined) updates.code = p.code.trim().toUpperCase();
    if (p.name !== undefined) updates.name = p.name.trim();
    if (p.description !== undefined) {
      updates.description =
        p.description === null ? undefined : p.description.trim();
    }
    if (p.sortOrder !== undefined && p.sortOrder !== null) {
      updates.sortOrder = p.sortOrder;
    }
    if (p.isActive !== undefined) updates.isActive = p.isActive;

    if (updates.code && updates.code !== existingArea.code) {
      const duplicateArea = await repository.findByCode(pid.data, updates.code);
      if (duplicateArea) {
        return NextResponse.json(
          {
            success: false,
            error: `Area with code "${updates.code}" already exists in this project`,
          },
          { status: 409 }
        );
      }
    }

    const area = await repository.update(aid.data, updates);

    return NextResponse.json({
      success: true,
      data: area,
    });
  } catch (error) {
    console.error('[PUT /api/projects/:id/areas/:areaId]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update area',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/:id/areas/:areaId
 * Soft delete an area
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; areaId: string }> }
) {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  try {
    const { id: projectId, areaId } = await params;
    const pid = uuidParam.safeParse(projectId);
    const aid = uuidParam.safeParse(areaId);
    if (!pid.success || !aid.success) {
      return NextResponse.json(
        { success: false, error: 'Project ID and Area ID must be valid UUIDs' },
        { status: 400 }
      );
    }

    const projectRepo = new ProjectRepository(session.supabase);
    const project = await projectRepo.findById(pid.data);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    const repository = new AreaRepository(session.supabase);
    const existingArea = await repository.findById(aid.data);

    if (!existingArea) {
      return NextResponse.json(
        { success: false, error: 'Area not found' },
        { status: 404 }
      );
    }

    if (existingArea.projectId !== pid.data) {
      return NextResponse.json(
        { success: false, error: 'Area does not belong to this project' },
        { status: 403 }
      );
    }

    await repository.softDelete(aid.data);

    return NextResponse.json({
      success: true,
      message: 'Area deleted successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/projects/:id/areas/:areaId]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete area',
      },
      { status: 500 }
    );
  }
}
