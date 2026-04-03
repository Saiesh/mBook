import type ExcelJS from 'exceljs';
import type { BillExportDataset } from '../types';

/**
 * Builds "Abstract" sheet.
 * Why: this sheet is also used as the import format for later bill revisions.
 */
export class AbstractSheetGenerator {
  generate(worksheet: ExcelJS.Worksheet, dataset: BillExportDataset): void {
    worksheet.columns = [
      { header: 'Sr.No', key: 'itemNumber', width: 10 },
      { header: 'Description', key: 'description', width: 48 },
      { header: 'SAP CODE', key: 'sapCode', width: 16 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'BOQ Qty', key: 'boqQuantity', width: 12 },
      { header: 'Rate', key: 'rate', width: 12 },
      { header: 'BOQ Amount', key: 'boqAmount', width: 14 },
      { header: 'Previous Quantity', key: 'previousQuantity', width: 18 },
      { header: 'Present Quantity', key: 'currentQuantity', width: 16 },
      { header: 'Cumulative Quantity', key: 'cumulativeQuantity', width: 18 },
      { header: 'Previous Amount', key: 'previousAmount', width: 16 },
      { header: 'Present Amount', key: 'currentAmount', width: 14 },
      { header: 'Cumulative Amount', key: 'cumulativeAmount', width: 18 },
    ];

    for (const item of dataset.lineItems) {
      worksheet.addRow({
        itemNumber: item.itemNumber,
        description: item.description,
        sapCode: item.sapCode ?? '',
        unit: item.unit ?? '',
        boqQuantity: item.boqQuantity,
        rate: item.rate,
        boqAmount: item.boqAmount,
        previousQuantity: item.previousQuantity,
        currentQuantity: item.currentQuantity,
        cumulativeQuantity: item.cumulativeQuantity,
        previousAmount: item.previousAmount,
        currentAmount: item.currentAmount,
        cumulativeAmount: item.cumulativeAmount,
      });
    }

    worksheet.getRow(1).font = { bold: true };
  }
}
