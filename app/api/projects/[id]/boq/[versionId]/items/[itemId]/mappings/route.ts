import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireSessionUser } from '@/lib/api/require-session';
import { boqAreaMappingBodySchema } from '@/lib/api/schemas/boq-mapping-api';
import { BOQRepository } from '@/lib/boq-management/repositories/BOQRepository';

type Params = { id: string; versionId: string; itemId: string };

const uuidParam = z.string().uuid();

/**
 * GET /api/projects/:id/boq/:versionId/items/:itemId/mappings
 * List all area mappings for a BOQ item.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  try {
    const { itemId } = await params;
    const itemParsed = uuidParam.safeParse(itemId);
    if (!itemParsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid item id' }, { status: 400 });
    }

    const boqRepo = new BOQRepository(session.supabase);
    const mappings = await boqRepo.findMappingsByItemId(itemParsed.data);

    return NextResponse.json({
      success: true,
      data: mappings,
    });
  } catch (error) {
    console.error('[GET .../mappings]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch mappings',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/:id/boq/:versionId/items/:itemId/mappings
 * Map a BOQ item to a project area.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  try {
    const { itemId } = await params;
    const itemParsed = uuidParam.safeParse(itemId);
    if (!itemParsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid item id' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const parsed = boqAreaMappingBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const boqRepo = new BOQRepository(session.supabase);
    const item = await boqRepo.findItemById(itemParsed.data);
    if (!item) {
      return NextResponse.json(
        { success: false, error: 'BOQ item not found' },
        { status: 404 }
      );
    }

    const mapping = await boqRepo.createMapping({
      boqItemId: itemParsed.data,
      areaId: parsed.data.areaId,
    });

    return NextResponse.json({ success: true, data: mapping }, { status: 201 });
  } catch (error) {
    console.error('[POST .../mappings]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create mapping',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/:id/boq/:versionId/items/:itemId/mappings
 * Remove a mapping between a BOQ item and an area.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  try {
    const { itemId } = await params;
    const itemParsed = uuidParam.safeParse(itemId);
    if (!itemParsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid item id' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const parsed = boqAreaMappingBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const boqRepo = new BOQRepository(session.supabase);
    await boqRepo.deleteMapping(itemParsed.data, parsed.data.areaId);

    return NextResponse.json({ success: true, message: 'Mapping removed' });
  } catch (error) {
    console.error('[DELETE .../mappings]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete mapping',
      },
      { status: 500 }
    );
  }
}
