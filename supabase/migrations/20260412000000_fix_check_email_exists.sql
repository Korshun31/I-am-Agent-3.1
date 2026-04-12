-- Fix: check_email_exists referenced dropped table "agents" instead of "users_profile"
-- The table was renamed in commit 04752c6 (2026-04-10) but this DB function was not updated.
-- Fixed manually in live DB on 2026-04-12, this migration captures the fix.

CREATE OR REPLACE FUNCTION check_email_exists(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users_profile WHERE lower(email) = lower(p_email)
  );
END;
$$;
