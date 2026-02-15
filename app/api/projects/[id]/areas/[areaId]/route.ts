import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { AreaRepository } from '@/lib/project-management/repositories/AreaRepository';
import { ProjectRepository } from '@/lib/project-management/repositories/ProjectRepository';
import type { UpdateAreaDTO } from '@/lib/project-management/types';

/**
 * PUT /api/projects/:id/areas/:areaId
 * Update an area
 * Body: UpdateAreaDTO - all fields optional (code, name, description, parentAreaId, sortOrder, isActive)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; areaId: string }> }
) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: 'Database connection not configured' },
        { status: 500 }
      );
    }

    const { id: projectId, areaId } = await params;
    if (!projectId || !areaId) {
      return NextResponse.json(
        { success: false, error: 'Project ID and Area ID are required' },
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
    const existingArea = await repository.findById(areaId);

    if (!existingArea) {
      return NextResponse.json(
        { success: false, error: 'Area not found' },
        { status: 404 }
      );
    }

    // Verify area belongs to this project
    if (existingArea.projectId !== projectId) {
      return NextResponse.json(
        { success: false, error: 'Area does not belong to this project' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Build UpdateAreaDTO - all fields optional
    const updates: UpdateAreaDTO = {};

    if (body.code !== undefined) {
      if (typeof body.code !== 'string' || !body.code.trim()) {
        return NextResponse.json(
          { success: false, error: 'Area code must be a non-empty string' },
          { status: 400 }
        );
      }
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
      updates.code = body.code.trim().toUpperCase();
    }

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return NextResponse.json(
          { success: false, error: 'Area name must be a non-empty string' },
          { status: 400 }
        );
      }
      updates.name = body.name.trim();
    }

    if (body.description !== undefined) {
      updates.description =
        body.description === null
          ? undefined
          : typeof body.description === 'string'
            ? body.description.trim()
            : body.description;
    }

    if (body.parentAreaId !== undefined) {
      updates.parentAreaId =
        body.parentAreaId === null || body.parentAreaId === ''
          ? null
          : body.parentAreaId;
    }

    if (body.sortOrder !== undefined && body.sortOrder !== null) {
      const sortOrder = Number(body.sortOrder);
      if (isNaN(sortOrder) || sortOrder < 0) {
        return NextResponse.json(
          { success: false, error: 'Sort order must be a non-negative number' },
          { status: 400 }
        );
      }
      updates.sortOrder = sortOrder;
    }

    if (body.isActive !== undefined) {
      updates.isActive = Boolean(body.isActive);
    }

    // Check for code uniqueness if updating code
    if (updates.code && updates.code !== existingArea.code) {
      const duplicateArea = await repository.findByCode(projectId, updates.code);
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

    const area = await repository.update(areaId, updates);

    return NextResponse.json({
      success: true,
      data: area,
    });
  } catch (error) {
    console.error('Error updating area:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to update area',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/:id/areas/:areaId
 * Soft delete an area
 * Note: Consider checking for child areas before deletion (plan suggests this for UI)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; areaId: string }> }
) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: 'Database connection not configured' },
        { status: 500 }
      );
    }

    const { id: projectId, areaId } = await params;
    if (!projectId || !areaId) {
      return NextResponse.json(
        { success: false, error: 'Project ID and Area ID are required' },
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
    const existingArea = await repository.findById(areaId);

    if (!existingArea) {
      return NextResponse.json(
        { success: false, error: 'Area not found' },
        { status: 404 }
      );
    }

    // Verify area belongs to this project
    if (existingArea.projectId !== projectId) {
      return NextResponse.json(
        { success: false, error: 'Area does not belong to this project' },
        { status: 403 }
      );
    }

    // Check for child areas - zones with sub-areas should ideally have children deleted first
    const childCount = await repository.countByParentId(areaId);
    if (childCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete area with ${childCount} sub-area(s). Delete sub-areas first.`,
        },
        { status: 400 }
      );
    }

    await repository.softDelete(areaId);

    return NextResponse.json({
      success: true,
      message: 'Area deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting area:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to delete area',
      },
      { status: 500 }
    );
  }
}
