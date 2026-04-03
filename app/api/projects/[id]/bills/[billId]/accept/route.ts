import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  BILL_VERSION_LINE_ITEM_SELECT,
  BILL_VERSION_ROW_SELECT,
} from '@/lib/api/bill-select-columns';
import { requireSessionUser } from '@/lib/api/require-session';
import { acceptBillBodySchema } from '@/lib/api/schemas/bills-api';

interface LineItemOverride {
  boqItemId: string;
  previousQuantity?: number;
  currentQuantity: number;
  cumulativeQuantity?: number;
  rate: number;
  previousAmount?: number;
  currentAmount?: number;
  cumulativeAmount?: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; billId: string }> }
) {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  try {
    const { id: projectId, billId } = await params;
    const pid = z.string().uuid().safeParse(projectId);
    const bid = z.string().uuid().safeParse(billId);
    if (!pid.success || !bid.success) {
      return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const parsed = acceptBillBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const db = session.supabase;

    const { data: bill, error: billError } = await db
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

    const sourceVersionId =
      typeof parsed.data.sourceVersionId === 'string' && parsed.data.sourceVersionId
        ? parsed.data.sourceVersionId
        : null;

    let sourceVersion: { id: string; tax_rate: number | null } | null = null;
    if (sourceVersionId) {
      const { data, error } = await db
        .from('bill_versions')
        .select('id, tax_rate')
        .eq('id', sourceVersionId)
        .eq('ra_bill_id', bid.data)
        .maybeSingle();
      if (error) throw new Error(`Failed to fetch source version: ${error.message}`);
      sourceVersion = data as { id: string; tax_rate: number | null } | null;
    } else {
      const { data, error } = await db
        .from('bill_versions')
        .select('id, tax_rate')
        .eq('ra_bill_id', bid.data)
        .eq('version_type', 'generated')
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`Failed to fetch latest generated version: ${error.message}`);
      sourceVersion = data as { id: string; tax_rate: number | null } | null;
    }

    if (!sourceVersion) {
      return NextResponse.json(
        { success: false, error: 'No generated source version available for acceptance' },
        { status: 400 }
      );
    }

    const overrides = Array.isArray(parsed.data.lineItems)
      ? (parsed.data.lineItems as LineItemOverride[])
      : [];

    const sourceLineItems =
      overrides.length === 0
        ? await (async () => {
            const { data, error } = await db
              .from('bill_version_line_items')
              .select(BILL_VERSION_LINE_ITEM_SELECT)
              .eq('bill_version_id', sourceVersion.id);
            if (error) throw new Error(`Failed to fetch source line items: ${error.message}`);
            return data ?? [];
          })()
        : [];

    const acceptedLineItems =
      overrides.length > 0
        ? overrides.map((item) => {
            const previousQuantity = item.previousQuantity ?? 0;
            const currentQuantity = Number(item.currentQuantity);
            const cumulativeQuantity =
              item.cumulativeQuantity ?? previousQuantity + currentQuantity;
            const rate = Number(item.rate);
            const previousAmount = item.previousAmount ?? previousQuantity * rate;
            const currentAmount = item.currentAmount ?? currentQuantity * rate;
            const cumulativeAmount = item.cumulativeAmount ?? cumulativeQuantity * rate;
            return {
              boq_item_id: item.boqItemId,
              previous_quantity: previousQuantity,
              current_quantity: currentQuantity,
              cumulative_quantity: cumulativeQuantity,
              rate,
              previous_amount: previousAmount,
              current_amount: currentAmount,
              cumulative_amount: cumulativeAmount,
            };
          })
        : sourceLineItems.map((row) => ({
            boq_item_id: (row as { boq_item_id: string }).boq_item_id,
            previous_quantity: Number((row as { previous_quantity: number }).previous_quantity),
            current_quantity: Number((row as { current_quantity: number }).current_quantity),
            cumulative_quantity: Number((row as { cumulative_quantity: number }).cumulative_quantity),
            rate: Number((row as { rate: number }).rate),
            previous_amount: Number((row as { previous_amount: number }).previous_amount),
            current_amount: Number((row as { current_amount: number }).current_amount),
            cumulative_amount: Number((row as { cumulative_amount: number }).cumulative_amount),
          }));

    if (acceptedLineItems.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No line items available to accept' },
        { status: 400 }
      );
    }

    const { data: latestAccepted, error: acceptedReadError } = await db
      .from('bill_versions')
      .select('version_number')
      .eq('ra_bill_id', bid.data)
      .eq('version_type', 'accepted')
      .order('version_number', { ascending: false })
      .limit(1);
    if (acceptedReadError) {
      throw new Error(`Failed to resolve accepted version number: ${acceptedReadError.message}`);
    }
    const nextAcceptedVersion =
      latestAccepted && latestAccepted.length > 0
        ? Number((latestAccepted[0] as { version_number: number }).version_number) + 1
        : 1;

    const subTotal = acceptedLineItems.reduce((sum, item) => sum + Number(item.current_amount), 0);
    const taxRate =
      parsed.data.taxRate != null
        ? Number(parsed.data.taxRate)
        : Number(sourceVersion.tax_rate ?? 18);
    const taxAmount = (subTotal * taxRate) / 100;
    const grandTotal = subTotal + taxAmount;

    const { data: createdVersion, error: createError } = await db
      .from('bill_versions')
      .insert({
        ra_bill_id: bid.data,
        version_type: 'accepted',
        version_number: nextAcceptedVersion,
        source: overrides.length > 0 ? 'manual_adjustment' : 'accepted_from_generated',
        sub_total: subTotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        grand_total: grandTotal,
        notes: parsed.data.notes ?? null,
        created_by: session.userId,
      })
      .select(BILL_VERSION_ROW_SELECT)
      .single();
    if (createError) throw new Error(`Failed to create accepted version: ${createError.message}`);

    const billVersionId = (createdVersion as { id: string }).id;
    const { error: lineError } = await db.from('bill_version_line_items').insert(
      acceptedLineItems.map((item) => ({
        bill_version_id: billVersionId,
        ...item,
      }))
    );
    if (lineError) throw new Error(`Failed to create accepted line items: ${lineError.message}`);

    return NextResponse.json(
      {
        success: true,
        data: { version: createdVersion, lineItemCount: acceptedLineItems.length },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/projects/:id/bills/:billId/accept]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to accept bill',
      },
      { status: 500 }
    );
  }
}
