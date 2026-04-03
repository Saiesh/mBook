-- =============================================================================
-- Migration 004: Remove zone hierarchy from areas
-- =============================================================================
-- Why: Phase 0 flattens project areas so each area is a direct child of project.
-- This removes zone/child modeling fields and related constraint/index.
-- =============================================================================

BEGIN;

-- Drop hierarchy validation constraint first to avoid dependency issues.
ALTER TABLE public.areas
  DROP CONSTRAINT IF EXISTS areas_level_parent_check;

-- Drop index tied to removed parent column.
DROP INDEX IF EXISTS idx_areas_parent_area_id;

-- Drop hierarchy-only columns.
ALTER TABLE public.areas
  DROP COLUMN IF EXISTS parent_area_id,
  DROP COLUMN IF EXISTS level;

COMMIT;
