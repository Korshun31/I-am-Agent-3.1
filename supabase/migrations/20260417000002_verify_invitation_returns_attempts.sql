-- verify_invitation_secret now returns INTEGER:
--   0 = code correct, invitation accepted
--   1-5 = wrong code, N attempts remaining
--   -1 = invitation blocked (5+ attempts) or not found/expired

DROP FUNCTION IF EXISTS verify_invitation_secret(uuid, text);

CREATE OR REPLACE FUNCTION verify_invitation_secret(p_token UUID, p_code TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation_id UUID;
  v_current_attempts INTEGER;
  v_remaining INTEGER;
BEGIN
  SELECT id, attempts INTO v_invitation_id, v_current_attempts
  FROM company_invitations
  WHERE invite_token = p_token
    AND status IN ('sent', 'pending')
    AND expires_at > now();

  IF v_invitation_id IS NULL THEN
    RETURN -1;
  END IF;

  IF v_current_attempts >= 5 THEN
    UPDATE company_invitations
    SET status = 'revoked'
    WHERE id = v_invitation_id;
    RETURN -1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM company_invitations
    WHERE id = v_invitation_id
      AND secret_code = p_code
  ) THEN
    UPDATE company_invitations
    SET attempts = attempts + 1
    WHERE id = v_invitation_id;

    v_remaining := 5 - (v_current_attempts + 1);

    IF v_remaining <= 0 THEN
      UPDATE company_invitations
      SET status = 'revoked'
      WHERE id = v_invitation_id;
      RETURN -1;
    END IF;

    RETURN v_remaining;
  END IF;

  UPDATE company_invitations
  SET status = 'accepted', attempts = 0
  WHERE id = v_invitation_id;

  RETURN 0;
END;
$$;

-- Reset invitation secret code: generates new 6-digit code, resets attempts, sets status back to 'sent'
CREATE OR REPLACE FUNCTION reset_invitation_secret(p_invitation_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_code TEXT;
BEGIN
  v_new_code := lpad(floor(random() * 1000000)::text, 6, '0');

  UPDATE company_invitations
  SET secret_code = v_new_code,
      attempts = 0,
      status = 'sent'
  WHERE id = p_invitation_id;

  RETURN v_new_code;
END;
$$;
