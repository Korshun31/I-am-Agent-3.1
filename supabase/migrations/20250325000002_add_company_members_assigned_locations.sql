ALTER TABLE company_members ADD COLUMN IF NOT EXISTS assigned_location_ids UUID[] DEFAULT '{}';
