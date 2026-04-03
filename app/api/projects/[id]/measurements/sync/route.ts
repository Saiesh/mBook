import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireSessionUser } from '@/lib/api/require-session';
import { syncMeasurementsBodySchema } from '@/lib/api/schemas/measurement-api';

const projectIdParamSchema = z.string().uuid();

function calculateQuantity(
  nos?: number,
  length?: number | null,
  breadth?: number | null,
  depth?: number | null
): number {
  return (nos ?? 1) * (length ?? 1) * (breadth ?? 1) * (depth ?? 1);
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
    const parsed = syncMeasurementsBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const payload = parsed.data.measurements;
    if (payload.length === 0) {
      return NextResponse.json(
        { success: false, error: 'measurements array cannot be empty' },
        { status: 400 }
      );
    }

    const idMap: Record<string, string> = {};
    let duplicates = 0;
    const rowsToInsert: Record<string, unknown>[] = [];
    const candidateClientIds: string[] = [];

    for (const m of payload) {
      candidateClientIds.push(m.clientId);
    }

    if (candidateClientIds.length > 0) {
      const { data: existing, error: existingError } = await session.supabase
        .from('measurements')
        .select('id, client_id')
        .eq('project_id', idParsed.data)
        .in('client_id', candidateClientIds)
        .is('deleted_at', null);

      if (existingError) {
        throw new Error(`Failed to check duplicates: ${existingError.message}`);
      }

      for (const row of existing ?? []) {
        const r = row as { id: string; client_id: string };
        idMap[r.client_id] = r.id;
      }
    }

    for (const m of payload) {
      if (idMap[m.clientId]) {
        duplicates += 1;
        continue;
      }

      const nos = m.nos != null ? Number(m.nos) : 1;
      const length = m.length != null ? Number(m.length) : null;
      const breadth = m.breadth != null ? Number(m.breadth) : null;
      const depth = m.depth != null ? Number(m.depth) : null;

      rowsToInsert.push({
        project_id: idParsed.data,
        boq_item_id: m.boqItemId,
        area_name: m.areaName,
        nos,
        length,
        breadth,
        depth,
        quantity: calculateQuantity(nos, length, breadth, depth),
        unit: m.unit,
        measurement_date: m.measurementDate ?? new Date().toISOString().slice(0, 10),
        remarks: m.remarks ?? null,
        is_deduction: m.isDeduction ?? false,
        created_by: session.userId,
        client_id: m.clientId,
        // Why: synced rows should carry a server timestamp to support idempotent retry logic.
        synced_at: new Date().toISOString(),
      });
    }

    let synced = 0;
    if (rowsToInsert.length > 0) {
      const { data: created, error: createError } = await session.supabase
        .from('measurements')
        .insert(rowsToInsert)
        .select('id, client_id');
      if (createError) throw new Error(`Failed to sync measurements: ${createError.message}`);
      synced = created?.length ?? 0;
      for (const row of created ?? []) {
        const r = row as { id: string; client_id: string };
        idMap[r.client_id] = r.id;
      }
    }

    return NextResponse.json({
      success: true,
      data: { synced, duplicates, idMap },
    });
  } catch (error) {
    console.error('[POST /api/projects/:id/measurements/sync]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync measurements',
      },
      { status: 500 }
    );
  }
}
