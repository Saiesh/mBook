-- =============================================================================
-- Supabase Projects Table (Standalone)
-- =============================================================================
-- Use this when you have Supabase Auth and want projects to reference auth.users
-- Run AFTER 001_project_management_schema.sql, OR use this alone if you only
-- need projects and will use auth.users for created_by.
--
-- To use alone: first create the project_status enum and projects table.
-- =============================================================================

-- Skip if enum exists (from 001)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
    CREATE TYPE project_status AS ENUM ('active', 'completed', 'on_hold', 'cancelled');
  END IF;
END
$$;

-- Create projects table referencing auth.users (Supabase Auth)
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    client_name VARCHAR(255),
    location_city VARCHAR(100),
    location_state VARCHAR(100),
    location_address TEXT,
    start_date DATE,
    end_date DATE,
    status project_status NOT NULL DEFAULT 'active',
    description TEXT,
    budget DECIMAL(15, 2),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT projects_end_after_start CHECK (
        end_date IS NULL OR start_date IS NULL OR end_date >= start_date
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_code ON projects(code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at);

-- pg_trgm for text search (enable extension if needed)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_projects_name_trgm ON projects USING gin(name gin_trgm_ops);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
