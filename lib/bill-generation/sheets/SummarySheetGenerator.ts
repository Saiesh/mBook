import type ExcelJS from 'exceljs';
import type { BillExportDataset } from '../types';

/**
 * Builds "PRAG SUMMURY" sheet.
 * Why: this mirrors the legacy workbook's quick-rollup format for review.
 */
export class SummarySheetGenerator {
  generate(worksheet: ExcelJS.Worksheet, dataset: BillExportDataset): void {
    worksheet.columns = [
      { header: 'Sr.No', key: 'itemNumber', width: 10 },
      { header: 'Description', key: 'description', width: 48 },
      { header: 'BOQ Amount', key: 'boqAmount', width: 16 },
      { header: 'Previous Amount', key: 'previousAmount', width: 18 },
      { header: 'Current Amount', key: 'currentAmount', width: 16 },
      { header: 'Cumulative Amount', key: 'cumulativeAmount', width: 20 },
    ];

    for (const item of dataset.lineItems) {
      worksheet.addRow({
        itemNumber: item.itemNumber,
        description: item.description,
        boqAmount: item.boqAmount,
        previousAmount: item.previousAmount,
        currentAmount: item.currentAmount,
        cumulativeAmount: item.cumulativeAmount,
      });
    }

    worksheet.addRow({});
    worksheet.addRow({
      description: 'Sub Total',
      currentAmount: dataset.version.subTotal,
    });
    worksheet.addRow({
      description: `GST @ ${dataset.version.taxRate}%`,
      currentAmount: dataset.version.taxAmount,
    });
    worksheet.addRow({
      description: 'Grand Total',
      currentAmount: dataset.version.grandTotal,
    });

    worksheet.getRow(1).font = { bold: true };
  }
}
