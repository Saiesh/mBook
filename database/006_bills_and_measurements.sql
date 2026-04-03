-- =============================================================================
-- RA Bills & Measurements - Database Schema
-- =============================================================================
-- Version: 1.0
-- Date: February 21, 2026
-- Module: Running Account Bills and Measurement tracking
--
-- Depends on:
--   001_project_management_schema.sql (projects, areas, users)
--   005_boq_management.sql (boq_versions, boq_items)
-- =============================================================================


-- =============================================================================
-- ENUM: bill_status
-- Draft bills can be edited; final bills are locked; superseded bills have been
-- replaced by a newer version of the same bill number.
-- =============================================================================
DO $$ BEGIN
    CREATE TYPE bill_status AS ENUM ('draft', 'final', 'superseded');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


-- =============================================================================
-- TABLE: ra_bills
-- A Running Account Bill is a periodic invoice for work completed on a project.
-- Each bill has a sequence number used for cumulative calculation ordering.
-- =============================================================================
CREATE TABLE ra_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    bill_number VARCHAR(50) NOT NULL,
    bill_sequence INT NOT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    work_order_number VARCHAR(100),
    work_order_value DECIMAL(15, 2),
    nature_of_work VARCHAR(255),
    bill_period_start DATE NOT NULL,
    bill_period_end DATE NOT NULL,
    boq_version_id UUID REFERENCES boq_versions(id),
    status bill_status NOT NULL DEFAULT 'draft',
    sub_total DECIMAL(15, 2),
    tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 18.00,
    tax_amount DECIMAL(15, 2),
    grand_total DECIMAL(15, 2),
    version INT NOT NULL DEFAULT 1,
    excel_url TEXT,
    generated_at TIMESTAMP WITH TIME ZONE,
    generated_by UUID REFERENCES users(id),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- Bill numbers must be unique per project
    CONSTRAINT uq_ra_bill_number UNIQUE (project_id, bill_number),
    -- Bill sequences must be unique per project for deterministic cumulative ordering
    CONSTRAINT uq_ra_bill_sequence UNIQUE (project_id, bill_sequence),
    -- Period end must be on or after period start
    CONSTRAINT ra_bill_period_check CHECK (bill_period_end >= bill_period_start)
);

CREATE INDEX idx_ra_bills_project ON ra_bills(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ra_bills_status ON ra_bills(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_ra_bills_boq_version ON ra_bills(boq_version_id);


-- =============================================================================
-- TABLE: measurements
-- Individual measurement rows captured against a specific BOQ item and area
-- within an RA bill. Quantity is auto-calculated as nos * length * breadth *
-- depth (nulls treated as 1).  Includes client_id/synced_at for future
-- offline PWA sync support.
-- =============================================================================
CREATE TABLE measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ra_bill_id UUID NOT NULL REFERENCES ra_bills(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id),
    area_id UUID NOT NULL REFERENCES areas(id),
    boq_item_id UUID NOT NULL REFERENCES boq_items(id),
    serial_number INT NOT NULL,
    description TEXT,
    nos DECIMAL(10, 4) NOT NULL DEFAULT 1,
    length DECIMAL(10, 4),
    breadth DECIMAL(10, 4),
    depth DECIMAL(10, 4),
    quantity DECIMAL(15, 4) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    remarks TEXT,
    is_deduction BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- For offline PWA sync — client_id is the UUID generated on device
    client_id UUID,
    synced_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_measurements_ra_bill ON measurements(ra_bill_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_measurements_project ON measurements(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_measurements_boq_item ON measurements(boq_item_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_measurements_area ON measurements(area_id) WHERE deleted_at IS NULL;
-- Speed up cumulative queries that sum quantities per BOQ item across bills
CREATE INDEX idx_measurements_cumulative ON measurements(project_id, boq_item_id, ra_bill_id) WHERE deleted_at IS NULL;
-- Uniqueness on client_id prevents duplicate syncs from the PWA
CREATE UNIQUE INDEX idx_measurements_client_id ON measurements(client_id) WHERE client_id IS NOT NULL;


-- =============================================================================
-- TRIGGERS — auto-update updated_at
-- =============================================================================
CREATE TRIGGER trg_ra_bills_updated_at
    BEFORE UPDATE ON ra_bills
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_measurements_updated_at
    BEFORE UPDATE ON measurements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE ra_bills IS 'Running Account Bills — periodic invoices for work completed';
COMMENT ON TABLE measurements IS 'Individual measurement entries linked to RA bills, BOQ items, and areas';
COMMENT ON COLUMN measurements.client_id IS 'UUID generated on the PWA client for offline-first sync';
COMMENT ON COLUMN measurements.synced_at IS 'Timestamp when an offline measurement was synced to the server';
COMMENT ON COLUMN measurements.quantity IS 'Auto-calculated: nos * coalesce(length,1) * coalesce(breadth,1) * coalesce(depth,1)';
