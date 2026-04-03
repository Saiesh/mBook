-- =============================================================================
-- BOQ (Bill of Quantities) Management - Database Schema
-- =============================================================================
-- Version: 1.0
-- Date: February 21, 2026
-- Module: BOQ Import, Versioning, and Area Mapping
--
-- Depends on: 001_project_management_schema.sql (projects, areas tables)
-- =============================================================================


-- =============================================================================
-- TABLE: boq_versions
-- Each Excel upload creates a new immutable version; only one is active at a
-- time per project.  Old versions are deactivated, never deleted.
-- =============================================================================
CREATE TABLE boq_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    uploaded_by UUID REFERENCES users(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    total_amount DECIMAL(15, 2),
    item_count INT NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Only one active version per project at any time
    CONSTRAINT uq_boq_versions_active UNIQUE (project_id, is_active)
        -- Partial unique index created below replaces this for Postgres
);

-- The table-level UNIQUE above doesn't support partial uniqueness in standard
-- SQL.  Drop it and use a partial unique index instead so multiple inactive
-- versions can coexist.
ALTER TABLE boq_versions DROP CONSTRAINT IF EXISTS uq_boq_versions_active;

CREATE UNIQUE INDEX idx_boq_versions_active_per_project
    ON boq_versions (project_id) WHERE is_active = true;

CREATE INDEX idx_boq_versions_project_id ON boq_versions(project_id);

-- Ensure version numbers increment per project
CREATE UNIQUE INDEX idx_boq_versions_project_version
    ON boq_versions (project_id, version_number);


-- =============================================================================
-- TABLE: boq_sections
-- Logical groupings (e.g. "Marketing office front area Hardscape") within a
-- BOQ version.  Sections are purely organisational.
-- =============================================================================
CREATE TABLE boq_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    boq_version_id UUID NOT NULL REFERENCES boq_versions(id) ON DELETE CASCADE,
    section_number INT NOT NULL,
    name VARCHAR(500) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_boq_section_per_version UNIQUE (boq_version_id, section_number)
);

CREATE INDEX idx_boq_sections_version ON boq_sections(boq_version_id);


-- =============================================================================
-- TABLE: boq_items
-- Individual line items from the Excel.  Immutable once imported (tied to a
-- version).
-- =============================================================================
CREATE TABLE boq_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    boq_version_id UUID NOT NULL REFERENCES boq_versions(id) ON DELETE CASCADE,
    boq_section_id UUID REFERENCES boq_sections(id) ON DELETE SET NULL,
    item_number INT NOT NULL,
    description TEXT NOT NULL,
    sap_code VARCHAR(100),
    unit VARCHAR(50),
    quantity DECIMAL(15, 4) NOT NULL DEFAULT 0,
    rate DECIMAL(15, 2) NOT NULL DEFAULT 0,
    amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_boq_item_per_version UNIQUE (boq_version_id, item_number)
);

CREATE INDEX idx_boq_items_version ON boq_items(boq_version_id);
CREATE INDEX idx_boq_items_section ON boq_items(boq_section_id);
CREATE INDEX idx_boq_items_sap_code ON boq_items(sap_code);


-- =============================================================================
-- TABLE: boq_item_area_mappings
-- Maps a BOQ item to one or more project areas.  This is the only mutable
-- table in the BOQ module — users assign items to areas after import.
-- =============================================================================
CREATE TABLE boq_item_area_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    boq_item_id UUID NOT NULL REFERENCES boq_items(id) ON DELETE CASCADE,
    area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_boq_item_area UNIQUE (boq_item_id, area_id)
);

CREATE INDEX idx_boq_item_area_item ON boq_item_area_mappings(boq_item_id);
CREATE INDEX idx_boq_item_area_area ON boq_item_area_mappings(area_id);


-- =============================================================================
-- TRIGGERS — auto-update updated_at
-- =============================================================================
CREATE TRIGGER trg_boq_versions_updated_at
    BEFORE UPDATE ON boq_versions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE boq_versions IS 'Immutable BOQ snapshots — one active version per project';
COMMENT ON TABLE boq_sections IS 'Logical groupings of BOQ items within a version';
COMMENT ON TABLE boq_items IS 'Individual BOQ line items imported from Excel';
COMMENT ON TABLE boq_item_area_mappings IS 'Many-to-many: BOQ items ↔ project areas';

-- =============================================================================
-- FUNCTION: import_boq_version_atomic
-- Why: wraps BOQ import in one DB transaction so version/sections/items either
-- all persist together or all roll back on failure.
-- =============================================================================
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
    -- Why: serialize imports per project so version_number/is_active remain conflict-free.
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
