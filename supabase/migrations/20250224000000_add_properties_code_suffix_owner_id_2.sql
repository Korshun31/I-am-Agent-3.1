-- Add columns for "house in resort": internal code suffix and second owner.
-- Run this in Supabase Dashboard → SQL Editor.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS code_suffix text,
  ADD COLUMN IF NOT EXISTS owner_id_2 uuid REFERENCES contacts(id) ON DELETE SET NULL;

COMMENT ON COLUMN properties.code_suffix IS 'Internal house code within resort, e.g. 72-А';
COMMENT ON COLUMN properties.owner_id_2 IS 'Additional owner (e.g. buyer of one house in the resort)';
