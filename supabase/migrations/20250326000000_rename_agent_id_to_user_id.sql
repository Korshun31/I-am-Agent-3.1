ALTER TABLE company_members RENAME COLUMN agent_id TO user_id;
ALTER INDEX IF EXISTS idx_company_members_agent_id RENAME TO idx_company_members_user_id;

DROP POLICY IF EXISTS "company_members: see own record" ON company_members;
CREATE POLICY "company_members: see own record"
  ON company_members FOR SELECT
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION auth_is_company_member(p_company_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = p_company_id AND user_id = auth.uid()
  );
END;
$$;

ALTER TABLE property_drafts RENAME COLUMN agent_id TO user_id;
ALTER INDEX IF EXISTS idx_property_drafts_agent_id RENAME TO idx_property_drafts_user_id;

DROP POLICY IF EXISTS "property_drafts: agent full access to own" ON property_drafts;
DROP POLICY IF EXISTS "property_drafts: agent can insert" ON property_drafts;
DROP POLICY IF EXISTS "property_drafts: agent can update own pending" ON property_drafts;

CREATE POLICY "property_drafts: agent full access to own"
  ON property_drafts FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
