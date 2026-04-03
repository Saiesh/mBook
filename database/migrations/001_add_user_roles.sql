-- =============================================================================
-- Migration: Add User Roles to public.users
-- =============================================================================
-- This migration adds user role support to the public.users table
-- Run this if you already have 003_supabase_full.sql deployed and need to upgrade
-- =============================================================================

-- Step 1: Create user_role ENUM type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'ho_qs', 'site_qs');
  END IF;
END
$$;

-- Step 2: Add new columns to public.users
DO $$
BEGIN
  -- Add role column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.users ADD COLUMN role user_role NOT NULL DEFAULT 'site_qs';
  END IF;

  -- Add is_active column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
  END IF;

  -- Add last_login_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'last_login_at'
  ) THEN
    ALTER TABLE public.users ADD COLUMN last_login_at TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Add created_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.users ADD COLUMN created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;
  END IF;

  -- Add updated_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.users ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;
  END IF;
END
$$;

-- Step 3: Create index on role column
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role) WHERE is_active = true;

-- Step 4: Update the sync trigger to handle new columns
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

-- Step 5: Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_sync_to_users ON auth.users;
CREATE TRIGGER on_auth_user_sync_to_users
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_auth_user_to_users();

-- Step 6: Add updated_at trigger for users table
DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Step 7: Backfill existing users with new columns
-- This updates existing rows to populate last_login_at from auth.users
DO $$
BEGIN
  UPDATE public.users u
  SET 
    last_login_at = COALESCE(last_login_at, au.last_sign_in_at),
    updated_at = CURRENT_TIMESTAMP
  FROM auth.users au
  WHERE u.id = au.id
    AND u.last_login_at IS NULL
    AND au.last_sign_in_at IS NOT NULL;
END
$$;

-- Migration complete
-- Users can now have roles: 'admin', 'ho_qs', 'site_qs'
-- The sync trigger will automatically populate role from user metadata
