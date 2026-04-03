-- =============================================================================
-- Migration 008: Add atomic BOQ import function
-- =============================================================================
-- Why: BOQ import previously wrote version/sections/items in separate calls,
-- which could leave partial rows when item inserts failed. This migration adds
-- one transactional function used by the API import path.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.import_boq_version_atomic(
    p_project_id UUID,
    p_file_name TEXT,
    p_uploaded_by UUID DEFAULT NULL,
    p_total_amount DECIMAL(15, 2) DEFAULT 0,
    p_sections JSONB DEFAULT '[]'::jsonb,
    p_items JSONB DEFAULT '[]'::jsonb
)
RETURNS public.boq_versions
LANGUAGE plpgsql
AS $$
DECLARE
    v_version public.boq_versions%ROWTYPE;
    v_next_version INT;
BEGIN
    -- Why: serializes concurrent imports per project to keep version_number monotonic.
    PERFORM pg_advisory_xact_lock(hashtext(p_project_id::text));

    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO v_next_version
    FROM public.boq_versions
    WHERE project_id = p_project_id;

    UPDATE public.boq_versions
    SET is_active = false
    WHERE project_id = p_project_id
      AND is_active = true;

    INSERT INTO public.boq_versions (
        project_id,
        version_number,
        file_name,
        uploaded_by,
        is_active,
        total_amount,
        item_count
    )
    VALUES (
        p_project_id,
        v_next_version,
        p_file_name,
        p_uploaded_by,
        true,
        0,
        0
    )
    RETURNING * INTO v_version;

    WITH section_payload AS (
        SELECT
            (value->>'section_number')::INT AS section_number,
            value->>'name' AS name,
            COALESCE((value->>'sort_order')::INT, 0) AS sort_order
        FROM jsonb_array_elements(COALESCE(p_sections, '[]'::jsonb))
    ),
    inserted_sections AS (
        INSERT INTO public.boq_sections (
            boq_version_id,
            section_number,
            name,
            sort_order
        )
        SELECT
            v_version.id,
            sp.section_number,
            sp.name,
            sp.sort_order
        FROM section_payload sp
        RETURNING id, sort_order
    ),
    item_payload AS (
        SELECT
            NULLIF(value->>'section_sort_order', '')::INT AS section_sort_order,
            (value->>'item_number')::INT AS item_number,
            value->>'description' AS description,
            NULLIF(value->>'sap_code', '') AS sap_code,
            NULLIF(value->>'unit', '') AS unit,
            COALESCE((value->>'quantity')::DECIMAL(15, 4), 0) AS quantity,
            COALESCE((value->>'rate')::DECIMAL(15, 4), 0) AS rate,
            COALESCE((value->>'amount')::DECIMAL(15, 2), 0) AS amount,
            COALESCE((value->>'sort_order')::INT, 0) AS sort_order
        FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
    )
    INSERT INTO public.boq_items (
        boq_version_id,
        boq_section_id,
        item_number,
        description,
        sap_code,
        unit,
        quantity,
        rate,
        amount,
        sort_order
    )
    SELECT
        v_version.id,
        ixs.id,
        ip.item_number,
        ip.description,
        ip.sap_code,
        ip.unit,
        ip.quantity,
        ip.rate,
        ip.amount,
        ip.sort_order
    FROM item_payload ip
    LEFT JOIN inserted_sections ixs
        ON ixs.sort_order = ip.section_sort_order;

    UPDATE public.boq_versions
    SET
        item_count = (
            SELECT COUNT(*)
            FROM public.boq_items bi
            WHERE bi.boq_version_id = v_version.id
        ),
        total_amount = COALESCE(p_total_amount, 0)
    WHERE id = v_version.id
    RETURNING * INTO v_version;

    RETURN v_version;
END;
$$;

COMMIT;
