-- =============================================================================
-- Migration 009: Add atomic generated bill upload function
-- =============================================================================
-- Why: Excel upload previously created bill_versions before line-item insert,
-- which could leave orphan generated versions on downstream failures. This
-- function wraps both writes in one transaction-safe unit.
-- =============================================================================

BEGIN;

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
    -- Why: keeps generated version numbers deterministic under concurrent uploads.
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
