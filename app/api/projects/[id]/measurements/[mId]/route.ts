import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireSessionUser } from '@/lib/api/require-session';
import { updateMeasurementBodySchema } from '@/lib/api/schemas/measurement-api';

const MEASUREMENT_LIST_SELECT =
  'id, project_id, boq_item_id, area_name, nos, length, breadth, depth, quantity, unit, measurement_date, remarks, is_deduction, created_by, client_id, synced_at, created_at, updated_at, deleted_at';

const uuidParam = z.string().uuid();

function calculateQuantity(
  nos?: number,
  length?: number | null,
  breadth?: number | null,
  depth?: number | null
): number {
  return (nos ?? 1) * (length ?? 1) * (breadth ?? 1) * (depth ?? 1);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; mId: string }> }
) {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  try {
    const { id: projectId, mId } = await params;
    const projectOk = uuidParam.safeParse(projectId);
    const mOk = uuidParam.safeParse(mId);
    if (!projectOk.success || !mOk.success) {
      return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const parsed = updateMeasurementBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { data: existing, error: readError } = await session.supabase
      .from('measurements')
      .select(
        'id, nos, length, breadth, depth, project_id, boq_item_id, area_name, unit, measurement_date, remarks, is_deduction'
      )
      .eq('id', mOk.data)
      .eq('project_id', projectOk.data)
      .is('deleted_at', null)
      .maybeSingle();

    if (readError) throw new Error(`Failed to read measurement: ${readError.message}`);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Measurement not found' },
        { status: 404 }
      );
    }

    const row = existing as {
      nos: number;
      length: number | null;
      breadth: number | null;
      depth: number | null;
    };

    const b = parsed.data;
    const nos = b.nos !== undefined ? Number(b.nos) : Number(row.nos);
    const length =
      b.length !== undefined ? (b.length != null ? Number(b.length) : null) : row.length;
    const breadth =
      b.breadth !== undefined ? (b.breadth != null ? Number(b.breadth) : null) : row.breadth;
    const depth =
      b.depth !== undefined ? (b.depth != null ? Number(b.depth) : null) : row.depth;

    const updateRow: Record<string, unknown> = {
      quantity: calculateQuantity(nos, length, breadth, depth),
    };

    if (b.boqItemId !== undefined) updateRow.boq_item_id = b.boqItemId;
    if (b.areaName !== undefined) updateRow.area_name = b.areaName;
    if (b.nos !== undefined) updateRow.nos = nos;
    if (b.length !== undefined) updateRow.length = length;
    if (b.breadth !== undefined) updateRow.breadth = breadth;
    if (b.depth !== undefined) updateRow.depth = depth;
    if (b.unit !== undefined) updateRow.unit = b.unit;
    if (b.measurementDate !== undefined) updateRow.measurement_date = b.measurementDate;
    if (b.remarks !== undefined) updateRow.remarks = b.remarks;
    if (b.isDeduction !== undefined) updateRow.is_deduction = b.isDeduction;

    const { data, error } = await session.supabase
      .from('measurements')
      .update(updateRow)
      .eq('id', mOk.data)
      .eq('project_id', projectOk.data)
      .is('deleted_at', null)
      .select(MEASUREMENT_LIST_SELECT)
      .single();

    if (error) throw new Error(`Failed to update measurement: ${error.message}`);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[PUT /api/projects/:id/measurements/:mId]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update measurement',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; mId: string }> }
) {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  try {
    const { id: projectId, mId } = await params;
    const projectOk = uuidParam.safeParse(projectId);
    const mOk = uuidParam.safeParse(mId);
    if (!projectOk.success || !mOk.success) {
      return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
    }

    const { error } = await session.supabase
      .from('measurements')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', mOk.data)
      .eq('project_id', projectOk.data)
      .is('deleted_at', null);

    if (error) throw new Error(`Failed to delete measurement: ${error.message}`);
    return NextResponse.json({ success: true, message: 'Measurement deleted' });
  } catch (error) {
    console.error('[DELETE /api/projects/:id/measurements/:mId]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete measurement',
      },
      { status: 500 }
    );
  }
}
