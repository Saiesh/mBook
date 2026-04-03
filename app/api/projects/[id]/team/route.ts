import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireSessionUser } from '@/lib/api/require-session';
import {
  teamMemberBodySchema,
  teamMemberDeleteBodySchema,
} from '@/lib/api/schemas/areas-team-api';
import { ProjectTeamRepository } from '@/lib/project-management/repositories/ProjectTeamRepository';
import { ProjectRepository } from '@/lib/project-management/repositories/ProjectRepository';
import type { AddTeamMemberDTO } from '@/lib/project-management/types';

const projectIdParamSchema = z.string().uuid();

/**
 * GET /api/projects/:id/team
 * List team members for a project
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

    const teamRepo = new ProjectTeamRepository(session.supabase);
    const members = await teamRepo.getTeamMembers(idParsed.data);

    return NextResponse.json({
      success: true,
      data: members,
    });
  } catch (error) {
    console.error('[GET /api/projects/:id/team]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch team members',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/:id/team
 * Add a team member
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
    const parsed = teamMemberBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const dto: AddTeamMemberDTO = {
      projectId: idParsed.data,
      userId: parsed.data.userId,
      role: parsed.data.role,
    };

    const teamRepo = new ProjectTeamRepository(session.supabase);
    const member = await teamRepo.addMember(dto);

    return NextResponse.json(
      {
        success: true,
        data: member,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/projects/:id/team]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add team member',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/:id/team
 * Remove a team member
 */
export async function DELETE(
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
    const parsed = teamMemberDeleteBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const teamRepo = new ProjectTeamRepository(session.supabase);
    await teamRepo.removeMember(idParsed.data, parsed.data.userId, parsed.data.role);

    return NextResponse.json({
      success: true,
      message: 'Team member removed successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/projects/:id/team]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove team member',
      },
      { status: 500 }
    );
  }
}
