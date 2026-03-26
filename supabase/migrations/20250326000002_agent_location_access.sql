CREATE TABLE IF NOT EXISTS agent_location_access (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(location_id, user_id)
);

ALTER TABLE agent_location_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_location_access: admin full access"
  ON agent_location_access FOR ALL
  USING (auth_is_company_owner(company_id))
  WITH CHECK (auth_is_company_owner(company_id));

CREATE POLICY "agent_location_access: agent read own"
  ON agent_location_access FOR SELECT
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_agent_location_access_user_id
  ON agent_location_access(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_location_access_location_id
  ON agent_location_access(location_id);
