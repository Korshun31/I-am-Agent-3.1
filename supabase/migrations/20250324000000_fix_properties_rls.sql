-- Обновляем RLS политику UPDATE для таблицы properties
-- Агент должен иметь право обновлять объекты где он является responsible_agent_id

DROP POLICY IF EXISTS "properties: agent update own" ON properties;

CREATE POLICY "properties: agent update own"
  ON properties FOR UPDATE
  USING (
    agent_id = auth.uid()
    OR responsible_agent_id = auth.uid()
  )
  WITH CHECK (
    agent_id = auth.uid()
    OR responsible_agent_id = auth.uid()
  );
