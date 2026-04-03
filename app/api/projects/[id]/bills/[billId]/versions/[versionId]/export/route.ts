import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireSessionUser } from '@/lib/api/require-session';
import { BillGenerationService } from '@/lib/bill-generation';

type Params = { id: string; billId: string; versionId: string };

const uuidParam = z.string().uuid();

/**
 * POST .../export
 * Generates an Excel workbook for a specific bill version.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<Params> }
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

    const service = new BillGenerationService(session.supabase);
    const exportResult = await service.generateFromVersion({
      projectId: pid.data,
      billId: bid.data,
      versionId: vid.data,
    });

    // Why: storing the latest export filename on the version improves auditability.
    const { error: updateError } = await session.supabase
      .from('bill_versions')
      .update({ excel_url: exportResult.fileName })
      .eq('id', vid.data)
      .eq('ra_bill_id', bid.data);
    if (updateError) {
      throw new Error(`Failed to persist export metadata: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        fileName: exportResult.fileName,
        mimeType: exportResult.mimeType,
        bytes: exportResult.buffer.length,
        downloadUrl: `/api/projects/${pid.data}/bills/${bid.data}/versions/${vid.data}/download`,
      },
    });
  } catch (error) {
    console.error('[POST .../export]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export bill version',
      },
      { status: 500 }
    );
  }
}
