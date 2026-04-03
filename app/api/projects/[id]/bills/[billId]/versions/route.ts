import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { BILL_VERSION_ROW_SELECT } from '@/lib/api/bill-select-columns';
import { requireSessionUser } from '@/lib/api/require-session';

const uuidParam = z.string().uuid();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; billId: string }> }
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
      .select('id')
      .eq('id', bid.data)
      .eq('project_id', pid.data)
      .is('deleted_at', null)
      .maybeSingle();
    if (billError) throw new Error(`Failed to verify bill: ${billError.message}`);
    if (!bill) {
      return NextResponse.json(
        { success: false, error: 'RA bill not found' },
        { status: 404 }
      );
    }

    const { data, error } = await session.supabase
      .from('bill_versions')
      .select(BILL_VERSION_ROW_SELECT)
      .eq('ra_bill_id', bid.data)
      .order('version_type', { ascending: true })
      .order('version_number', { ascending: false });
    if (error) throw new Error(`Failed to fetch bill versions: ${error.message}`);

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (error) {
    console.error('[GET /api/projects/:id/bills/:billId/versions]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch bill versions',
      },
      { status: 500 }
    );
  }
}
