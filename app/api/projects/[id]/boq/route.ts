import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireSessionUser } from '@/lib/api/require-session';
import { mapBOQImportError } from '@/lib/boq-management/boq-import-errors';
import { BOQRepository } from '@/lib/boq-management/repositories/BOQRepository';
import { BOQImportService } from '@/lib/boq-management/services/BOQImportService';
import { ProjectRepository } from '@/lib/project-management/repositories/ProjectRepository';

const projectIdParamSchema = z.string().uuid();

/**
 * GET /api/projects/:id/boq
 * List all BOQ versions for a project (newest first).
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

    const boqRepo = new BOQRepository(session.supabase);
    const versions = await boqRepo.findVersionsByProjectId(idParsed.data);

    return NextResponse.json({ success: true, data: versions });
  } catch (error) {
    console.error('[GET /api/projects/:id/boq]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch BOQ versions',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/:id/boq
 * Upload a new BOQ Excel file.
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

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'An Excel file (.xlsx) is required' },
        { status: 400 }
      );
    }

    if (!file.name.endsWith('.xlsx')) {
      return NextResponse.json(
        { success: false, error: 'Only .xlsx files are supported' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const boqRepo = new BOQRepository(session.supabase);
    const importService = new BOQImportService(boqRepo);

    const result = await importService.importFromBuffer(
      buffer,
      idParsed.data,
      file.name
    );

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/projects/:id/boq]', error);
    const mapped = mapBOQImportError(error);
    if (mapped) {
      return NextResponse.json(
        {
          success: false,
          error: mapped.message,
        },
        { status: mapped.status }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import BOQ',
      },
      { status: 500 }
    );
  }
}
