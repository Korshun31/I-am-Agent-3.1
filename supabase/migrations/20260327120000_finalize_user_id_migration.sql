-- Finalize migration: company_members/property_drafts agent_id -> user_id

DO $$
DECLARE
  fn_sql text;
BEGIN
  -- join_company_via_invitation
  SELECT pg_get_functiondef(p.oid)
    INTO fn_sql
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'join_company_via_invitation'
  LIMIT 1;

  IF fn_sql IS NOT NULL THEN
    fn_sql := replace(fn_sql, 'agent_id', 'user_id');
    EXECUTE fn_sql;
  END IF;

  -- auto_set_property_company
  SELECT pg_get_functiondef(p.oid)
    INTO fn_sql
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'auto_set_property_company'
  LIMIT 1;

  IF fn_sql IS NOT NULL THEN
    fn_sql := replace(fn_sql, 'agent_id', 'user_id');
    EXECUTE fn_sql;
  END IF;
END $$;
