import type ExcelJS from 'exceljs';

/**
 * Builds placeholder template sheets.
 * Why: downstream teams still expect these tabs to exist in the export workbook.
 */
export class TemplateSheetGenerator {
  generate(worksheet: ExcelJS.Worksheet, title: string): void {
    worksheet.columns = [
      { header: title, key: 'title', width: 80 },
    ];

    worksheet.addRow({
      // Why: explicit placeholder text prevents accidental interpretation as missing data.
      title: 'Template sheet - fill as required.',
    });
    worksheet.getRow(1).font = { bold: true };
  }
}
