import ExcelJS from 'exceljs';

/**
 * Thin workbook wrapper for bill export sheets.
 * Why: centralizing workbook setup keeps all sheet generators consistent.
 */
export class ExcelBuilder {
  private readonly workbook: ExcelJS.Workbook;

  constructor() {
    this.workbook = new ExcelJS.Workbook();
    this.workbook.creator = 'mBook';
    this.workbook.created = new Date();
    this.workbook.modified = new Date();
  }

  addSheet(name: string): ExcelJS.Worksheet {
    return this.workbook.addWorksheet(name);
  }

  async toBuffer(): Promise<Buffer> {
    const output = await this.workbook.xlsx.writeBuffer();
    return Buffer.isBuffer(output) ? output : Buffer.from(output);
  }
}
