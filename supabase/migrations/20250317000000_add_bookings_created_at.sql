-- Add created_at column if missing, ensure DEFAULT now() for new rows.
-- One-time backfill: for existing bookings with null created_at, set created_at = check_in.
-- Run in Supabase Dashboard → SQL Editor.

-- Add column if it doesn't exist (DEFAULT now() for new inserts)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Ensure DEFAULT now() for new rows (in case column existed without default)
ALTER TABLE bookings ALTER COLUMN created_at SET DEFAULT now();

-- One-time backfill: set created_at = check_in where created_at is null
UPDATE bookings
SET created_at = check_in::timestamptz
WHERE created_at IS NULL AND check_in IS NOT NULL;
