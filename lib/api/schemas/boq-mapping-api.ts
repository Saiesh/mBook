import { z } from 'zod';

/** Why: POST/DELETE mapping body references a project area by id. */
export const boqAreaMappingBodySchema = z.object({
  areaId: z.string().uuid(),
});
