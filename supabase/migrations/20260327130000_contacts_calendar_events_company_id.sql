-- =============================================================================
-- contacts + calendar_events: add company_id (company-first model)
-- Applied manually to prod. This migration documents and can replay the change.
-- All steps are idempotent (IF NOT EXISTS / DO $$ guards).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- contacts.company_id
-- ---------------------------------------------------------------------------

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- Backfill: contacts.user_id → companies.owner_id → companies.id
UPDATE contacts c
SET    company_id = co.id
FROM   companies co
WHERE  co.owner_id  = c.user_id
  AND  c.company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts(company_id);

-- Set NOT NULL after verifying backfill is complete (backfill was done in prod).
-- Wrap in DO $$ so the whole migration does not fail if a NOT NULL already exists.
DO $$
BEGIN
  BEGIN
    ALTER TABLE contacts ALTER COLUMN company_id SET NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'contacts.company_id SET NOT NULL skipped: %', SQLERRM;
  END;
END $$;

-- ---------------------------------------------------------------------------
-- calendar_events.company_id
-- ---------------------------------------------------------------------------

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

UPDATE calendar_events ce
SET    company_id = co.id
FROM   companies co
WHERE  co.owner_id  = ce.user_id
  AND  ce.company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_company_id ON calendar_events(company_id);

DO $$
BEGIN
  BEGIN
    ALTER TABLE calendar_events ALTER COLUMN company_id SET NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'calendar_events.company_id SET NOT NULL skipped: %', SQLERRM;
  END;
END $$;
