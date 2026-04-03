import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireSessionUser } from '@/lib/api/require-session';
import { BOQRepository } from '@/lib/boq-management/repositories/BOQRepository';
import type { BOQVersionDetail, BOQSectionWithItems } from '@/lib/boq-management/types';

const uuidParam = z.string().uuid();

/**
 * GET /api/projects/:id/boq/:versionId
 * Return a single BOQ version with all its sections and items nested.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  try {
    const { id: projectId, versionId } = await params;
    const pid = uuidParam.safeParse(projectId);
    const vid = uuidParam.safeParse(versionId);
    if (!pid.success || !vid.success) {
      return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
    }

    const boqRepo = new BOQRepository(session.supabase);
    const version = await boqRepo.findVersionById(vid.data);
    if (!version) {
      return NextResponse.json(
        { success: false, error: 'BOQ version not found' },
        { status: 404 }
      );
    }

    if (version.projectId !== pid.data) {
      return NextResponse.json(
        { success: false, error: 'BOQ version not found' },
        { status: 404 }
      );
    }

    const sections = await boqRepo.findSectionsByVersionId(vid.data);
    const items = await boqRepo.findItemsByVersionId(vid.data);

    const itemsBySectionId = new Map<string | null, typeof items>();
    for (const item of items) {
      const key = item.boqSectionId;
      if (!itemsBySectionId.has(key)) itemsBySectionId.set(key, []);
      itemsBySectionId.get(key)!.push(item);
    }

    const sectionsWithItems: BOQSectionWithItems[] = sections.map((s) => ({
      ...s,
      items: itemsBySectionId.get(s.id) ?? [],
    }));

    const unsectioned = itemsBySectionId.get(null) ?? [];
    if (unsectioned.length > 0) {
      sectionsWithItems.push({
        id: 'unsectioned',
        boqVersionId: version.id,
        sectionNumber: 0,
        name: 'Unsectioned Items',
        sortOrder: -1,
        createdAt: version.createdAt,
        items: unsectioned,
      });
    }

    const detail: BOQVersionDetail = {
      ...version,
      sections: sectionsWithItems,
    };

    return NextResponse.json({ success: true, data: detail });
  } catch (error) {
    console.error('[GET /api/projects/:id/boq/:versionId]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch BOQ version',
      },
      { status: 500 }
    );
  }
}
