/**
 * BOQImportService — parses a standard BOQ Excel file and persists it as an
 * immutable BOQ version.
 *
 * Expected Excel layout (first sheet named "Abstract" or first sheet):
 *   Row 1   : Project name header
 *   Row 2   : "ABSTRACT" merged header
 *   Row 3-4 : Column headers — Sr.No | Description | SAP CODE | Unit | BOQ Qty | Rate | Amount
 *   Row 5+  : Data rows
 *     • Section header  → C1 has a number, C2 has the name, C3 (SAP CODE) is empty
 *     • Item row        → C1 (Sr.No), C2 (Description), C3 (SAP CODE), C4 (Unit),
 *                          C5 (BOQ Qty), C6 (Rate), C7 (Amount)
 *     • Total row       → C2 contains "Total Amount"
 *
 * Uses exceljs for parsing.
 */

import ExcelJS from 'exceljs';
import type { IBOQRepository } from '../repositories/IBOQRepository';
import type {
  AtomicBOQItemImportDTO,
  AtomicBOQSectionImportDTO,
  BOQImportResult,
} from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collapse richText objects and formula results into plain values. */
function cellValue(cell: ExcelJS.Cell): string | number | null {
  const raw = cell.value;
  if (raw == null) return null;

  if (typeof raw === 'object') {
    // ExcelJS richText: { richText: [{ text }] }
    if ('richText' in raw && Array.isArray((raw as ExcelJS.CellRichTextValue).richText)) {
      return (raw as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join('');
    }
    // Formula or shared formula: use the cached result
    if ('result' in raw) {
      return (raw as ExcelJS.CellFormulaValue).result as string | number | null;
    }
  }

  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number') return raw;

  return String(raw);
}

function toNumber(v: string | number | null): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function toTrimmedString(v: string | number | null): string {
  if (v == null) return '';
  return String(v).trim();
}

/** True when the row is a section header — has a serial number but no SAP code. */
function isSectionRow(
  srNo: string | number | null,
  sapCode: string | number | null,
  unit: string | number | null,
): boolean {
  return srNo != null && String(srNo).trim() !== '' && !sapCode && !unit;
}

/** True when the row is the "Total Amount" footer. */
function isTotalRow(description: string | number | null): boolean {
  return toTrimmedString(description).toLowerCase().includes('total amount');
}

function normalizeItemsByNumber(items: AtomicBOQItemImportDTO[]): AtomicBOQItemImportDTO[] {
  const bySectionAndItemNumber = new Map<string, AtomicBOQItemImportDTO>();

  for (const item of items) {
    const sectionKey = item.sectionSortOrder == null ? 'unsectioned' : String(item.sectionSortOrder);
    const dedupeKey = `${sectionKey}:${item.itemNumber}`;
    const existing = bySectionAndItemNumber.get(dedupeKey);
    if (!existing) {
      bySectionAndItemNumber.set(dedupeKey, { ...item });
      continue;
    }

    // Why: real BOQs often restart item numbering per section, so dedupe must be
    // scoped to section+item number to avoid collapsing valid rows across sections.
    existing.quantity += item.quantity;
    existing.amount += item.amount;
    existing.sortOrder = Math.min(existing.sortOrder, item.sortOrder);
    if (existing.sectionSortOrder == null) existing.sectionSortOrder = item.sectionSortOrder;
    if (!existing.sapCode && item.sapCode) existing.sapCode = item.sapCode;
    if (!existing.unit && item.unit) existing.unit = item.unit;
  }

  return [...bySectionAndItemNumber.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item, idx) => ({
      ...item,
      sortOrder: idx,
      // Why: keep rate consistent after quantity/amount aggregation.
      rate: item.quantity > 0 ? item.amount / item.quantity : item.rate,
    }));
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class BOQImportService {
  constructor(private readonly repo: IBOQRepository) {}

  /**
   * Import an Excel file buffer as a new BOQ version for the given project.
   *
   * Steps:
   *  1. Parse rows and collect sections/items in memory
   *  2. Normalize duplicate item numbers
   *  3. Persist everything through one atomic repository call
   */
  async importFromBuffer(
    buffer: Buffer,
    projectId: string,
    fileName: string,
    uploadedBy?: string,
  ): Promise<BOQImportResult> {
    const workbook = new ExcelJS.Workbook();
    // Cast required because Node 22's Buffer generic differs from exceljs's expected type
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    // Try the "Abstract" sheet first; fall back to the first sheet
    const worksheet = workbook.getWorksheet('Abstract ')
      ?? workbook.getWorksheet('Abstract')
      ?? workbook.worksheets[0];

    if (!worksheet) {
      throw new Error('No worksheet found in the uploaded file');
    }

    let currentSectionSortOrder: number | undefined;
    let sectionSortOrder = 0;
    let globalItemSort = 0;
    const sections: AtomicBOQSectionImportDTO[] = [];
    const parsedItems: AtomicBOQItemImportDTO[] = [];

    // Data rows start after the header block (rows 1-4)
    const DATA_START_ROW = 5;

    for (let rowIdx = DATA_START_ROW; rowIdx <= worksheet.rowCount; rowIdx++) {
      const row = worksheet.getRow(rowIdx);

      const srNo = cellValue(row.getCell(1));
      const description = cellValue(row.getCell(2));
      const sapCode = cellValue(row.getCell(3));
      const unit = cellValue(row.getCell(4));
      const qty = cellValue(row.getCell(5));
      const rate = cellValue(row.getCell(6));
      const amount = cellValue(row.getCell(7));

      // Skip fully empty rows
      if (!srNo && !description) continue;

      // Why: footer totals are ignored because persisted totals must come from
      // normalized line items, not from a potentially stale spreadsheet formula.
      if (isTotalRow(description)) continue;

      // Section header detection: has serial number but no SAP code / unit
      if (isSectionRow(srNo, sapCode, unit)) {
        sections.push({
          sectionNumber: toNumber(srNo),
          name: toTrimmedString(description),
          sortOrder: sectionSortOrder,
        });
        currentSectionSortOrder = sectionSortOrder;
        sectionSortOrder++;
        continue;
      }

      // Regular item row — must have at least a description
      const descStr = toTrimmedString(description);
      if (!descStr) continue;

      parsedItems.push({
        sectionSortOrder: currentSectionSortOrder,
        itemNumber: toNumber(srNo),
        description: descStr,
        sapCode: toTrimmedString(sapCode) || undefined,
        unit: toTrimmedString(unit) || undefined,
        quantity: toNumber(qty),
        rate: toNumber(rate),
        amount: toNumber(amount),
        sortOrder: globalItemSort++,
      });
    }

    const normalizedItems = normalizeItemsByNumber(parsedItems);
    const totalAmount = normalizedItems.reduce((sum, item) => sum + item.amount, 0);

    // Why: repository method runs a DB transaction/RPC so version + sections +
    // items are committed together (or rolled back together on any error).
    const version = await this.repo.importBOQVersionAtomic({
      projectId,
      fileName,
      uploadedBy,
      totalAmount,
      sections,
      items: normalizedItems,
    });

    return {
      version,
      sectionsImported: sections.length,
      itemsImported: normalizedItems.length,
      totalAmount,
    };
  }
}
