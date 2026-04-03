import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

import { RA_BILL_ROW_SELECT } from '@/lib/api/bill-select-columns';
import { requireSessionUser } from '@/lib/api/require-session';
import { generateBillBodySchema } from '@/lib/api/schemas/bills-api';
import { BOQRepository } from '@/lib/boq-management/repositories/BOQRepository';

const projectIdParamSchema = z.string().uuid();

type VersionType = 'generated' | 'accepted';

interface VersionRow {
  id: string;
  ra_bill_id: string;
  version_type: VersionType;
  version_number: number;
}

interface LineItemRow {
  boq_item_id: string;
  current_quantity: number;
}

const MEASUREMENT_FOR_GENERATE_SELECT = 'id, boq_item_id, quantity, is_deduction';
const BILL_VERSION_INSERT_RETURN =
  'id, ra_bill_id, version_type, version_number, source, sub_total, tax_rate, tax_amount, grand_total, excel_url, notes, created_by, created_at';

async function getPreviousQuantitiesByBoqItem(
  db: SupabaseClient,
  projectId: string,
  currentSequence: number,
  boqItemIds: string[]
): Promise<Map<string, number>> {
  if (boqItemIds.length === 0) return new Map();

  const { data: previousBills, error: billsError } = await db
    .from('ra_bills')
    .select('id')
    .eq('project_id', projectId)
    .lt('bill_sequence', currentSequence)
    .is('deleted_at', null);
  if (billsError) throw new Error(`Failed to fetch previous bills: ${billsError.message}`);
  if (!previousBills || previousBills.length === 0) return new Map();

  const previousBillIds = previousBills.map((b) => (b as { id: string }).id);
  const { data: versions, error: versionError } = await db
    .from('bill_versions')
    .select('id, ra_bill_id, version_type, version_number')
    .in('ra_bill_id', previousBillIds);
  if (versionError) throw new Error(`Failed to fetch bill versions: ${versionError.message}`);

  const selectedVersionIds = new Set<string>();
  const grouped = new Map<string, VersionRow[]>();
  for (const row of versions ?? []) {
    const r = row as VersionRow;
    if (!grouped.has(r.ra_bill_id)) grouped.set(r.ra_bill_id, []);
    grouped.get(r.ra_bill_id)?.push(r);
  }
  for (const rows of grouped.values()) {
    const accepted = rows
      .filter((r) => r.version_type === 'accepted')
      .sort((a, b) => b.version_number - a.version_number)[0];
    if (accepted) {
      selectedVersionIds.add(accepted.id);
      continue;
    }
    const generated = rows
      .filter((r) => r.version_type === 'generated')
      .sort((a, b) => b.version_number - a.version_number)[0];
    if (generated) selectedVersionIds.add(generated.id);
  }
  if (selectedVersionIds.size === 0) return new Map();

  const { data: lineItems, error: lineItemError } = await db
    .from('bill_version_line_items')
    .select('boq_item_id, current_quantity')
    .in('bill_version_id', Array.from(selectedVersionIds))
    .in('boq_item_id', boqItemIds);
  if (lineItemError) throw new Error(`Failed to fetch previous line items: ${lineItemError.message}`);

  const result = new Map<string, number>();
  for (const row of lineItems ?? []) {
    const r = row as LineItemRow;
    result.set(r.boq_item_id, (result.get(r.boq_item_id) ?? 0) + Number(r.current_quantity));
  }
  return result;
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
      return NextResponse.json(
        { success: false, error: 'Invalid project id' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = generateBillBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const measurementIds = parsed.data.measurementIds;
    const db = session.supabase;

    const boqRepo = new BOQRepository(db);
    const activeVersion = await boqRepo.findActiveVersion(idParsed.data);
    if (!activeVersion) {
      return NextResponse.json(
        { success: false, error: 'Active BOQ version not found for project' },
        { status: 400 }
      );
    }

    const { data: measurements, error: measurementError } = await db
      .from('measurements')
      .select(MEASUREMENT_FOR_GENERATE_SELECT)
      .eq('project_id', idParsed.data)
      .in('id', measurementIds)
      .is('deleted_at', null);
    if (measurementError) throw new Error(`Failed to fetch measurements: ${measurementError.message}`);
    if ((measurements?.length ?? 0) !== measurementIds.length) {
      return NextResponse.json(
        { success: false, error: 'Some measurements were not found for this project' },
        { status: 400 }
      );
    }

    // Intentionally omits the `deleted_at IS NULL` filter so that soft-deleted
    // bills still contribute to the max sequence. This prevents the next bill
    // from reusing a number that was already assigned (and would hit the
    // uq_ra_bill_number / uq_ra_bill_sequence DB constraints).
    const { data: seqData, error: seqError } = await db
      .from('ra_bills')
      .select('bill_sequence')
      .eq('project_id', idParsed.data)
      .order('bill_sequence', { ascending: false })
      .limit(1);
    if (seqError) throw new Error(`Failed to resolve bill sequence: ${seqError.message}`);
    const nextSequence =
      seqData && seqData.length > 0
        ? Number((seqData[0] as { bill_sequence: number }).bill_sequence) + 1
        : 1;

    const billNumber =
      typeof parsed.data.billNumber === 'string' && parsed.data.billNumber.trim().length > 0
        ? parsed.data.billNumber.trim()
        : `RA-${String(nextSequence).padStart(2, '0')}`;

    const { data: createdBill, error: billError } = await db
      .from('ra_bills')
      .insert({
        project_id: idParsed.data,
        bill_number: billNumber,
        bill_sequence: nextSequence,
        boq_version_id: activeVersion.id,
        created_by: session.userId,
      })
      .select(RA_BILL_ROW_SELECT)
      .single();
    if (billError) throw new Error(`Failed to create bill: ${billError.message}`);

    const billId = (createdBill as { id: string }).id;
    const measurementLinks = (measurements ?? []).map((m) => ({
      ra_bill_id: billId,
      measurement_id: (m as { id: string }).id,
    }));
    const { error: linkError } = await db.from('bill_measurements').insert(measurementLinks);
    if (linkError) throw new Error(`Failed to link bill measurements: ${linkError.message}`);

    const currentByBoq = new Map<string, number>();
    for (const row of measurements ?? []) {
      const m = row as { boq_item_id: string; quantity: number; is_deduction: boolean };
      const signedQty = m.is_deduction ? -Number(m.quantity) : Number(m.quantity);
      currentByBoq.set(m.boq_item_id, (currentByBoq.get(m.boq_item_id) ?? 0) + signedQty);
    }

    const boqItemIds = Array.from(currentByBoq.keys());
    const { data: boqItems, error: boqItemError } = await db
      .from('boq_items')
      .select('id, rate')
      .eq('boq_version_id', activeVersion.id)
      .in('id', boqItemIds);
    if (boqItemError) throw new Error(`Failed to fetch BOQ items: ${boqItemError.message}`);
    const rateByBoq = new Map<string, number>();
    for (const row of boqItems ?? []) {
      const r = row as { id: string; rate: number };
      rateByBoq.set(r.id, Number(r.rate));
    }

    const previousByBoq = await getPreviousQuantitiesByBoqItem(
      db,
      idParsed.data,
      nextSequence,
      boqItemIds
    );
    const lineItems = boqItemIds.map((boqItemId) => {
      const previousQty = previousByBoq.get(boqItemId) ?? 0;
      const currentQty = currentByBoq.get(boqItemId) ?? 0;
      const cumulativeQty = previousQty + currentQty;
      const rate = rateByBoq.get(boqItemId) ?? 0;

      return {
        boq_item_id: boqItemId,
        previous_quantity: previousQty,
        current_quantity: currentQty,
        cumulative_quantity: cumulativeQty,
        rate,
        previous_amount: previousQty * rate,
        current_amount: currentQty * rate,
        cumulative_amount: cumulativeQty * rate,
      };
    });

    const subTotal = lineItems.reduce((sum, item) => sum + Number(item.current_amount), 0);
    const taxRate = parsed.data.taxRate != null ? Number(parsed.data.taxRate) : 18;
    const taxAmount = (subTotal * taxRate) / 100;
    const grandTotal = subTotal + taxAmount;

    const { data: createdVersion, error: versionError } = await db
      .from('bill_versions')
      .insert({
        ra_bill_id: billId,
        version_type: 'generated',
        version_number: 1,
        source: 'auto_generated',
        sub_total: subTotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        grand_total: grandTotal,
        notes: parsed.data.notes ?? null,
        created_by: session.userId,
      })
      .select(BILL_VERSION_INSERT_RETURN)
      .single();
    if (versionError) throw new Error(`Failed to create generated version: ${versionError.message}`);

    const billVersionId = (createdVersion as { id: string }).id;
    const { error: lineItemInsertError } = await db.from('bill_version_line_items').insert(
      lineItems.map((item) => ({
        bill_version_id: billVersionId,
        ...item,
      }))
    );
    if (lineItemInsertError) {
      throw new Error(`Failed to create version line items: ${lineItemInsertError.message}`);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          bill: createdBill,
          generatedVersion: createdVersion,
          lineItemCount: lineItems.length,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/projects/:id/bills/generate]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate bill',
      },
      { status: 500 }
    );
  }
}
