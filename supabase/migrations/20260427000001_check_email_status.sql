-- Migration: check_email_status
-- Date: 2026-04-27
-- Description:
--   Helper function for invite-agent Edge Function.
--   Returns email registration state in one call:
--     'occupied' — email exists in public.users_profile (regular registered user)
--     'orphan'   — email exists only in auth.users (auth account without profile)
--     'free'     — email not registered anywhere
--
--   Edge Function uses this to decide whether to allow sending an invitation:
--     'free'     → proceed
--     'occupied' → reject with EMAIL_OCCUPIED
--     'orphan'   → reject with EMAIL_OCCUPIED_ORPHAN (admin should ask agent for different email)

CREATE OR REPLACE FUNCTION public.check_email_status(p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_lc  TEXT;
  has_profile BOOLEAN;
  has_auth    BOOLEAN;
BEGIN
  v_email_lc := lower(trim(p_email));

  IF v_email_lc IS NULL OR length(v_email_lc) = 0 THEN
    RAISE EXCEPTION 'Empty email';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.users_profile
    WHERE lower(email) = v_email_lc
  ) INTO has_profile;

  IF has_profile THEN
    RETURN 'occupied';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE lower(email) = v_email_lc
  ) INTO has_auth;

  IF has_auth THEN
    RETURN 'orphan';
  END IF;

  RETURN 'free';
END;
$$;

COMMENT ON FUNCTION public.check_email_status(TEXT) IS
  'Returns email registration status: free / occupied (in users_profile) / orphan (in auth.users only). Used by invite-agent Edge Function.';
