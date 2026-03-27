-- =============================================================================
-- bookings: rename agent_id → user_id + add company_id + company-first RLS
-- Applied manually to prod. This migration documents the state.
-- All steps are idempotent.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Step 1: rename bookings.agent_id → user_id (idempotent)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'bookings'
      AND column_name  = 'agent_id'
  ) THEN
    ALTER TABLE bookings RENAME COLUMN agent_id TO user_id;
    RAISE NOTICE 'bookings.agent_id renamed to user_id';
  ELSE
    RAISE NOTICE 'bookings.user_id already exists — skip rename';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'bookings' AND indexname = 'idx_bookings_agent_id'
  ) THEN
    ALTER INDEX idx_bookings_agent_id RENAME TO idx_bookings_user_id;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Step 2: add bookings.company_id (idempotent)
-- ---------------------------------------------------------------------------

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- Backfill via properties.company_id (bookings.property_id → properties.company_id)
UPDATE bookings b
SET    company_id = p.company_id
FROM   properties p
WHERE  p.id            = b.property_id
  AND  b.company_id    IS NULL
  AND  p.company_id    IS NOT NULL;

-- Fallback: backfill solo users (owner created bookings, no company_id on property yet)
UPDATE bookings b
SET    company_id = co.id
FROM   companies co
WHERE  co.owner_id    = b.user_id
  AND  b.company_id   IS NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_company_id ON bookings(company_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id    ON bookings(user_id);

-- Enforce NOT NULL after backfill (guard: skip if already NOT NULL or if rare tails remain)
DO $$
BEGIN
  -- Only enforce if every row has company_id filled
  IF NOT EXISTS (SELECT 1 FROM bookings WHERE company_id IS NULL) THEN
    BEGIN
      ALTER TABLE bookings ALTER COLUMN company_id SET NOT NULL;
      RAISE NOTICE 'bookings.company_id SET NOT NULL enforced';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'bookings.company_id SET NOT NULL skipped: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'bookings.company_id NOT NULL skipped — NULL rows still present (run backfill first)';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Step 3: drop legacy policies (including any previous FOR ALL agent policy)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can manage own bookings"                    ON bookings;
DROP POLICY IF EXISTS "team_members_read_company_bookings"               ON bookings;
DROP POLICY IF EXISTS "team_members_insert_company_bookings"             ON bookings;
DROP POLICY IF EXISTS "bookings: user full access"                       ON bookings;
DROP POLICY IF EXISTS "bookings: agent own"                              ON bookings;

-- ---------------------------------------------------------------------------
-- Step 4: company-first policies (aligned with prod final state)
-- ---------------------------------------------------------------------------

-- 1) Owner: full CRUD on all company bookings
DROP POLICY IF EXISTS "bookings: owner full access to company" ON bookings;
CREATE POLICY "bookings: owner full access to company"
  ON bookings FOR ALL
  USING  (auth_is_company_owner(company_id))
  WITH CHECK (auth_is_company_owner(company_id));

-- 2) Company member (any active member): read all bookings in the company
DROP POLICY IF EXISTS "bookings: company member read" ON bookings;
CREATE POLICY "bookings: company member read"
  ON bookings FOR SELECT
  USING (auth_is_company_member(company_id));

-- 3) Agent: read bookings for properties where they are responsible
DROP POLICY IF EXISTS "bookings: agent reads assigned property bookings" ON bookings;
CREATE POLICY "bookings: agent reads assigned property bookings"
  ON bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id                   = bookings.property_id
        AND p.responsible_agent_id = auth.uid()
    )
  );

-- 4) Agent: read own bookings
DROP POLICY IF EXISTS "bookings: agent read own" ON bookings;
CREATE POLICY "bookings: agent read own"
  ON bookings FOR SELECT
  USING (user_id = auth.uid());

-- 5) Agent: insert own bookings — company-scoped
DROP POLICY IF EXISTS "bookings: agent insert own" ON bookings;
CREATE POLICY "bookings: agent insert own"
  ON bookings FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (auth_is_company_owner(company_id) OR auth_is_company_member(company_id))
  );

-- 6) Agent: update own bookings — company-scoped
DROP POLICY IF EXISTS "bookings: agent update own" ON bookings;
CREATE POLICY "bookings: agent update own"
  ON bookings FOR UPDATE
  USING  (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (auth_is_company_owner(company_id) OR auth_is_company_member(company_id))
  );

-- 7) Agent: delete own bookings — company-scoped
DROP POLICY IF EXISTS "bookings: agent delete own" ON bookings;
CREATE POLICY "bookings: agent delete own"
  ON bookings FOR DELETE
  USING (
    user_id = auth.uid()
    AND (auth_is_company_owner(company_id) OR auth_is_company_member(company_id))
  );
