-- =============================================================================
-- Fix: Supabase Auth login errors (run in Supabase Dashboard → SQL Editor)
-- =============================================================================
--
-- FIX 1: "Database error querying schema" - NULL token columns
-- FIX 2: "Database error granting user" - trigger must be in auth schema with
--         explicit search_path (see supabase/supabase#563, RilDev's solution)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Fix 1: NULL token columns (if you hit "querying schema" error)
-- -----------------------------------------------------------------------------
UPDATE auth.users
SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, '')
WHERE
  confirmation_token IS NULL
  OR recovery_token IS NULL
  OR email_change_token_new IS NULL
  OR email_change IS NULL;

-- -----------------------------------------------------------------------------
-- Fix 2: Recreate sync trigger with SET search_path (fixes "granting user" error)
-- -----------------------------------------------------------------------------
-- The trigger runs when Auth updates auth.users on login. Without explicit
-- search_path, the function can fail in Auth's transaction context.
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_sync_to_users ON auth.users;
DROP FUNCTION IF EXISTS auth.sync_auth_user_to_users();
DROP FUNCTION IF EXISTS public.sync_auth_user_to_users();

CREATE OR REPLACE FUNCTION public.sync_auth_user_to_users()
RETURNS TRIGGER AS $$
DECLARE
  has_password_col boolean;
  user_role_value public.user_role;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password_hash'
  ) INTO has_password_col;

  user_role_value := COALESCE(NEW.raw_user_meta_data->>'role', 'site_qs')::public.user_role;

  IF has_password_col THEN
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

CREATE TRIGGER on_auth_user_sync_to_users
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_auth_user_to_users();
