DROP FUNCTION IF EXISTS get_company_team(uuid);
CREATE OR REPLACE FUNCTION get_company_team(p_company_id UUID)
RETURNS TABLE (
  member_id   UUID,
  user_id     UUID,
  role        TEXT,
  joined_at   TIMESTAMPTZ,
  name        TEXT,
  last_name   TEXT,
  email       TEXT,
  photo_url   TEXT,
  permissions JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cm.id          AS member_id,
    cm.user_id,
    cm.role,
    cm.joined_at,
    a.name,
    a.last_name,
    a.email,
    a.photo_url,
    cm.permissions
  FROM company_members cm
  JOIN agents a ON a.id = cm.user_id
  WHERE cm.company_id = p_company_id
  ORDER BY cm.joined_at ASC;
END;
$$;
