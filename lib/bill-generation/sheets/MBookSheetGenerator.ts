import type ExcelJS from 'exceljs';
import type { BillExportDataset } from '../types';

/**
 * Builds "M BOOK" sheet with raw measurement rows.
 * Why: this preserves field-level traceability behind current quantities.
 */
export class MBookSheetGenerator {
  generate(worksheet: ExcelJS.Worksheet, dataset: BillExportDataset): void {
    worksheet.columns = [
      { header: 'Date', key: 'measurementDate', width: 14 },
      { header: 'Item No', key: 'itemNumber', width: 10 },
      { header: 'Description', key: 'description', width: 44 },
      { header: 'Area Name', key: 'areaName', width: 24 },
      { header: 'NOS', key: 'nos', width: 10 },
      { header: 'L', key: 'length', width: 10 },
      { header: 'B', key: 'breadth', width: 10 },
      { header: 'D', key: 'depth', width: 10 },
      { header: 'Quantity', key: 'quantity', width: 12 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Deduction', key: 'isDeduction', width: 12 },
      { header: 'Remarks', key: 'remarks', width: 32 },
    ];

    for (const measurement of dataset.measurements) {
      worksheet.addRow({
        measurementDate: measurement.measurementDate,
        itemNumber: measurement.itemNumber,
        description: measurement.description,
        areaName: measurement.areaName,
        nos: measurement.nos,
        length: measurement.length ?? '',
        breadth: measurement.breadth ?? '',
        depth: measurement.depth ?? '',
        quantity: measurement.quantity,
        unit: measurement.unit,
        isDeduction: measurement.isDeduction ? 'Yes' : 'No',
        remarks: measurement.remarks ?? '',
      });
    }

    worksheet.getRow(1).font = { bold: true };
  }
}
