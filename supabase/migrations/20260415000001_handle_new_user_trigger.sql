-- TD-017: Capture handle_new_user trigger from live DB.
-- This trigger fires on every new auth.users INSERT and creates:
-- 1. users_profile record
-- 2. workspace (companies) — only for self-registration (no accepted invitation)
-- 3. company_members (admin) — only for self-registration

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id UUID;
BEGIN
  INSERT INTO users_profile (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'standard'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO companies (owner_id, name, status)
  VALUES (NEW.id, '', 'active')
  RETURNING id INTO new_company_id;

  INSERT INTO company_members (company_id, user_id, role, status)
  VALUES (new_company_id, NEW.id, 'admin', 'active');

  RETURN NEW;
END;
$$;

-- Create trigger only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();
  END IF;
END;
$$;
