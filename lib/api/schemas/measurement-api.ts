import { z } from 'zod';

/** Why: POST body for project measurements matches DB NOT NULL fields and optional dims. */
export const createMeasurementBodySchema = z.object({
  boqItemId: z.string().uuid(),
  areaName: z.string().min(1),
  unit: z.string().min(1),
  nos: z.number().optional(),
  length: z.number().nullable().optional(),
  breadth: z.number().nullable().optional(),
  depth: z.number().nullable().optional(),
  measurementDate: z.string().optional(),
  remarks: z.string().nullable().optional(),
  isDeduction: z.boolean().optional(),
  clientId: z.string().nullable().optional(),
});

export const measurementListQuerySchema = z.object({
  date: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  boqItemId: z.string().uuid().optional(),
  areaName: z.string().optional(),
  groupBy: z.enum(['date']).optional(),
});

/** Why: bulk sync from offline clients — each row must identify BOQ + area + unit. */
export const syncMeasurementsBodySchema = z.object({
  measurements: z.array(
    z.object({
      clientId: z.string().min(1),
      boqItemId: z.string().uuid(),
      areaName: z.string().min(1),
      unit: z.string().min(1),
      nos: z.number().optional(),
      length: z.number().optional(),
      breadth: z.number().optional(),
      depth: z.number().optional(),
      measurementDate: z.string().optional(),
      // Why: offline clients store remarks as null when empty; nullable() keeps the sync schema
      // consistent with createMeasurementBodySchema and prevents a spurious 422 on sync.
      remarks: z.string().nullable().optional(),
      isDeduction: z.boolean().optional(),
    })
  ),
});

export const recentMeasurementsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(300).optional(),
  previewPerProject: z.coerce.number().int().min(1).max(8).optional(),
});

/** Why: PATCH-style partial updates for measurement rows (all fields optional). */
export const updateMeasurementBodySchema = z.object({
  boqItemId: z.string().uuid().optional(),
  areaName: z.string().min(1).optional(),
  nos: z.number().optional(),
  length: z.number().nullable().optional(),
  breadth: z.number().nullable().optional(),
  depth: z.number().nullable().optional(),
  unit: z.string().min(1).optional(),
  measurementDate: z.string().optional(),
  remarks: z.string().nullable().optional(),
  isDeduction: z.boolean().optional(),
});
