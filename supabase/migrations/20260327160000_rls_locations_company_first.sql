-- =============================================================================
-- locations + location_districts: company-first RLS
-- Applied manually to prod. This migration documents the state.
-- All steps are idempotent.
-- Design:
--   locations / location_districts are OWNED by the company owner (admin).
--   Agents do NOT write locations directly; they read via agent_location_access.
--   Agents read location_districts via the same join.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- locations — drop legacy "Agents can ..." policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Agents can view own locations"              ON locations;
DROP POLICY IF EXISTS "Agents can read own locations"              ON locations;
DROP POLICY IF EXISTS "Agents can insert own locations"            ON locations;
DROP POLICY IF EXISTS "Agents can update own locations"            ON locations;
DROP POLICY IF EXISTS "Agents can delete own locations"            ON locations;
DROP POLICY IF EXISTS "Agents can manage own locations"            ON locations;
DROP POLICY IF EXISTS "Users can manage own locations"             ON locations;
DROP POLICY IF EXISTS "locations: user full access"                ON locations;

-- ---------------------------------------------------------------------------
-- locations — company-first policies
-- ---------------------------------------------------------------------------

-- Owner: full CRUD on own locations (user_id = auth.uid() for owner-created locations)
DROP POLICY IF EXISTS "locations: owner full access" ON locations;
CREATE POLICY "locations: owner full access"
  ON locations FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Company member (agent): read locations assigned to them via agent_location_access
-- Recreate idempotently (was first applied in prod post-B0).
DROP POLICY IF EXISTS "locations: company member read" ON locations;
CREATE POLICY "locations: company member read"
  ON locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agent_location_access ala
      WHERE ala.location_id = locations.id
        AND ala.user_id     = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- location_districts — drop legacy policies (if any exist)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Agents can view own location_districts"     ON location_districts;
DROP POLICY IF EXISTS "Agents can manage location_districts"       ON location_districts;
DROP POLICY IF EXISTS "Users can manage own location_districts"    ON location_districts;
DROP POLICY IF EXISTS "location_districts: user full access"       ON location_districts;

-- ---------------------------------------------------------------------------
-- location_districts — company-first policies
-- ---------------------------------------------------------------------------

-- Owner: full CRUD on districts of their own locations
DROP POLICY IF EXISTS "location_districts: owner full access" ON location_districts;
CREATE POLICY "location_districts: owner full access"
  ON location_districts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM locations l
      WHERE l.id      = location_districts.location_id
        AND l.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM locations l
      WHERE l.id      = location_districts.location_id
        AND l.user_id = auth.uid()
    )
  );

-- Company member (agent): read districts for their assigned locations
DROP POLICY IF EXISTS "location_districts: company member read" ON location_districts;
CREATE POLICY "location_districts: company member read"
  ON location_districts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agent_location_access ala
      WHERE ala.location_id = location_districts.location_id
        AND ala.user_id     = auth.uid()
    )
  );
