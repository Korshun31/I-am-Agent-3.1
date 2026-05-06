-- TD-027: Rate limiting for invitation secret code verification.
-- Adds attempts counter to company_invitations.
-- After 5 failed attempts, invitation is automatically revoked.

-- 1. Add attempts column
ALTER TABLE company_invitations
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

-- 2. Replace verify_invitation_secret with rate-limited version
CREATE OR REPLACE FUNCTION verify_invitation_secret(p_token UUID, p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation_id UUID;
  v_current_attempts INTEGER;
BEGIN
  -- Check invitation exists and is still valid
  SELECT id, attempts INTO v_invitation_id, v_current_attempts
  FROM company_invitations
  WHERE invite_token = p_token
    AND status IN ('sent', 'pending')
    AND expires_at > now();

  IF v_invitation_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if max attempts reached
  IF v_current_attempts >= 5 THEN
    -- Auto-revoke
    UPDATE company_invitations
    SET status = 'revoked'
    WHERE id = v_invitation_id;
    RETURN FALSE;
  END IF;

  -- Check code
  IF NOT EXISTS (
    SELECT 1 FROM company_invitations
    WHERE id = v_invitation_id
      AND secret_code = p_code
  ) THEN
    -- Wrong code — increment attempts
    UPDATE company_invitations
    SET attempts = attempts + 1
    WHERE id = v_invitation_id;

    -- If this was the 5th attempt, also revoke
    IF v_current_attempts + 1 >= 5 THEN
      UPDATE company_invitations
      SET status = 'revoked'
      WHERE id = v_invitation_id;
    END IF;

    RETURN FALSE;
  END IF;

  -- Code correct — accept invitation, reset attempts
  UPDATE company_invitations
  SET status = 'accepted', attempts = 0
  WHERE id = v_invitation_id;

  RETURN TRUE;
END;
$$;
