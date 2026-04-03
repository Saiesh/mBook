import type { SupabaseClient } from '@supabase/supabase-js';
import { ExcelBuilder } from './ExcelBuilder';
import { BillTrackerSheetGenerator } from './sheets/BillTrackerSheetGenerator';
import { SummarySheetGenerator } from './sheets/SummarySheetGenerator';
import { AbstractSheetGenerator } from './sheets/AbstractSheetGenerator';
import { MBookSheetGenerator } from './sheets/MBookSheetGenerator';
import { TemplateSheetGenerator } from './sheets/TemplateSheetGenerator';
import type { BillExportDataset, ExportLineItem, ExportMeasurementRow } from './types';

interface ProjectRow {
  id: string;
  name: string;
  code: string;
  client_name: string | null;
  location_city: string | null;
  location_state: string | null;
}

interface BillRow {
  id: string;
  bill_number: string;
  bill_sequence: number;
  created_at: string;
  boq_version_id: string | null;
}

interface BillVersionRow {
  id: string;
  ra_bill_id: string;
  version_type: 'generated' | 'accepted';
  version_number: number;
  source: string;
  sub_total: number | null;
  tax_rate: number;
  tax_amount: number | null;
  grand_total: number | null;
  created_at: string;
}

interface BOQItemRef {
  item_number: number;
  description: string;
  sap_code: string | null;
  unit: string | null;
  quantity: number;
  rate: number;
  amount: number;
}

interface LineItemRow {
  boq_item_id: string;
  previous_quantity: number;
  current_quantity: number;
  cumulative_quantity: number;
  rate: number;
  previous_amount: number;
  current_amount: number;
  cumulative_amount: number;
  boq_items: BOQItemRef | null;
}

interface MeasurementNestedRow {
  id: string;
  boq_item_id: string;
  area_name: string;
  measurement_date: string;
  nos: number;
  length: number | null;
  breadth: number | null;
  depth: number | null;
  quantity: number;
  unit: string;
  remarks: string | null;
  is_deduction: boolean;
  boq_items: Pick<BOQItemRef, 'item_number' | 'description'> | null;
}

interface BillMeasurementRow {
  measurements: MeasurementNestedRow | null;
}

export interface BillExportResult {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

/**
 * Builds bill-version exports as multi-sheet workbooks.
 * Why: phase 3 shifts exports to bill-version snapshots, not mutable bill rows.
 */
export class BillGenerationService {
  constructor(private readonly db: SupabaseClient) {
    if (!db) throw new Error('BillGenerationService requires a Supabase client');
  }

  async generateFromVersion(input: {
    projectId: string;
    billId: string;
    versionId: string;
  }): Promise<BillExportResult> {
    const dataset = await this.loadDataset(input.projectId, input.billId, input.versionId);
    const builder = new ExcelBuilder();

    new BillTrackerSheetGenerator().generate(builder.addSheet('Bill Tracker'), dataset);
    new SummarySheetGenerator().generate(builder.addSheet('PRAG SUMMURY'), dataset);
    new AbstractSheetGenerator().generate(builder.addSheet('Abstract'), dataset);
    new MBookSheetGenerator().generate(builder.addSheet('M BOOK'), dataset);

    const templateGenerator = new TemplateSheetGenerator();
    templateGenerator.generate(builder.addSheet('NT MEAS'), 'NT MEAS');
    templateGenerator.generate(builder.addSheet('DCS'), 'DCS');
    templateGenerator.generate(builder.addSheet('ISSUE BACKUP'), 'ISSUE BACKUP');

    const buffer = await builder.toBuffer();
    const fileName = this.buildFileName(dataset);

    return {
      fileName,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    };
  }

  private async loadDataset(
    projectId: string,
    billId: string,
    versionId: string,
  ): Promise<BillExportDataset> {
    const { data: project, error: projectError } = await this.db
      .from('projects')
      .select('id, name, code, client_name, location_city, location_state')
      .eq('id', projectId)
      .is('deleted_at', null)
      .maybeSingle();
    if (projectError) throw new Error(`Failed to fetch project: ${projectError.message}`);
    if (!project) throw new Error('Project not found');

    const { data: bill, error: billError } = await this.db
      .from('ra_bills')
      .select('id, bill_number, bill_sequence, created_at, boq_version_id')
      .eq('id', billId)
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .maybeSingle();
    if (billError) throw new Error(`Failed to fetch bill: ${billError.message}`);
    if (!bill) throw new Error('RA bill not found');

    const { data: version, error: versionError } = await this.db
      .from('bill_versions')
      .select(
        'id, ra_bill_id, version_type, version_number, source, sub_total, tax_rate, tax_amount, grand_total, excel_url, notes, created_by, created_at'
      )
      .eq('id', versionId)
      .eq('ra_bill_id', billId)
      .maybeSingle();
    if (versionError) throw new Error(`Failed to fetch bill version: ${versionError.message}`);
    if (!version) throw new Error('Bill version not found');

    const { data: lineItems, error: lineError } = await this.db
      .from('bill_version_line_items')
      .select(
        `
          boq_item_id,
          previous_quantity,
          current_quantity,
          cumulative_quantity,
          rate,
          previous_amount,
          current_amount,
          cumulative_amount,
          boq_items (
            item_number,
            description,
            sap_code,
            unit,
            quantity,
            rate,
            amount
          )
        `,
      )
      .eq('bill_version_id', versionId);
    if (lineError) throw new Error(`Failed to fetch line items: ${lineError.message}`);

    const { data: measurements, error: measurementError } = await this.db
      .from('bill_measurements')
      .select(
        `
          measurements (
            id,
            boq_item_id,
            area_name,
            measurement_date,
            nos,
            length,
            breadth,
            depth,
            quantity,
            unit,
            remarks,
            is_deduction,
            boq_items (
              item_number,
              description
            )
          )
        `,
      )
      .eq('ra_bill_id', billId);
    if (measurementError) {
      throw new Error(`Failed to fetch bill measurements: ${measurementError.message}`);
    }

    return {
      project: this.mapProject(project as ProjectRow),
      bill: this.mapBill(bill as BillRow),
      version: this.mapVersion(version as BillVersionRow),
      lineItems: this.mapLineItems(lineItems ?? []),
      measurements: this.mapMeasurements(measurements ?? []),
    };
  }

  private mapProject(row: ProjectRow): BillExportDataset['project'] {
    return {
      id: row.id,
      name: row.name,
      code: row.code,
      clientName: row.client_name,
      locationCity: row.location_city,
      locationState: row.location_state,
    };
  }

  private mapBill(row: BillRow): BillExportDataset['bill'] {
    return {
      id: row.id,
      billNumber: row.bill_number,
      billSequence: Number(row.bill_sequence),
      createdAt: row.created_at,
    };
  }

  private mapVersion(row: BillVersionRow): BillExportDataset['version'] {
    return {
      id: row.id,
      versionType: row.version_type,
      versionNumber: Number(row.version_number),
      source: row.source,
      subTotal: Number(row.sub_total ?? 0),
      taxRate: Number(row.tax_rate),
      taxAmount: Number(row.tax_amount ?? 0),
      grandTotal: Number(row.grand_total ?? 0),
      createdAt: row.created_at,
    };
  }

  private mapLineItems(rows: unknown[]): ExportLineItem[] {
    return rows
      .map((raw) => raw as LineItemRow)
      .map((row) => ({
        boqItemId: row.boq_item_id,
        itemNumber: Number(row.boq_items?.item_number ?? 0),
        description: row.boq_items?.description ?? 'Unknown BOQ Item',
        sapCode: row.boq_items?.sap_code ?? null,
        unit: row.boq_items?.unit ?? null,
        boqQuantity: Number(row.boq_items?.quantity ?? 0),
        rate: Number(row.rate),
        boqAmount: Number(row.boq_items?.amount ?? 0),
        previousQuantity: Number(row.previous_quantity),
        currentQuantity: Number(row.current_quantity),
        cumulativeQuantity: Number(row.cumulative_quantity),
        previousAmount: Number(row.previous_amount),
        currentAmount: Number(row.current_amount),
        cumulativeAmount: Number(row.cumulative_amount),
      }))
      .sort((a, b) => a.itemNumber - b.itemNumber);
  }

  private mapMeasurements(rows: unknown[]): ExportMeasurementRow[] {
    const mapped = rows
      .map((raw) => raw as BillMeasurementRow)
      .map((row) => row.measurements)
      .filter((measurement): measurement is MeasurementNestedRow => Boolean(measurement))
      .map((measurement) => ({
        id: measurement.id,
        boqItemId: measurement.boq_item_id,
        itemNumber: Number(measurement.boq_items?.item_number ?? 0),
        description: measurement.boq_items?.description ?? 'Unknown BOQ Item',
        areaName: measurement.area_name,
        measurementDate: measurement.measurement_date,
        nos: Number(measurement.nos),
        length: measurement.length != null ? Number(measurement.length) : null,
        breadth: measurement.breadth != null ? Number(measurement.breadth) : null,
        depth: measurement.depth != null ? Number(measurement.depth) : null,
        quantity: Number(measurement.quantity),
        unit: measurement.unit,
        remarks: measurement.remarks,
        isDeduction: measurement.is_deduction,
      }));

    // Why: grouping by BOQ sequence then date keeps workbook consistent with abstract ordering.
    return mapped.sort((a, b) => {
      if (a.itemNumber !== b.itemNumber) return a.itemNumber - b.itemNumber;
      return a.measurementDate.localeCompare(b.measurementDate);
    });
  }

  private buildFileName(dataset: BillExportDataset): string {
    const safeProjectCode = dataset.project.code.replace(/[^a-z0-9_-]/gi, '_');
    return `${safeProjectCode}-RA-${dataset.bill.billSequence}-v${dataset.version.versionNumber}-${dataset.version.versionType}.xlsx`;
  }
}
