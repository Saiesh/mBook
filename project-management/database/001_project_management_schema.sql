-- =============================================================================
-- Project Management Module - PostgreSQL Database Schema
-- =============================================================================
-- Version: 1.0
-- Date: February 15, 2026
-- Module: Project Creation and Management
--
-- Run this in PostgreSQL 14+ or Supabase SQL editor
-- =============================================================================

-- Extensions
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For trigram text search on project names


-- ENUM Types
-- -----------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('admin', 'ho_qs', 'site_qs', 'project_incharge');

CREATE TYPE project_status AS ENUM ('active', 'completed', 'on_hold', 'cancelled');

CREATE TYPE team_member_role AS ENUM ('ho_qs', 'site_qs', 'project_incharge');

CREATE TYPE audit_action AS ENUM ('create', 'update', 'delete');


-- =============================================================================
-- TABLE: users
-- System users (HO QS, Site QS, Project Incharge, Admin)
-- =============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role user_role NOT NULL DEFAULT 'site_qs',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);


-- =============================================================================
-- TABLE: projects
-- Main project entity with soft delete support
-- =============================================================================
CREATE TABLE projects (
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
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT projects_end_after_start CHECK (
        end_date IS NULL OR start_date IS NULL OR end_date >= start_date
    )
);

-- Indexes
CREATE INDEX idx_projects_code ON projects(code) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_status ON projects(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_created_by ON projects(created_by);
CREATE INDEX idx_projects_deleted_at ON projects(deleted_at);
CREATE INDEX idx_projects_name_trgm ON projects USING gin(name gin_trgm_ops);


-- =============================================================================
-- TABLE: project_team_members (team_members)
-- Many-to-many: projects ↔ users with role
-- =============================================================================
CREATE TABLE project_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role team_member_role NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    removed_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT uq_project_team_member UNIQUE (project_id, user_id, role)
);

-- Indexes
CREATE INDEX idx_project_team_project_id ON project_team_members(project_id) WHERE is_active = true;
CREATE INDEX idx_project_team_user_id ON project_team_members(user_id) WHERE is_active = true;
CREATE INDEX idx_project_team_role ON project_team_members(role);


-- =============================================================================
-- TABLE: areas
-- Hierarchical areas within projects (zone → area, 2 levels)
-- Self-referencing for parent-child structure
-- =============================================================================
CREATE TABLE areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
    level INT NOT NULL DEFAULT 1 CHECK (level IN (1, 2)),
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT uq_areas_project_code UNIQUE (project_id, code),
    CONSTRAINT areas_level_parent_check CHECK (
        (level = 1 AND parent_area_id IS NULL) OR
        (level = 2 AND parent_area_id IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX idx_areas_project_id ON areas(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_areas_parent_area_id ON areas(parent_area_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_areas_code ON areas(code);
CREATE INDEX idx_areas_sort_order ON areas(project_id, sort_order);


-- =============================================================================
-- TABLE: audit_logs
-- Tracks all create/update/delete actions for compliance
-- =============================================================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action audit_action NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    changes_before JSONB,
    changes_after JSONB,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- Indexes
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);


-- =============================================================================
-- TRIGGERS
-- Auto-update updated_at timestamp on row modification
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables with updated_at column
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_areas_updated_at
    BEFORE UPDATE ON areas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =============================================================================
-- OPTIONAL: Composite index for common audit log queries
-- (entity + timestamp for "recent changes to entity" queries)
-- =============================================================================
CREATE INDEX idx_audit_logs_entity_timestamp ON audit_logs(entity_type, entity_id, timestamp DESC);


-- =============================================================================
-- COMMENTS (Documentation)
-- =============================================================================
COMMENT ON TABLE users IS 'System users: admin, HO QS, Site QS, Project Incharge';
COMMENT ON TABLE projects IS 'Construction projects with soft delete (deleted_at)';
COMMENT ON TABLE project_team_members IS 'Many-to-many: project ↔ user assignments with role';
COMMENT ON TABLE areas IS 'Hierarchical areas: level 1=zone, level 2=area (parent-child)';
COMMENT ON TABLE audit_logs IS 'Immutable audit trail for all entity changes';
COMMENT ON COLUMN areas.level IS '1=zone (top level), 2=area (child of zone)';
