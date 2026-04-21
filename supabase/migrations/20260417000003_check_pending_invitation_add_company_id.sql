DROP FUNCTION IF EXISTS check_pending_invitation(text);

CREATE OR REPLACE FUNCTION public.check_pending_invitation(p_email TEXT)
RETURNS TABLE (
  company_name TEXT,
  invite_token UUID,
  company_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT c.name, ci.invite_token, ci.company_id
  FROM company_invitations ci
  JOIN companies c ON c.id = ci.company_id
  WHERE lower(trim(ci.email)) = lower(trim(p_email))
    AND ci.status IN ('sent', 'pending')
    AND ci.expires_at > now()
  LIMIT 1;
END;
$$;
