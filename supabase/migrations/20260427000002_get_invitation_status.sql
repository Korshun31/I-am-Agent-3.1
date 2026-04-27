-- Migration: get_invitation_status
-- Date: 2026-04-27
-- Description:
--   Public RPC for WebInviteAcceptScreen to detect early if invitation is no
--   longer acceptable (revoked, accepted, expired, not_found). Allows showing
--   a meaningful message before user fills the form.
--
--   Returns one of:
--     'not_found'  — token invalid or invitation row deleted
--     'expired'    — expires_at <= now() AND status != 'accepted'
--     'sent' | 'pending' | 'revoked' | 'accepted' | 'declined' — stored status

CREATE OR REPLACE FUNCTION public.get_invitation_status(p_token UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status  TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  SELECT status, expires_at
    INTO v_status, v_expires
  FROM company_invitations
  WHERE invite_token = p_token;

  IF v_status IS NULL THEN
    RETURN 'not_found';
  END IF;

  -- Final statuses take priority over expiration: admin's revoke or user's
  -- decline should be reported even if the link has also passed its TTL.
  IF v_status IN ('accepted', 'revoked', 'declined') THEN
    RETURN v_status;
  END IF;

  IF v_expires IS NOT NULL AND v_expires <= now() THEN
    RETURN 'expired';
  END IF;

  RETURN v_status;
END;
$$;

COMMENT ON FUNCTION public.get_invitation_status(UUID) IS
  'Returns invitation status by token: sent / pending / revoked / accepted / declined / expired / not_found. Used by WebInviteAcceptScreen to block UI early if invitation cannot be accepted.';

-- Allow both anonymous (no session) and authenticated calls — invitation status
-- check happens before user signs in via magic-link.
GRANT EXECUTE ON FUNCTION public.get_invitation_status(UUID) TO anon, authenticated;
