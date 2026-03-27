-- =============================================================================
-- properties: RLS cleanup — remove legacy single-user and redundant team policies
-- Applied manually to prod. This migration documents the state.
-- All steps are idempotent (DROP IF EXISTS).
-- [SAFETY HOTFIX 2026-03-27] INSERT policy is company-scoped:
--   user_id = auth.uid() AND (owner OR member of company_id)
-- =============================================================================
-- Policies REMOVED:
--   "Agents can read own properties"              — superseded by company-first SELECT
--   "Agents can insert own properties"            — superseded by company-first INSERT
--   "Agents can update own properties"            — superseded by "properties: agent update own"
--   "Agents can delete own properties"            — superseded by "properties: owner can delete"
--   "team_members_read_company_properties"        — superseded by company-first SELECT
--   "team_members_insert_company_properties"      — superseded by company-first INSERT
-- Policies KEPT (recreated idempotently below):
--   "properties: owner reads company"             — owner sees all company properties
--   "properties: agent reads own and assigned"    — agent sees own + responsible
--   "properties: agent update own"                — agent writes own (can_edit_info check)
--   "properties: responsible agent can update"    — responsible agent writes assigned
--   "properties: owner can delete"                — only owner/creator can delete
--   "company_owner_update_submitted_properties"   — draft approval flow
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Drop legacy policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Agents can read own properties"              ON properties;
DROP POLICY IF EXISTS "Agents can insert own properties"            ON properties;
DROP POLICY IF EXISTS "Agents can update own properties"            ON properties;
DROP POLICY IF EXISTS "Agents can delete own properties"            ON properties;
DROP POLICY IF EXISTS "team_members_read_company_properties"        ON properties;
DROP POLICY IF EXISTS "team_members_insert_company_properties"      ON properties;

-- ---------------------------------------------------------------------------
-- Company-first SELECT policies
-- ---------------------------------------------------------------------------

-- Owner reads all properties of their company
DROP POLICY IF EXISTS "properties: owner reads company" ON properties;
CREATE POLICY "properties: owner reads company"
  ON properties FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id       = properties.company_id
        AND c.owner_id = auth.uid()
    )
  );

-- Agent reads own (created) properties + properties they are responsible for
DROP POLICY IF EXISTS "properties: agent reads own and assigned" ON properties;
CREATE POLICY "properties: agent reads own and assigned"
  ON properties FOR SELECT
  USING (
    user_id              = auth.uid()
    OR responsible_agent_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- Company-first INSERT policy
-- ---------------------------------------------------------------------------

-- Owner/agent inserts within their own company — company scope prevents cross-company writes
DROP POLICY IF EXISTS "properties: owner or agent can insert" ON properties;
CREATE POLICY "properties: owner or agent can insert"
  ON properties FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (auth_is_company_owner(company_id) OR auth_is_company_member(company_id))
  );

-- ---------------------------------------------------------------------------
-- Keep/recreate UPDATE policies
-- ---------------------------------------------------------------------------

-- Agent updates own properties; responsible agent updates assigned (with can_edit_info)
DROP POLICY IF EXISTS "properties: agent update own" ON properties;
CREATE POLICY "properties: agent update own"
  ON properties FOR UPDATE
  USING (
    user_id = auth.uid()
    OR (
      responsible_agent_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM company_members cm
        WHERE cm.user_id    = auth.uid()
          AND cm.status     = 'active'
          AND (cm.permissions->>'can_edit_info')::boolean = true
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (
      responsible_agent_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM company_members cm
        WHERE cm.user_id    = auth.uid()
          AND cm.status     = 'active'
          AND (cm.permissions->>'can_edit_info')::boolean = true
      )
    )
  );

-- Responsible agent can update any field on assigned property (broader than above)
DROP POLICY IF EXISTS "properties: responsible agent can update" ON properties;
CREATE POLICY "properties: responsible agent can update"
  ON properties FOR UPDATE
  USING  (responsible_agent_id = auth.uid())
  WITH CHECK (responsible_agent_id = auth.uid());

-- Owner approves / rejects submitted (pending) properties
DROP POLICY IF EXISTS "company_owner_update_submitted_properties"         ON properties;
DROP POLICY IF EXISTS "properties: team member update own submitted"      ON properties;
CREATE POLICY "properties: owner approves submitted"
  ON properties FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id       = properties.company_id
        AND c.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id       = properties.company_id
        AND c.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Keep DELETE policy (already created in 20250325000001; recreate idempotently)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "properties: owner can delete" ON properties;
CREATE POLICY "properties: owner can delete"
  ON properties FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id       = properties.company_id
        AND c.owner_id = auth.uid()
    )
  );
