-- Migration: get_auth_user_id_by_email
-- Date: 2026-04-27
-- Description:
--   Helper for Edge Function invite-agent: lookup auth.users.id by email.
--   Used during orphan cleanup — when an invitation was revoked/expired/
--   declined and the admin wants to re-invite the same email, we need to
--   delete the lingering auth.users row first. Direct query via SQL is
--   more reliable than `auth.admin.listUsers` paging.

CREATE OR REPLACE FUNCTION public.get_auth_user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.get_auth_user_id_by_email(TEXT) IS
  'Returns auth.users.id for the given email (case-insensitive) or NULL. Used by invite-agent Edge Function for orphan cleanup. Service-role only — not granted to anon/authenticated.';

REVOKE EXECUTE ON FUNCTION public.get_auth_user_id_by_email(TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_user_id_by_email(TEXT) TO service_role;
