import { z } from 'zod';

import type { ProjectFilters, ProjectStatus } from '@/lib/project-management/types';

/** Why: single source of truth for project list query validation shared with handlers. */
export const projectListQuerySchema = z.object({
  status: z.enum(['active', 'completed', 'on_hold', 'cancelled']).optional(),
  search: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  createdBy: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().uuid().optional()
  ),
  startDateFrom: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  startDateTo: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sortBy: z.enum(['name', 'code', 'created_at', 'updated_at']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/** Maps validated query params into repository filters (omits undefined keys). */
export function toProjectFilters(
  parsed: z.infer<typeof projectListQuerySchema>
): ProjectFilters {
  const filters: ProjectFilters = {};
  if (parsed.status !== undefined) filters.status = parsed.status as ProjectStatus;
  if (parsed.search !== undefined) filters.search = parsed.search;
  if (parsed.createdBy !== undefined) filters.createdBy = parsed.createdBy;
  if (parsed.startDateFrom !== undefined) filters.startDateFrom = parsed.startDateFrom;
  if (parsed.startDateTo !== undefined) filters.startDateTo = parsed.startDateTo;
  if (parsed.page !== undefined) filters.page = parsed.page;
  if (parsed.limit !== undefined) filters.limit = parsed.limit;
  if (parsed.sortBy !== undefined) filters.sortBy = parsed.sortBy;
  if (parsed.sortOrder !== undefined) filters.sortOrder = parsed.sortOrder;
  return filters;
}

const locationBodySchema = z
  .object({
    city: z.string().optional(),
    state: z.string().optional(),
    address: z.string().optional(),
  })
  .optional();

/** Why: POST /api/projects body — strict shapes catch bad clients early. */
export const createProjectBodySchema = z.object({
  name: z.string().min(1),
  code: z
    .string()
    .min(1)
    .regex(/^[A-Z0-9_-]+$/i, 'Code must contain only letters, numbers, hyphens, underscores'),
  clientName: z.string().optional(),
  location: locationBodySchema,
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  description: z.string().optional(),
  budget: z.number().nonnegative().optional(),
});

export const updateProjectBodySchema = z.object({
  name: z.string().min(1).optional(),
  clientName: z.string().nullable().optional(),
  location: locationBodySchema.nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  status: z.enum(['active', 'completed', 'on_hold', 'cancelled']).optional(),
  description: z.string().nullable().optional(),
  budget: z.number().nonnegative().nullable().optional(),
});
