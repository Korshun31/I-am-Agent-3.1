-- Обновляем RLS политику UPDATE для properties
-- Агент может обновлять объект только если у него есть разрешение can_edit_info

DROP POLICY IF EXISTS "properties: agent update own" ON properties;

CREATE POLICY "properties: agent update own"
  ON properties FOR UPDATE
  USING (
    agent_id = auth.uid()
    OR (
      responsible_agent_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM company_members
        WHERE agent_id = auth.uid()
        AND (permissions->>'can_edit_info')::boolean = true
      )
    )
  )
  WITH CHECK (
    agent_id = auth.uid()
    OR (
      responsible_agent_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM company_members
        WHERE agent_id = auth.uid()
        AND (permissions->>'can_edit_info')::boolean = true
      )
    )
  );
