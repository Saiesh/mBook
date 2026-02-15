import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { ProjectTeamRepository } from '@/lib/project-management/repositories/ProjectTeamRepository';
import { ProjectRepository } from '@/lib/project-management/repositories/ProjectRepository';
import type { AddTeamMemberDTO, TeamMemberRole } from '@/lib/project-management/types';

const VALID_ROLES: TeamMemberRole[] = ['ho_qs', 'site_qs', 'project_incharge'];

/**
 * GET /api/projects/:id/team
 * List team members for a project
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

    const teamRepo = new ProjectTeamRepository(supabaseAdmin);
    const members = await teamRepo.getTeamMembers(projectId);

    return NextResponse.json({
      success: true,
      data: members,
    });
  } catch (error) {
    console.error('Error fetching team members:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch team members',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/:id/team
 * Add a team member
 * Body: { userId: string, role: TeamMemberRole }
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

    if (!body.userId || typeof body.userId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
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

    const dto: AddTeamMemberDTO = {
      projectId,
      userId: body.userId.trim(),
      role: body.role,
    };

    const teamRepo = new ProjectTeamRepository(supabaseAdmin);
    const member = await teamRepo.addMember(dto);

    return NextResponse.json(
      {
        success: true,
        data: member,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error adding team member:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to add team member',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/:id/team
 * Remove a team member
 * Body: { userId: string, role: string }
 * Note: role is required because a user may have multiple role assignments on the same project
 */
export async function DELETE(
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

    if (!body.userId || typeof body.userId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
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

    const teamRepo = new ProjectTeamRepository(supabaseAdmin);
    await teamRepo.removeMember(projectId, body.userId.trim(), body.role);

    return NextResponse.json({
      success: true,
      message: 'Team member removed successfully',
    });
  } catch (error) {
    console.error('Error removing team member:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to remove team member',
      },
      { status: 500 }
    );
  }
}
