/**
 * Export-specific data contracts.
 * Why: sheet generators should depend on a stable typed shape, not raw DB rows.
 */
export interface ExportProjectMeta {
  id: string;
  name: string;
  code: string;
  clientName: string | null;
  locationCity: string | null;
  locationState: string | null;
}

export interface ExportBillMeta {
  id: string;
  billNumber: string;
  billSequence: number;
  createdAt: string;
}

export interface ExportBillVersionMeta {
  id: string;
  versionType: 'generated' | 'accepted';
  versionNumber: number;
  source: string;
  subTotal: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  createdAt: string;
}

export interface ExportLineItem {
  boqItemId: string;
  itemNumber: number;
  description: string;
  sapCode: string | null;
  unit: string | null;
  boqQuantity: number;
  rate: number;
  boqAmount: number;
  previousQuantity: number;
  currentQuantity: number;
  cumulativeQuantity: number;
  previousAmount: number;
  currentAmount: number;
  cumulativeAmount: number;
}

export interface ExportMeasurementRow {
  id: string;
  boqItemId: string;
  itemNumber: number;
  description: string;
  areaName: string;
  measurementDate: string;
  nos: number;
  length: number | null;
  breadth: number | null;
  depth: number | null;
  quantity: number;
  unit: string;
  remarks: string | null;
  isDeduction: boolean;
}

export interface BillExportDataset {
  project: ExportProjectMeta;
  bill: ExportBillMeta;
  version: ExportBillVersionMeta;
  lineItems: ExportLineItem[];
  measurements: ExportMeasurementRow[];
}
