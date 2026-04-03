import { z } from 'zod';

/** Why: POST /api/projects/:id/areas body validation. */
export const createAreaBodySchema = z.object({
  code: z
    .string()
    .min(1)
    .regex(/^[A-Z0-9_-]+$/i, 'Code must contain only letters, numbers, hyphens, underscores'),
  name: z.string().min(1),
  description: z.union([z.string(), z.null()]).optional(),
  sortOrder: z.number().nonnegative().nullable().optional(),
});

export const updateAreaBodySchema = z
  .object({
    code: z
      .string()
      .min(1)
      .regex(/^[A-Z0-9_-]+$/i),
    name: z.string().min(1),
    description: z.union([z.string(), z.null()]),
    sortOrder: z.number().nonnegative().nullable(),
    isActive: z.boolean(),
  })
  .partial();

const teamRoleSchema = z.enum(['ho_qs', 'site_qs', 'project_incharge']);

export const teamMemberBodySchema = z.object({
  userId: z.string().uuid(),
  role: teamRoleSchema,
});

export const teamMemberDeleteBodySchema = z.object({
  userId: z.string().uuid(),
  role: teamRoleSchema,
});
