import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireSessionUser } from '@/lib/api/require-session';
import {
  createMeasurementBodySchema,
  measurementListQuerySchema,
} from '@/lib/api/schemas/measurement-api';
import { ProjectRepository } from '@/lib/project-management/repositories/ProjectRepository';

/** Why: explicit measurement columns for list responses (no `select('*')`). */
const MEASUREMENT_LIST_SELECT =
  'id, project_id, boq_item_id, area_name, nos, length, breadth, depth, quantity, unit, measurement_date, remarks, is_deduction, created_by, client_id, synced_at, created_at, updated_at, deleted_at';

const projectIdParamSchema = z.string().uuid();

function calculateQuantity(
  nos?: number,
  length?: number | null,
  breadth?: number | null,
  depth?: number | null
): number {
  return (nos ?? 1) * (length ?? 1) * (breadth ?? 1) * (depth ?? 1);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  try {
    const { id: projectId } = await params;
    const idParsed = projectIdParamSchema.safeParse(projectId);
    if (!idParsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid project id' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const q = measurementListQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!q.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters', details: q.error.flatten() },
        { status: 422 }
      );
    }

    const { date, dateFrom, dateTo, boqItemId, areaName, groupBy } = q.data;

    if (dateFrom && dateTo && dateFrom > dateTo) {
      return NextResponse.json(
        { success: false, error: 'dateFrom cannot be later than dateTo' },
        { status: 400 }
      );
    }

    let query = session.supabase
      .from('measurements')
      .select(MEASUREMENT_LIST_SELECT)
      .eq('project_id', idParsed.data)
      .is('deleted_at', null)
      .order('measurement_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (date) {
      query = query.eq('measurement_date', date);
    }
    if (dateFrom) {
      query = query.gte('measurement_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('measurement_date', dateTo);
    }
    if (boqItemId) {
      query = query.eq('boq_item_id', boqItemId);
    }
    if (areaName) {
      query = query.ilike('area_name', `%${areaName}%`);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch measurements: ${error.message}`);
    }

    if (groupBy === 'date') {
      const grouped = (data ?? []).reduce<Record<string, unknown[]>>((acc, row) => {
        const key = String((row as { measurement_date: string }).measurement_date);
        if (!acc[key]) acc[key] = [];
        acc[key].push(row);
        return acc;
      }, {});
      return NextResponse.json({ success: true, data: grouped });
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (error) {
    console.error('[GET /api/projects/:id/measurements]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch measurements',
      },
      { status: 500 }
    );
  }
}

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
      return NextResponse.json({ success: false, error: 'Invalid project id' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const parsed = createMeasurementBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const p = parsed.data;
    const projectRepo = new ProjectRepository(session.supabase);
    const project = await projectRepo.findById(idParsed.data);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    const nos = p.nos != null ? Number(p.nos) : 1;
    const length = p.length != null ? Number(p.length) : null;
    const breadth = p.breadth != null ? Number(p.breadth) : null;
    const depth = p.depth != null ? Number(p.depth) : null;

    const { data, error } = await session.supabase
      .from('measurements')
      .insert({
        project_id: idParsed.data,
        boq_item_id: p.boqItemId,
        area_name: p.areaName.trim(),
        nos,
        length,
        breadth,
        depth,
        quantity: calculateQuantity(nos, length, breadth, depth),
        unit: p.unit.trim(),
        measurement_date: p.measurementDate ?? new Date().toISOString().slice(0, 10),
        remarks: p.remarks ?? null,
        is_deduction: p.isDeduction ?? false,
        created_by: session.userId,
        client_id: p.clientId ?? null,
        synced_at: p.clientId ? new Date().toISOString() : null,
      })
      .select(MEASUREMENT_LIST_SELECT)
      .single();

    if (error) {
      throw new Error(`Failed to create measurement: ${error.message}`);
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/projects/:id/measurements]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create measurement',
      },
      { status: 500 }
    );
  }
}
