-- Migration: copy districts from properties to location_districts
-- Run this ONCE in Supabase SQL Editor AFTER location_districts table exists.
-- Ensures all districts from existing properties are available in location_districts.

INSERT INTO location_districts (location_id, district)
SELECT DISTINCT p.location_id, trim(p.district)
FROM properties p
WHERE p.location_id IS NOT NULL
  AND p.district IS NOT NULL
  AND trim(p.district) <> ''
ON CONFLICT (location_id, district) DO NOTHING;
