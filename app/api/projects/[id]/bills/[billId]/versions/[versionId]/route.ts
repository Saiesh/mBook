import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  BILL_VERSION_LINE_ITEM_SELECT,
  BILL_VERSION_ROW_SELECT,
} from '@/lib/api/bill-select-columns';
import { requireSessionUser } from '@/lib/api/require-session';

const uuidParam = z.string().uuid();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; billId: string; versionId: string }> }
) {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  try {
    const { id: projectId, billId, versionId } = await params;
    const pid = uuidParam.safeParse(projectId);
    const bid = uuidParam.safeParse(billId);
    const vid = uuidParam.safeParse(versionId);
    if (!pid.success || !bid.success || !vid.success) {
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

    const { data: version, error: versionError } = await session.supabase
      .from('bill_versions')
      .select(BILL_VERSION_ROW_SELECT)
      .eq('id', vid.data)
      .eq('ra_bill_id', bid.data)
      .maybeSingle();
    if (versionError) throw new Error(`Failed to fetch bill version: ${versionError.message}`);
    if (!version) {
      return NextResponse.json(
        { success: false, error: 'Bill version not found' },
        { status: 404 }
      );
    }

    const { data: lineItems, error: lineError } = await session.supabase
      .from('bill_version_line_items')
      .select(
        `
          ${BILL_VERSION_LINE_ITEM_SELECT},
          boq_items (
            id,
            item_number,
            description,
            sap_code,
            unit,
            quantity,
            rate,
            amount
          )
        `
      )
      .eq('bill_version_id', vid.data)
      .order('boq_item_id', { ascending: true });
    if (lineError) throw new Error(`Failed to fetch version line items: ${lineError.message}`);

    return NextResponse.json({
      success: true,
      data: {
        version,
        lineItems: lineItems ?? [],
      },
    });
  } catch (error) {
    console.error('[GET .../bills/:billId/versions/:versionId]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch bill version details',
      },
      { status: 500 }
    );
  }
}
