import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  BILL_VERSION_ROW_SELECT,
  RA_BILL_ROW_SELECT,
} from '@/lib/api/bill-select-columns';
import { requireSessionUser } from '@/lib/api/require-session';
import { ProjectRepository } from '@/lib/project-management/repositories/ProjectRepository';

const projectIdParamSchema = z.string().uuid();

/**
 * GET /api/projects/:id/bills
 * List all RA bills with latest generated/accepted version summaries.
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

    const { data: bills, error: billsError } = await session.supabase
      .from('ra_bills')
      .select(RA_BILL_ROW_SELECT)
      .eq('project_id', idParsed.data)
      .is('deleted_at', null)
      .order('bill_sequence', { ascending: true });
    if (billsError) throw new Error(`Failed to fetch bills: ${billsError.message}`);

    const billIds = (bills ?? []).map((b) => (b as { id: string }).id);
    let versionsByBill: Record<string, unknown[]> = {};
    if (billIds.length > 0) {
      const { data: versions, error: versionError } = await session.supabase
        .from('bill_versions')
        .select(BILL_VERSION_ROW_SELECT)
        .in('ra_bill_id', billIds)
        .order('version_number', { ascending: false });
      if (versionError) {
        throw new Error(`Failed to fetch bill versions: ${versionError.message}`);
      }
      versionsByBill = (versions ?? []).reduce<Record<string, unknown[]>>((acc, row) => {
        const key = String((row as { ra_bill_id: string }).ra_bill_id);
        if (!acc[key]) acc[key] = [];
        acc[key].push(row);
        return acc;
      }, {});
    }

    const response = (bills ?? []).map((bill) => {
      const billId = (bill as { id: string }).id;
      const versions = versionsByBill[billId] ?? [];
      const latestGenerated =
        versions.find((v) => (v as { version_type: string }).version_type === 'generated') ??
        null;
      const latestAccepted =
        versions.find((v) => (v as { version_type: string }).version_type === 'accepted') ??
        null;
      return {
        ...bill,
        latestGeneratedVersion: latestGenerated,
        latestAcceptedVersion: latestAccepted,
      };
    });

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error('[GET /api/projects/:id/bills]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch bills',
      },
      { status: 500 }
    );
  }
}
