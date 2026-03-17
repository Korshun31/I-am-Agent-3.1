-- Add role column to agents
-- Roles: 'standard' (default for new users), 'premium', 'admin' (only for owner)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'standard';

-- Set admin role for owner
UPDATE agents SET role = 'admin' WHERE email = 'korshun31@list.ru';
