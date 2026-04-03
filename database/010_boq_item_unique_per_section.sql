-- =============================================================================
-- Migration 010: Scope BOQ item uniqueness to section
-- =============================================================================
-- Why: many BOQ files restart item numbers per section (e.g. 10..160 in each
-- section). The old unique key on (boq_version_id, item_number) incorrectly
-- rejected or forced merges across sections. Uniqueness must be section-local.
-- =============================================================================

BEGIN;

ALTER TABLE public.boq_items
    DROP CONSTRAINT IF EXISTS uq_boq_item_per_version;

ALTER TABLE public.boq_items
    ADD CONSTRAINT uq_boq_item_per_section
    UNIQUE (boq_version_id, boq_section_id, item_number);

COMMIT;
