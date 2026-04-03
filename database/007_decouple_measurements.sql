-- =============================================================================
-- Migration 007: Decouple measurements from bills and add bill versioning
-- =============================================================================
-- Why: Phase 2 changes the business flow so measurements are captured first,
-- then selected into bills. This migration removes direct measurement->bill
-- coupling and introduces explicit bill versions + bill-measurement linking.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- STEP 1: Prepare measurements for decoupled model
-- Why: We need free-text area names and independent measurement dates.
-- -----------------------------------------------------------------------------

-- Add area_name first so we can backfill from existing area_id before dropping it.
ALTER TABLE public.measurements
    ADD COLUMN IF NOT EXISTS area_name VARCHAR(255);

UPDATE public.measurements AS m
SET area_name = a.name
FROM public.areas AS a
WHERE m.area_name IS NULL
  AND m.area_id = a.id;

-- Ensure legacy rows remain valid even if area references are missing.
UPDATE public.measurements
SET area_name = 'General'
WHERE area_name IS NULL;

ALTER TABLE public.measurements
    ALTER COLUMN area_name SET NOT NULL;

ALTER TABLE public.measurements
    ADD COLUMN IF NOT EXISTS measurement_date DATE;

UPDATE public.measurements
SET measurement_date = COALESCE(created_at::date, CURRENT_DATE)
WHERE measurement_date IS NULL;

ALTER TABLE public.measurements
    ALTER COLUMN measurement_date SET DEFAULT CURRENT_DATE,
    ALTER COLUMN measurement_date SET NOT NULL;

-- Drop bill/area coupling and legacy fields no longer used in the new flow.
ALTER TABLE public.measurements
    DROP COLUMN IF EXISTS ra_bill_id,
    DROP COLUMN IF EXISTS area_id,
    DROP COLUMN IF EXISTS serial_number,
    DROP COLUMN IF EXISTS description;

-- Replace indexes that referenced removed columns.
DROP INDEX IF EXISTS idx_measurements_ra_bill;
DROP INDEX IF EXISTS idx_measurements_area;
DROP INDEX IF EXISTS idx_measurements_cumulative;

-- Why: Optimizes bill generation input lookups by project/date/boq item.
CREATE INDEX IF NOT EXISTS idx_measurements_project_date
    ON public.measurements(project_id, measurement_date)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_measurements_project_boq_date
    ON public.measurements(project_id, boq_item_id, measurement_date)
    WHERE deleted_at IS NULL;


-- -----------------------------------------------------------------------------
-- STEP 2: Simplify ra_bills to metadata-only rows
-- Why: Financial totals now belong to bill_versions, not ra_bills.
-- -----------------------------------------------------------------------------

ALTER TABLE public.ra_bills
    DROP CONSTRAINT IF EXISTS ra_bill_period_check;

ALTER TABLE public.ra_bills
    DROP COLUMN IF EXISTS vendor_name,
    DROP COLUMN IF EXISTS work_order_number,
    DROP COLUMN IF EXISTS work_order_value,
    DROP COLUMN IF EXISTS nature_of_work,
    DROP COLUMN IF EXISTS bill_period_start,
    DROP COLUMN IF EXISTS bill_period_end,
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS sub_total,
    DROP COLUMN IF EXISTS tax_rate,
    DROP COLUMN IF EXISTS tax_amount,
    DROP COLUMN IF EXISTS grand_total,
    DROP COLUMN IF EXISTS version,
    DROP COLUMN IF EXISTS excel_url,
    DROP COLUMN IF EXISTS generated_at,
    DROP COLUMN IF EXISTS generated_by;

DROP INDEX IF EXISTS idx_ra_bills_status;

-- bill_status enum becomes unused after dropping the status column.
DROP TYPE IF EXISTS public.bill_status;


-- -----------------------------------------------------------------------------
-- STEP 3: Create bill_measurements junction table
-- Why: A bill now links to a selected set of pre-existing measurements.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.bill_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ra_bill_id UUID NOT NULL REFERENCES public.ra_bills(id) ON DELETE CASCADE,
    measurement_id UUID NOT NULL REFERENCES public.measurements(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_bill_measurement UNIQUE (ra_bill_id, measurement_id)
);

CREATE INDEX IF NOT EXISTS idx_bill_measurements_bill
    ON public.bill_measurements(ra_bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_measurements_measurement
    ON public.bill_measurements(measurement_id);


-- -----------------------------------------------------------------------------
-- STEP 4: Create bill versioning structures
-- Why: Each bill can have multiple generated versions and an accepted version.
-- -----------------------------------------------------------------------------

DO $$
BEGIN
    CREATE TYPE public.bill_version_type AS ENUM ('generated', 'accepted');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.bill_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ra_bill_id UUID NOT NULL REFERENCES public.ra_bills(id) ON DELETE CASCADE,
    version_type public.bill_version_type NOT NULL,
    version_number INT NOT NULL DEFAULT 1,
    source VARCHAR(50) NOT NULL DEFAULT 'auto_generated',
    sub_total DECIMAL(15, 2),
    tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 18.00,
    tax_amount DECIMAL(15, 2),
    grand_total DECIMAL(15, 2),
    excel_url TEXT,
    notes TEXT,
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_bill_version UNIQUE (ra_bill_id, version_type, version_number)
);

CREATE INDEX IF NOT EXISTS idx_bill_versions_bill
    ON public.bill_versions(ra_bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_versions_type
    ON public.bill_versions(version_type);
CREATE INDEX IF NOT EXISTS idx_bill_versions_bill_type_created
    ON public.bill_versions(ra_bill_id, version_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.bill_version_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_version_id UUID NOT NULL REFERENCES public.bill_versions(id) ON DELETE CASCADE,
    boq_item_id UUID NOT NULL REFERENCES public.boq_items(id),
    previous_quantity DECIMAL(15, 4) NOT NULL DEFAULT 0,
    current_quantity DECIMAL(15, 4) NOT NULL DEFAULT 0,
    cumulative_quantity DECIMAL(15, 4) NOT NULL DEFAULT 0,
    rate DECIMAL(15, 4) NOT NULL,
    previous_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    current_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    cumulative_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_bill_version_item UNIQUE (bill_version_id, boq_item_id)
);

CREATE INDEX IF NOT EXISTS idx_bill_version_line_items_version
    ON public.bill_version_line_items(bill_version_id);
CREATE INDEX IF NOT EXISTS idx_bill_version_line_items_boq_item
    ON public.bill_version_line_items(boq_item_id);


-- -----------------------------------------------------------------------------
-- STEP 5: Documentation comments
-- Why: Keeps schema intent visible in Supabase and psql inspection tools.
-- -----------------------------------------------------------------------------

COMMENT ON TABLE public.bill_measurements IS 'Selected measurements linked to each RA bill';
COMMENT ON TABLE public.bill_versions IS 'Generated/accepted bill snapshots with financial totals';
COMMENT ON TABLE public.bill_version_line_items IS 'Per-BOQ calculations stored for each bill version';
COMMENT ON COLUMN public.measurements.area_name IS 'Free-text area name captured during measurement entry';
COMMENT ON COLUMN public.measurements.measurement_date IS 'Date when measurement was taken; used for selection and grouping';

-- -----------------------------------------------------------------------------
-- STEP 6: Add atomic generated-bill upload function
-- Why: upload flow must create bill_versions + line_items in one transaction to
-- avoid orphan generated versions on insert failures.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_generated_bill_version_atomic(
    p_bill_id UUID,
    p_tax_rate DECIMAL(5, 2),
    p_tax_amount DECIMAL(15, 2),
    p_grand_total DECIMAL(15, 2),
    p_sub_total DECIMAL(15, 2),
    p_notes TEXT DEFAULT NULL,
    p_excel_url TEXT DEFAULT NULL,
    p_created_by UUID DEFAULT NULL,
    p_line_items JSONB DEFAULT '[]'::jsonb
)
RETURNS public.bill_versions
LANGUAGE plpgsql
AS $$
DECLARE
    v_version public.bill_versions%ROWTYPE;
    v_next_version INT;
BEGIN
    -- Why: serializes generated-version numbering per bill under concurrent uploads.
    PERFORM pg_advisory_xact_lock(hashtext(p_bill_id::text));

    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO v_next_version
    FROM public.bill_versions
    WHERE ra_bill_id = p_bill_id
      AND version_type = 'generated';

    INSERT INTO public.bill_versions (
        ra_bill_id,
        version_type,
        version_number,
        source,
        sub_total,
        tax_rate,
        tax_amount,
        grand_total,
        excel_url,
        notes,
        created_by
    )
    VALUES (
        p_bill_id,
        'generated',
        v_next_version,
        'excel_upload',
        p_sub_total,
        p_tax_rate,
        p_tax_amount,
        p_grand_total,
        p_excel_url,
        p_notes,
        p_created_by
    )
    RETURNING * INTO v_version;

    INSERT INTO public.bill_version_line_items (
        bill_version_id,
        boq_item_id,
        previous_quantity,
        current_quantity,
        cumulative_quantity,
        rate,
        previous_amount,
        current_amount,
        cumulative_amount
    )
    SELECT
        v_version.id,
        (value->>'boq_item_id')::UUID,
        COALESCE((value->>'previous_quantity')::DECIMAL(15, 4), 0),
        COALESCE((value->>'current_quantity')::DECIMAL(15, 4), 0),
        COALESCE((value->>'cumulative_quantity')::DECIMAL(15, 4), 0),
        COALESCE((value->>'rate')::DECIMAL(15, 4), 0),
        COALESCE((value->>'previous_amount')::DECIMAL(15, 2), 0),
        COALESCE((value->>'current_amount')::DECIMAL(15, 2), 0),
        COALESCE((value->>'cumulative_amount')::DECIMAL(15, 2), 0)
    FROM jsonb_array_elements(COALESCE(p_line_items, '[]'::jsonb));

    RETURN v_version;
END;
$$;

COMMIT;
