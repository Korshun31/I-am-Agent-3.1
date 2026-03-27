-- =============================================================================
-- contacts + calendar_events: company-first RLS
-- Applied manually to prod. This migration documents the state.
-- All steps are idempotent (DROP IF EXISTS / CREATE POLICY).
-- =============================================================================
-- Contact Access Contract:
--   owner/admin : full CRUD on all contacts in their company
--   agent       : read own created contacts (user_id = auth.uid())
--   agent       : read property owners of managed properties (owner_id / owner_id_2)
--   agent       : write (insert/update/delete) own contacts WITHIN own company only
--   agent       : cannot read other agents' clients by default
-- Write scope: user_id = auth.uid() AND membership in the contact's company.
-- This prevents an agent from writing to a foreign company_id even if crafted manually.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- contacts — drop legacy policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can manage own contacts"              ON contacts;
DROP POLICY IF EXISTS "contacts: user full access"                 ON contacts;
DROP POLICY IF EXISTS "contacts: agent full access"                ON contacts;

-- ---------------------------------------------------------------------------
-- contacts — company-first policies
-- ---------------------------------------------------------------------------

-- Owner: full CRUD on all contacts belonging to their company
DROP POLICY IF EXISTS "contacts: owner full access to company" ON contacts;
CREATE POLICY "contacts: owner full access to company"
  ON contacts FOR ALL
  USING  (auth_is_company_owner(company_id))
  WITH CHECK (auth_is_company_owner(company_id));

-- Agent: read own contacts
DROP POLICY IF EXISTS "contacts: agent read own" ON contacts;
CREATE POLICY "contacts: agent read own"
  ON contacts FOR SELECT
  USING (user_id = auth.uid());

-- Agent: write (insert / update / delete) own contacts — company-scoped
DROP POLICY IF EXISTS "contacts: agent write own" ON contacts;
CREATE POLICY "contacts: agent write own"
  ON contacts FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (auth_is_company_owner(company_id) OR auth_is_company_member(company_id))
  );

DROP POLICY IF EXISTS "contacts: agent update own" ON contacts;
CREATE POLICY "contacts: agent update own"
  ON contacts FOR UPDATE
  USING  (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (auth_is_company_owner(company_id) OR auth_is_company_member(company_id))
  );

DROP POLICY IF EXISTS "contacts: agent delete own" ON contacts;
CREATE POLICY "contacts: agent delete own"
  ON contacts FOR DELETE
  USING (
    user_id = auth.uid()
    AND (auth_is_company_owner(company_id) OR auth_is_company_member(company_id))
  );

-- Agent: read property owners for properties they manage
-- (policy from 20250322000000_agent_property_owners_access.sql is kept as-is)
-- Recreate idempotently in case it drifted:
DROP POLICY IF EXISTS "contacts: agent reads property owners" ON contacts;
CREATE POLICY "contacts: agent reads property owners"
  ON contacts FOR SELECT
  USING (
    id IN (
      SELECT owner_id   FROM properties WHERE responsible_agent_id = auth.uid() AND owner_id   IS NOT NULL
      UNION
      SELECT owner_id_2 FROM properties WHERE responsible_agent_id = auth.uid() AND owner_id_2 IS NOT NULL
    )
  );

-- ---------------------------------------------------------------------------
-- calendar_events — drop legacy policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can manage own calendar_events"       ON calendar_events;
DROP POLICY IF EXISTS "calendar_events: user full access"          ON calendar_events;
DROP POLICY IF EXISTS "calendar_events: agent full access"         ON calendar_events;

-- ---------------------------------------------------------------------------
-- calendar_events — company-first policies
-- ---------------------------------------------------------------------------

-- Owner: full CRUD on all events in their company
DROP POLICY IF EXISTS "calendar_events: owner full access to company" ON calendar_events;
CREATE POLICY "calendar_events: owner full access to company"
  ON calendar_events FOR ALL
  USING  (auth_is_company_owner(company_id))
  WITH CHECK (auth_is_company_owner(company_id));

-- Agent: read own events (no company scope needed — user_id alone is safe for SELECT)
DROP POLICY IF EXISTS "calendar_events: agent own"       ON calendar_events;
DROP POLICY IF EXISTS "calendar_events: agent read own"  ON calendar_events;
CREATE POLICY "calendar_events: agent read own"
  ON calendar_events FOR SELECT
  USING (user_id = auth.uid());

-- Agent: write own events — company-scoped to prevent cross-company inserts
DROP POLICY IF EXISTS "calendar_events: agent write own" ON calendar_events;
CREATE POLICY "calendar_events: agent write own"
  ON calendar_events FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (auth_is_company_owner(company_id) OR auth_is_company_member(company_id))
  );

DROP POLICY IF EXISTS "calendar_events: agent update own" ON calendar_events;
CREATE POLICY "calendar_events: agent update own"
  ON calendar_events FOR UPDATE
  USING  (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (auth_is_company_owner(company_id) OR auth_is_company_member(company_id))
  );

DROP POLICY IF EXISTS "calendar_events: agent delete own" ON calendar_events;
CREATE POLICY "calendar_events: agent delete own"
  ON calendar_events FOR DELETE
  USING (
    user_id = auth.uid()
    AND (auth_is_company_owner(company_id) OR auth_is_company_member(company_id))
  );
