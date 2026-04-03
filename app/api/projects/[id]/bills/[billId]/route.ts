import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  BILL_VERSION_ROW_SELECT,
  MEASUREMENT_LINKED_SELECT,
  RA_BILL_ROW_SELECT,
} from '@/lib/api/bill-select-columns';
import { requireSessionUser } from '@/lib/api/require-session';

type Params = { id: string; billId: string };

const uuidParam = z.string().uuid();

/**
 * GET /api/projects/:id/bills/:billId
 * Returns bill with latest generated+accepted versions and linked measurements.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  try {
    const { id: projectId, billId } = await params;
    const pid = uuidParam.safeParse(projectId);
    const bid = uuidParam.safeParse(billId);
    if (!pid.success || !bid.success) {
      return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
    }

    const { data: bill, error: billError } = await session.supabase
      .from('ra_bills')
      .select(RA_BILL_ROW_SELECT)
      .eq('id', bid.data)
      .eq('project_id', pid.data)
      .is('deleted_at', null)
      .maybeSingle();
    if (billError) throw new Error(`Failed to fetch bill: ${billError.message}`);
    if (!bill) {
      return NextResponse.json(
        { success: false, error: 'RA bill not found' },
        { status: 404 }
      );
    }

    const { data: versions, error: versionError } = await session.supabase
      .from('bill_versions')
      .select(BILL_VERSION_ROW_SELECT)
      .eq('ra_bill_id', bid.data)
      .order('version_number', { ascending: false });
    if (versionError) throw new Error(`Failed to fetch bill versions: ${versionError.message}`);

    const latestGenerated =
      versions?.find((v) => (v as { version_type: string }).version_type === 'generated') ??
      null;
    const latestAccepted =
      versions?.find((v) => (v as { version_type: string }).version_type === 'accepted') ?? null;

    const { data: linkedMeasurements, error: linkedError } = await session.supabase
      .from('bill_measurements')
      .select(`measurement_id, measurements (${MEASUREMENT_LINKED_SELECT})`)
      .eq('ra_bill_id', bid.data);
    if (linkedError) throw new Error(`Failed to fetch linked measurements: ${linkedError.message}`);

    return NextResponse.json({
      success: true,
      data: {
        bill,
        latestGeneratedVersion: latestGenerated,
        latestAcceptedVersion: latestAccepted,
        linkedMeasurements: linkedMeasurements ?? [],
      },
    });
  } catch (error) {
    console.error('[GET /api/projects/:id/bills/:billId]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch bill',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/:id/bills/:billId
 * Soft-delete an RA bill.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  try {
    const { id: projectId, billId } = await params;
    const pid = uuidParam.safeParse(projectId);
    const bid = uuidParam.safeParse(billId);
    if (!pid.success || !bid.success) {
      return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
    }

    const { data: existing, error: existingError } = await session.supabase
      .from('ra_bills')
      .select('id')
      .eq('id', bid.data)
      .eq('project_id', pid.data)
      .is('deleted_at', null)
      .maybeSingle();
    if (existingError) throw new Error(`Failed to verify bill: ${existingError.message}`);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'RA bill not found' },
        { status: 404 }
      );
    }

    const { error } = await session.supabase
      .from('ra_bills')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', bid.data)
      .eq('project_id', pid.data)
      .is('deleted_at', null);
    if (error) throw new Error(`Failed to delete bill: ${error.message}`);

    return NextResponse.json({ success: true, message: 'Bill deleted' });
  } catch (error) {
    console.error('[DELETE /api/projects/:id/bills/:billId]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete bill',
      },
      { status: 500 }
    );
  }
}
