-- =============================================================================
-- Rule lock: agent delete is allowed ONLY when:
--   1) agent is creator (user_id = auth.uid())
--   2) property is NOT approved (property_status <> 'approved')
--
-- Admin (company owner) delete is unchanged: can delete any company property.
--
-- Replaces legacy "properties: owner can delete" policy which used the
-- pre-rename column name (agent_id) and had no status restriction.
-- All steps are idempotent.
-- =============================================================================

DROP POLICY IF EXISTS "properties: owner can delete"             ON properties;
DROP POLICY IF EXISTS "properties: company owner can delete"     ON properties;
DROP POLICY IF EXISTS "properties: agent can delete own non-approved" ON properties;

-- Admin (company owner): can delete any property that belongs to their company.
CREATE POLICY "properties: company owner can delete"
  ON properties FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id  = properties.company_id
        AND companies.owner_id = auth.uid()
    )
  );

-- Agent: can delete only their own non-approved property.
-- coalesce guards NULL status rows (treat missing status as 'approved' → deny).
CREATE POLICY "properties: agent can delete own non-approved"
  ON properties FOR DELETE
  USING (
    user_id = auth.uid()
    AND coalesce(property_status, 'approved') <> 'approved'
  );
