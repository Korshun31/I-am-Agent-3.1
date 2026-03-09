-- Run this SQL in Supabase SQL Editor to create the location_districts table

CREATE TABLE IF NOT EXISTS location_districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  district text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(location_id, district)
);

ALTER TABLE location_districts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage districts of own locations"
  ON location_districts
  FOR ALL
  USING (
    location_id IN (SELECT id FROM locations WHERE agent_id = auth.uid())
  )
  WITH CHECK (
    location_id IN (SELECT id FROM locations WHERE agent_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_location_districts_location_id ON location_districts(location_id);
