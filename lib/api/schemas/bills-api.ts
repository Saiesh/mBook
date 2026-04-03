import { z } from 'zod';

/** Why: POST /api/projects/:id/bills/generate body. */
export const generateBillBodySchema = z.object({
  measurementIds: z.array(z.string().uuid()).min(1),
  billNumber: z.string().min(1).optional(),
  taxRate: z.number().optional(),
  notes: z.union([z.string(), z.null()]).optional(),
});

const lineItemOverrideSchema = z.object({
  boqItemId: z.string().uuid(),
  previousQuantity: z.number().optional(),
  currentQuantity: z.number(),
  cumulativeQuantity: z.number().optional(),
  rate: z.number(),
  previousAmount: z.number().optional(),
  currentAmount: z.number().optional(),
  cumulativeAmount: z.number().optional(),
});

/** Why: POST accept bill — optional overrides for manual corrections. */
export const acceptBillBodySchema = z.object({
  sourceVersionId: z.string().uuid().optional(),
  lineItems: z.array(lineItemOverrideSchema).optional(),
  taxRate: z.number().optional(),
  notes: z.union([z.string(), z.null()]).optional(),
});
