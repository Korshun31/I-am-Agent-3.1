-- =============================================================================
-- Simplify role model: remove 'worker', keep only 'admin' and 'agent'
--
-- Decision: team roles are now exclusively admin | agent.
-- Solo/self-registered users = admin of their own company.
-- Invited company members = agent.
--
-- Migration steps:
--   1. Migrate any existing role='worker' rows -> 'admin'
--   2. Drop the Phase-1 canonical check (which allowed admin|worker|agent)
--   3. Add the final check:  role IN ('admin', 'agent')
--
-- Idempotent: safe to re-run.
-- Rollback notes at bottom.
-- =============================================================================

-- STEP 1: Migrate any worker rows to admin (may be zero rows in prod).
UPDATE company_members SET role = 'admin' WHERE role = 'worker';

-- STEP 2: Drop Phase-1 canonical check constraint (if it exists).
DO $$
DECLARE
  v_con TEXT;
BEGIN
  SELECT conname INTO v_con
  FROM pg_constraint
  WHERE conrelid = 'public.company_members'::regclass
    AND contype  = 'c'
    AND pg_get_constraintdef(oid) LIKE '%worker%'
  LIMIT 1;

  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.company_members DROP CONSTRAINT %I', v_con);
    RAISE NOTICE 'Dropped worker-era check constraint: %', v_con;
  ELSE
    RAISE NOTICE 'No worker-era check constraint found — already clean.';
  END IF;
END $$;

-- STEP 3: Add final simplified check constraint (idempotent guard).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.company_members'::regclass
      AND contype  = 'c'
      AND pg_get_constraintdef(oid) = 'CHECK (role = ANY (ARRAY[''admin''::text, ''agent''::text]))'
  ) THEN
    -- Also drop any other role check that might exist before adding the final one.
    DECLARE
      v_old TEXT;
    BEGIN
      FOR v_old IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'public.company_members'::regclass
          AND contype  = 'c'
          AND pg_get_constraintdef(oid) LIKE '%role%'
      LOOP
        EXECUTE format('ALTER TABLE public.company_members DROP CONSTRAINT IF EXISTS %I', v_old);
        RAISE NOTICE 'Dropped stale role check: %', v_old;
      END LOOP;
    END;

    ALTER TABLE public.company_members
      ADD CONSTRAINT company_members_role_check
      CHECK (role IN ('admin', 'agent'));
    RAISE NOTICE 'Added final role check: (admin, agent).';
  ELSE
    RAISE NOTICE 'Final role check already present — skipping.';
  END IF;
END $$;

-- =============================================================================
-- ROLLBACK NOTES:
--   UPDATE company_members SET role = 'worker' WHERE ... (manual, no rollback path)
--   ALTER TABLE company_members DROP CONSTRAINT company_members_role_check;
--   ALTER TABLE company_members
--     ADD CONSTRAINT company_members_role_canonical_check
--     CHECK (role IN ('admin', 'worker', 'agent'));
-- =============================================================================
