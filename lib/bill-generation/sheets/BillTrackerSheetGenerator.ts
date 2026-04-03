import type ExcelJS from 'exceljs';
import type { BillExportDataset } from '../types';

/**
 * Builds Bill Tracker sheet.
 * Why: stakeholders need a single metadata page before jumping into details.
 */
export class BillTrackerSheetGenerator {
  generate(worksheet: ExcelJS.Worksheet, dataset: BillExportDataset): void {
    worksheet.columns = [
      { header: 'Field', key: 'field', width: 28 },
      { header: 'Value', key: 'value', width: 48 },
    ];

    const rows: Array<{ field: string; value: string | number }> = [
      { field: 'Project Name', value: dataset.project.name },
      { field: 'Project Code', value: dataset.project.code },
      { field: 'Client', value: dataset.project.clientName ?? 'N/A' },
      {
        field: 'Location',
        value: [dataset.project.locationCity, dataset.project.locationState].filter(Boolean).join(', ') || 'N/A',
      },
      { field: 'RA Bill Number', value: dataset.bill.billNumber },
      { field: 'RA Bill Sequence', value: dataset.bill.billSequence },
      { field: 'Version Type', value: dataset.version.versionType },
      { field: 'Version Number', value: dataset.version.versionNumber },
      { field: 'Version Source', value: dataset.version.source },
      { field: 'Generated At', value: dataset.version.createdAt },
      { field: 'Sub Total', value: dataset.version.subTotal },
      { field: 'Tax Rate (%)', value: dataset.version.taxRate },
      { field: 'Tax Amount', value: dataset.version.taxAmount },
      { field: 'Grand Total', value: dataset.version.grandTotal },
    ];

    rows.forEach((row) => worksheet.addRow(row));
    worksheet.getRow(1).font = { bold: true };
  }
}
