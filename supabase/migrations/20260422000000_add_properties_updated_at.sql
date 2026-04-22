-- Add updated_at column + auto-update trigger to properties.
-- Context: website sync (dataUploadService.js) requires updated_at for sort order.
-- Closes TD-007. Supersedes ADR-002.
-- Applied manually in prod 2026-04-22; this file codifies the steps for repo history and sandbox.

-- 1. Add column (nullable during backfill)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- 2. Backfill existing rows from created_at
UPDATE properties
SET updated_at = COALESCE(created_at, now())
WHERE updated_at IS NULL;

-- 3. Lock it down: default + NOT NULL
ALTER TABLE properties ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE properties ALTER COLUMN updated_at SET NOT NULL;

-- 4. Auto-update function
CREATE OR REPLACE FUNCTION properties_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Attach trigger (idempotent)
DROP TRIGGER IF EXISTS trg_properties_set_updated_at ON properties;

CREATE TRIGGER trg_properties_set_updated_at
BEFORE UPDATE ON properties
FOR EACH ROW
EXECUTE FUNCTION properties_set_updated_at();
