import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { z } from 'zod';

import { BILL_VERSION_ROW_SELECT } from '@/lib/api/bill-select-columns';
import { requireSessionUser } from '@/lib/api/require-session';

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = String(value).replace(/,/g, '').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

interface ParsedLineItem {
  boqItemId: string;
  previousQuantity: number;
  currentQuantity: number;
  cumulativeQuantity: number;
  rate: number;
  previousAmount: number;
  currentAmount: number;
  cumulativeAmount: number;
}

export function aggregateByBoqItem(items: ParsedLineItem[]): ParsedLineItem[] {
  const aggregated = new Map<string, ParsedLineItem>();

  for (const item of items) {
    const existing = aggregated.get(item.boqItemId);
    if (!existing) {
      aggregated.set(item.boqItemId, { ...item });
      continue;
    }

    // Why: multiple Abstract rows can point to the same BOQ item, but the table
    // enforces one row per boq_item_id in a version, so we must merge deterministically.
    existing.previousQuantity += item.previousQuantity;
    existing.currentQuantity += item.currentQuantity;
    existing.cumulativeQuantity += item.cumulativeQuantity;
    existing.previousAmount += item.previousAmount;
    existing.currentAmount += item.currentAmount;
    existing.cumulativeAmount += item.cumulativeAmount;
  }

  return Array.from(aggregated.values());
}

type GeneratedVersionInsertInput = {
  billId: string;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  subTotal: number;
  notes: string | null;
  excelUrl: string;
  createdBy: string;
};

type InsertVersionAndLineItemsInput = {
  versionInput: GeneratedVersionInsertInput;
  lineItems: ParsedLineItem[];
};

/**
 * Why: `SupabaseClient['rpc']` is typed to return a Postgrest builder chain; `await db.rpc(...)`
 * at runtime yields `{ data, error }`. This explicit shape matches that and is easy to fake in tests.
 */
export type BillUploadAtomicRpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export async function insertVersionAndLineItemsAtomic(
  db: BillUploadAtomicRpcClient,
  input: InsertVersionAndLineItemsInput
): Promise<{ version: unknown; lineItemCount: number }> {
  const { versionInput, lineItems } = input;
  const { data: createdVersion, error: rpcError } = await db.rpc(
    'create_generated_bill_version_atomic',
    {
      p_bill_id: versionInput.billId,
      p_tax_rate: versionInput.taxRate,
      p_tax_amount: versionInput.taxAmount,
      p_grand_total: versionInput.grandTotal,
      p_sub_total: versionInput.subTotal,
      p_notes: versionInput.notes,
      // Why: keep source file metadata attached to generated upload versions.
      p_excel_url: versionInput.excelUrl,
      p_created_by: versionInput.createdBy,
      p_line_items: lineItems.map((item) => ({
        boq_item_id: item.boqItemId,
        previous_quantity: item.previousQuantity,
        current_quantity: item.currentQuantity,
        cumulative_quantity: item.cumulativeQuantity,
        rate: item.rate,
        previous_amount: item.previousAmount,
        current_amount: item.currentAmount,
        cumulative_amount: item.cumulativeAmount,
      })),
    }
  );
  if (rpcError) {
    throw new Error(`Failed to create generated bill version: ${rpcError.message}`);
  }

  return {
    version: createdVersion,
    lineItemCount: lineItems.length,
  };
}

// Why: map low-level DB constraint failures to user-fixable validation responses.
export function mapBillUploadError(error: unknown): { status: number; message: string } | null {
  const message = error instanceof Error ? error.message : String(error ?? '');

  if (
    message.includes('uq_bill_version_item') ||
    (message.includes('duplicate key value') && message.includes('bill_version_line_items'))
  ) {
    return {
      status: 400,
      message:
        'Uploaded Abstract has duplicate rows for the same BOQ item. Please keep a single row per BOQ item (or pre-aggregate duplicates) and upload again.',
    };
  }

  return null;
}

const uuidParam = z.string().uuid();

export async function POST(
  request: NextRequest,
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
      .select('id, boq_version_id')
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

    const billRow = bill as { id: string; boq_version_id: string | null };
    if (!billRow.boq_version_id) {
      return NextResponse.json(
        { success: false, error: 'Bill has no linked BOQ version' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'file is required (multipart/form-data)' },
        { status: 400 }
      );
    }

    // Why: keep bytes as Uint8Array from the uploaded file for stable runtime behavior.
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    // Why: use exceljs' own parameter type to sidestep Buffer type mismatches across libs.
    await workbook.xlsx.load(
      fileBytes as unknown as Parameters<typeof workbook.xlsx.load>[0]
    );

    // Why: user files are not guaranteed to preserve exact casing/spelling.
    const abstractSheet =
      workbook.getWorksheet('Abstract') ??
      workbook.worksheets.find((ws) => ws.name.toLowerCase().includes('abstract'));

    if (!abstractSheet) {
      return NextResponse.json(
        { success: false, error: 'Abstract sheet not found in uploaded file' },
        { status: 400 }
      );
    }

    const { data: boqItems, error: boqError } = await session.supabase
      .from('boq_items')
      .select('id, item_number, sap_code, rate')
      .eq('boq_version_id', billRow.boq_version_id);
    if (boqError) throw new Error(`Failed to fetch BOQ items: ${boqError.message}`);

    const bySapCode = new Map<string, { id: string; rate: number }>();
    const byItemNumber = new Map<number, { id: string; rate: number }>();
    for (const row of boqItems ?? []) {
      const r = row as { id: string; item_number: number; sap_code: string | null; rate: number };
      if (r.sap_code) bySapCode.set(r.sap_code.trim().toUpperCase(), { id: r.id, rate: Number(r.rate) });
      byItemNumber.set(Number(r.item_number), { id: r.id, rate: Number(r.rate) });
    }

    const parsed: ParsedLineItem[] = [];
    abstractSheet.eachRow((row, rowNumber) => {
      if (rowNumber < 2) return;

      const itemNumber = toNumber(row.getCell(1).value);
      const sapCodeRaw = row.getCell(3).value;
      const sapCode = sapCodeRaw != null ? String(sapCodeRaw).trim().toUpperCase() : '';
      const previousQuantity = toNumber(row.getCell(8).value) ?? 0;
      const currentQuantity = toNumber(row.getCell(9).value) ?? 0;
      const cumulativeQuantity = toNumber(row.getCell(10).value) ?? previousQuantity + currentQuantity;
      const previousAmount = toNumber(row.getCell(11).value) ?? 0;
      const currentAmount = toNumber(row.getCell(12).value) ?? 0;
      const cumulativeAmount = toNumber(row.getCell(13).value) ?? previousAmount + currentAmount;

      const mapped =
        (sapCode ? bySapCode.get(sapCode) : undefined) ??
        (itemNumber != null ? byItemNumber.get(itemNumber) : undefined);

      if (!mapped) return;
      if (previousQuantity === 0 && currentQuantity === 0 && cumulativeQuantity === 0) return;

      parsed.push({
        boqItemId: mapped.id,
        previousQuantity,
        currentQuantity,
        cumulativeQuantity,
        rate: mapped.rate,
        previousAmount,
        currentAmount,
        cumulativeAmount,
      });
    });

    if (parsed.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid Abstract rows matched BOQ items' },
        { status: 400 }
      );
    }

    const aggregatedParsed = aggregateByBoqItem(parsed);

    const subTotal = aggregatedParsed.reduce((sum, item) => sum + item.currentAmount, 0);
    const taxRate = toNumber(formData.get('taxRate')) ?? 18;
    const taxAmount = (subTotal * taxRate) / 100;
    const grandTotal = subTotal + taxAmount;
    const notes = formData.get('notes')?.toString() ?? null;

    // Why: versionType is passed by the UI based on the active tab so that uploading
    // while the "Accepted Version" tab is active creates an accepted version, not a
    // generated one. Defaults to 'generated' for backwards compatibility.
    const versionTypeRaw = formData.get('versionType')?.toString();
    const versionType: 'generated' | 'accepted' =
      versionTypeRaw === 'accepted' ? 'accepted' : 'generated';

    const db = session.supabase;
    let persisted: { version: unknown; lineItemCount: number };

    if (versionType === 'accepted') {
      // Why: accepted versions have their own incrementing sequence separate from
      // generated ones so both tracks stay independently auditable.
      const { data: latestAccepted, error: latestError } = await db
        .from('bill_versions')
        .select('version_number')
        .eq('ra_bill_id', bid.data)
        .eq('version_type', 'accepted')
        .order('version_number', { ascending: false })
        .limit(1);
      if (latestError) {
        throw new Error(`Failed to resolve accepted version number: ${latestError.message}`);
      }

      const latestRows = (latestAccepted ?? []) as Array<{ version_number: number }>;
      const nextAcceptedVersion =
        latestRows.length > 0 ? Number(latestRows[0].version_number) + 1 : 1;

      const { data: createdVersion, error: createError } = await db
        .from('bill_versions')
        .insert({
          ra_bill_id: bid.data,
          version_type: 'accepted',
          version_number: nextAcceptedVersion,
          // Why: 'excel_upload' distinguishes direct accepted uploads from
          // `accepted_from_generated` and `manual_adjustment` in the audit trail.
          source: 'excel_upload',
          sub_total: subTotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          grand_total: grandTotal,
          notes,
          excel_url: file.name,
          created_by: session.userId,
        })
        .select(BILL_VERSION_ROW_SELECT)
        .single();
      if (createError) {
        throw new Error(`Failed to create accepted bill version: ${createError.message}`);
      }

      const acceptedVersionId = (createdVersion as { id: string }).id;
      const { error: lineError } = await db.from('bill_version_line_items').insert(
        aggregatedParsed.map((item) => ({
          bill_version_id: acceptedVersionId,
          boq_item_id: item.boqItemId,
          previous_quantity: item.previousQuantity,
          current_quantity: item.currentQuantity,
          cumulative_quantity: item.cumulativeQuantity,
          rate: item.rate,
          previous_amount: item.previousAmount,
          current_amount: item.currentAmount,
          cumulative_amount: item.cumulativeAmount,
        }))
      );
      if (lineError) {
        throw new Error(`Failed to create accepted line items: ${lineError.message}`);
      }

      persisted = { version: createdVersion, lineItemCount: aggregatedParsed.length };
    } else {
      // Why: service-role client's `rpc` is typed as a fluent builder; runtime awaits to `{ data, error }`.
      persisted = await insertVersionAndLineItemsAtomic(
        db as unknown as BillUploadAtomicRpcClient,
        {
          versionInput: {
            billId: bid.data,
            taxRate,
            taxAmount,
            grandTotal,
            subTotal,
            notes,
            excelUrl: file.name,
            createdBy: session.userId,
          },
          lineItems: aggregatedParsed,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          version: persisted.version,
          lineItemCount: persisted.lineItemCount,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const mapped = mapBillUploadError(error);
    // Why: users need actionable input guidance when known uniqueness constraints are hit.
    if (mapped) {
      return NextResponse.json(
        {
          success: false,
          error: mapped.message,
        },
        { status: mapped.status }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload bill Excel',
      },
      { status: 500 }
    );
  }
}
