-- =============================================================================
-- Phase 1: Canonical plan/role vocabulary alignment (non-breaking)
--
-- Changes:
--   1. agents.plan           — new canonical billing plan column
--   2. company_members.status — add missing status column (fixes auth bug)
--   3. company_members.role  — expand check: owner→admin, add worker
--   4. Safety indexes
--
-- Backward compat: agents.role kept (not dropped); teamMembership unchanged.
-- Rollback notes at bottom.
-- =============================================================================

-- ============================================================================
-- PART 1: agents.plan  — canonical billing plan
--   Values: 'standard' | 'premium' | 'korshun'
--   Backfill from agents.role: standard->standard, premium->premium, admin->korshun
--   agents.role is kept as legacy field (Phase 2 may drop it).
-- ============================================================================

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'standard'
    CHECK (plan IN ('standard', 'premium', 'korshun'));

-- Backfill: only update rows that don't match canonical mapping (idempotent).
UPDATE agents SET plan = 'korshun'  WHERE role = 'admin'   AND plan <> 'korshun';
UPDATE agents SET plan = 'premium'  WHERE role = 'premium' AND plan <> 'premium';
-- role='standard' -> plan='standard' (already the DEFAULT, no action needed).

-- ============================================================================
-- PART 2: company_members.status  — add if missing
--   CRITICAL: this column was missing from all previous migrations.
--   authService queried .eq('status','active') which caused a silent PostgREST
--   error — membershipData always returned null, breaking team membership detection.
--   Adding with DEFAULT 'active' so all existing rows become active.
-- ============================================================================

ALTER TABLE company_members
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive'));

-- ============================================================================
-- PART 3: company_members.role  — expand check constraint
--   Old values: ('owner', 'agent')   <- 'owner' is retired
--   New values: ('admin', 'worker', 'agent')
--
--   Mapping: owner -> admin
-- ============================================================================

-- Step 3a: Drop old check constraint that references 'owner'
DO $$
DECLARE
  v_con TEXT;
BEGIN
  SELECT conname INTO v_con
  FROM pg_constraint
  WHERE conrelid = 'public.company_members'::regclass
    AND contype  = 'c'
    AND pg_get_constraintdef(oid) LIKE '%owner%'
  LIMIT 1;

  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.company_members DROP CONSTRAINT %I', v_con);
    RAISE NOTICE 'Dropped legacy role check constraint: %', v_con;
  ELSE
    RAISE NOTICE 'Legacy role check (with owner) not found — already cleaned up.';
  END IF;
END $$;

-- Step 3b: Migrate legacy 'owner' rows to canonical 'admin'
UPDATE company_members SET role = 'admin' WHERE role = 'owner';

-- Step 3c: Add canonical check constraint (idempotent guard)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.company_members'::regclass
      AND contype  = 'c'
      AND pg_get_constraintdef(oid) LIKE '%admin%'
      AND pg_get_constraintdef(oid) LIKE '%worker%'
  ) THEN
    ALTER TABLE public.company_members
      ADD CONSTRAINT company_members_role_canonical_check
      CHECK (role IN ('admin', 'worker', 'agent'));
    RAISE NOTICE 'Added canonical role check: (admin, worker, agent).';
  ELSE
    RAISE NOTICE 'Canonical role check already present — skipping.';
  END IF;
END $$;

-- ============================================================================
-- PART 4: Safety indexes
-- ============================================================================

-- Compound covering index for membership lookups by user + role + status
CREATE INDEX IF NOT EXISTS idx_company_members_user_role_status
  ON company_members(user_id, role, status);

-- ============================================================================
-- ROLLBACK NOTES (manual steps if needed):
--
--   ALTER TABLE agents DROP COLUMN IF EXISTS plan;
--
--   ALTER TABLE company_members DROP COLUMN IF EXISTS status;
--
--   UPDATE company_members SET role = 'owner' WHERE role = 'admin';
--   ALTER TABLE company_members
--     DROP CONSTRAINT IF EXISTS company_members_role_canonical_check;
--   ALTER TABLE company_members
--     ADD CONSTRAINT company_members_role_check
--     CHECK (role IN ('owner', 'agent'));
--
--   DROP INDEX IF EXISTS idx_company_members_user_role_status;
-- ============================================================================
