import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireSessionUser } from '@/lib/api/require-session';
import { BillGenerationService } from '@/lib/bill-generation';

type Params = { id: string; billId: string; versionId: string };

const uuidParam = z.string().uuid();

/**
 * GET .../download
 * Returns a freshly generated workbook file for download.
 */
export async function GET(
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
    const encodedFileName = encodeURIComponent(exportResult.fileName);

    return new NextResponse(new Uint8Array(exportResult.buffer), {
      status: 200,
      headers: {
        'Content-Type': exportResult.mimeType,
        // Why: RFC5987 encoding preserves spaces/special chars in download filenames.
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFileName}`,
        'Content-Length': String(exportResult.buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[GET .../download]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to download bill version export',
      },
      { status: 500 }
    );
  }
}
