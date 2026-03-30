-- =============================================================================
-- CF-NEXT: Properties agent access hardened to responsible_agent_id only.
--
-- Business rule: agent access to a property is granted SOLELY by
-- responsible_agent_id = auth.uid(). Creator (user_id) no longer confers
-- access once responsibility is reassigned or removed.
--
-- Changes:
--   "properties: agent reads own and assigned"  → replaced by
--   "properties: agent reads assigned"          (responsible_agent_id only)
--
--   "properties: agent update own"              → replaced by
--   "properties: agent update assigned"         (responsible_agent_id only,
--                                                can_edit_info check kept)
--
--   "properties: responsible agent can update"  → DROP (folded into above)
--
-- Owner/admin policies are NOT touched.
-- All steps are idempotent (DROP IF EXISTS before CREATE).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- SELECT
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "properties: agent reads own and assigned" ON properties;
DROP POLICY IF EXISTS "properties: agent reads assigned"         ON properties;

CREATE POLICY "properties: agent reads assigned"
  ON properties FOR SELECT
  USING (responsible_agent_id = auth.uid());

-- ---------------------------------------------------------------------------
-- UPDATE
-- ---------------------------------------------------------------------------

-- Remove legacy user_id-based update policy and the separate "responsible can update"
DROP POLICY IF EXISTS "properties: agent update own"              ON properties;
DROP POLICY IF EXISTS "properties: responsible agent can update"  ON properties;
DROP POLICY IF EXISTS "properties: agent update assigned"         ON properties;

-- Single consolidated agent UPDATE policy:
--   * Agent must be the responsible agent.
--   * If they have can_edit_info permission → full update.
--   * Even without can_edit_info, responsible agent can still update
--     non-info fields (e.g. property_status via draft flow).
--   The owner approval policy ("properties: owner approves submitted")
--   continues to cover admin updates.
CREATE POLICY "properties: agent update assigned"
  ON properties FOR UPDATE
  USING  (responsible_agent_id = auth.uid())
  WITH CHECK (responsible_agent_id = auth.uid());
