-- =============================================================================
-- Project Management - Supabase Full Schema
-- =============================================================================
-- Use auth.users for authentication; public.users syncs for project management joins.
-- Run AFTER base app schema (supabase-schema.sql) or standalone.
-- Requires: Supabase project with Auth enabled
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ENUM Types (skip if exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
    CREATE TYPE project_status AS ENUM ('active', 'completed', 'on_hold', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_member_role') THEN
    CREATE TYPE team_member_role AS ENUM ('ho_qs', 'site_qs', 'project_incharge');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_action') THEN
    CREATE TYPE audit_action AS ENUM ('create', 'update', 'delete');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'ho_qs', 'site_qs');
  END IF;
END
$$;

-- =============================================================================
-- TABLE: public.users (sync from auth.users for project management joins)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL DEFAULT '',
    name VARCHAR(255) NOT NULL DEFAULT '',
    phone VARCHAR(20),
    role user_role NOT NULL DEFAULT 'site_qs',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role) WHERE is_active = true;

-- Sync trigger: populate public.users when auth.users gets new/updated user
-- Handles both 003 schema (no password_hash) and 001 schema (password_hash NOT NULL)
CREATE OR REPLACE FUNCTION public.sync_auth_user_to_users()
RETURNS TRIGGER AS $$
DECLARE
  has_password_col boolean;
  user_role_value user_role;
BEGIN
  -- Check if password_hash column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password_hash'
  ) INTO has_password_col;

  -- Extract role from metadata, default to 'site_qs'
  user_role_value := COALESCE(NEW.raw_user_meta_data->>'role', 'site_qs')::user_role;

  IF has_password_col THEN
    -- 001 schema: include placeholder (auth handled by Supabase Auth)
    INSERT INTO public.users (id, email, name, phone, role, is_active, last_login_at, password_hash)
    VALUES (
      NEW.id,
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data->>'name', ''),
      NEW.raw_user_meta_data->>'phone',
      user_role_value,
      COALESCE((NEW.raw_user_meta_data->>'is_active')::boolean, true),
      NEW.last_sign_in_at,
      '[supabase-auth]'
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      phone = EXCLUDED.phone,
      role = EXCLUDED.role,
      is_active = EXCLUDED.is_active,
      last_login_at = EXCLUDED.last_login_at,
      updated_at = CURRENT_TIMESTAMP;
  ELSE
    -- 003 schema: no password_hash column
    INSERT INTO public.users (id, email, name, phone, role, is_active, last_login_at)
    VALUES (
      NEW.id,
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data->>'name', ''),
      NEW.raw_user_meta_data->>'phone',
      user_role_value,
      COALESCE((NEW.raw_user_meta_data->>'is_active')::boolean, true),
      NEW.last_sign_in_at
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      phone = EXCLUDED.phone,
      role = EXCLUDED.role,
      is_active = EXCLUDED.is_active,
      last_login_at = EXCLUDED.last_login_at,
      updated_at = CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_sync_to_users ON auth.users;
CREATE TRIGGER on_auth_user_sync_to_users
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_auth_user_to_users();

-- Backfill existing auth users (handles 001 vs 003 schema)
DO $$
DECLARE
  has_password_col boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password_hash'
  ) INTO has_password_col;

  IF has_password_col THEN
    INSERT INTO public.users (id, email, name, phone, role, is_active, last_login_at, password_hash)
    SELECT 
      id, 
      email, 
      COALESCE(raw_user_meta_data->>'name', ''), 
      raw_user_meta_data->>'phone',
      COALESCE((raw_user_meta_data->>'role')::user_role, 'site_qs'),
      COALESCE((raw_user_meta_data->>'is_active')::boolean, true),
      last_sign_in_at,
      '[supabase-auth]'
    FROM auth.users
    ON CONFLICT (id) DO UPDATE SET 
      email = EXCLUDED.email, 
      name = EXCLUDED.name, 
      phone = EXCLUDED.phone,
      role = EXCLUDED.role,
      is_active = EXCLUDED.is_active,
      last_login_at = EXCLUDED.last_login_at,
      updated_at = CURRENT_TIMESTAMP;
  ELSE
    INSERT INTO public.users (id, email, name, phone, role, is_active, last_login_at)
    SELECT 
      id, 
      email, 
      COALESCE(raw_user_meta_data->>'name', ''), 
      raw_user_meta_data->>'phone',
      COALESCE((raw_user_meta_data->>'role')::user_role, 'site_qs'),
      COALESCE((raw_user_meta_data->>'is_active')::boolean, true),
      last_sign_in_at
    FROM auth.users
    ON CONFLICT (id) DO UPDATE SET 
      email = EXCLUDED.email, 
      name = EXCLUDED.name, 
      phone = EXCLUDED.phone,
      role = EXCLUDED.role,
      is_active = EXCLUDED.is_active,
      last_login_at = EXCLUDED.last_login_at,
      updated_at = CURRENT_TIMESTAMP;
  END IF;
END;
$$;

-- =============================================================================
-- TABLE: projects
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.projects (
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
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT projects_end_after_start CHECK (
        end_date IS NULL OR start_date IS NULL OR end_date >= start_date
    )
);

CREATE INDEX IF NOT EXISTS idx_projects_code ON public.projects(code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON public.projects(deleted_at);
CREATE INDEX IF NOT EXISTS idx_projects_name_trgm ON public.projects USING gin(name gin_trgm_ops);

-- =============================================================================
-- TABLE: project_team_members
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.project_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role team_member_role NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    removed_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT uq_project_team_member UNIQUE (project_id, user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_project_team_project_id ON public.project_team_members(project_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_project_team_user_id ON public.project_team_members(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_project_team_role ON public.project_team_members(role);

-- =============================================================================
-- TABLE: areas
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS idx_areas_project_id ON public.areas(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_areas_parent_area_id ON public.areas(parent_area_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_areas_code ON public.areas(code);
CREATE INDEX IF NOT EXISTS idx_areas_sort_order ON public.areas(project_id, sort_order);

-- =============================================================================
-- TABLE: audit_logs
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action audit_action NOT NULL,
    user_id UUID NOT NULL REFERENCES public.users(id),
    changes_before JSONB,
    changes_after JSONB,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_timestamp ON public.audit_logs(entity_type, entity_id, timestamp DESC);

-- =============================================================================
-- TRIGGERS: update_updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_areas_updated_at ON public.areas;
CREATE TRIGGER trg_areas_updated_at
    BEFORE UPDATE ON public.areas
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
