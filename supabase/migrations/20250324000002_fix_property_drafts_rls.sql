-- Исправляем RLS для property_drafts
-- Агент не должен иметь возможность менять status черновика напрямую

-- Удаляем старую политику FOR ALL
DROP POLICY IF EXISTS "property_drafts: agent full access to own" ON property_drafts;

-- SELECT: агент видит свои черновики
CREATE POLICY "property_drafts: agent select own"
  ON property_drafts FOR SELECT
  USING (agent_id = auth.uid());

-- INSERT: агент может создавать черновики только со статусом 'pending'
CREATE POLICY "property_drafts: agent insert own"
  ON property_drafts FOR INSERT
  WITH CHECK (agent_id = auth.uid() AND status = 'pending');

-- UPDATE: агент может обновлять свои черновики (для upsert при повторной отправке),
-- но результирующий статус всегда должен быть 'pending'
CREATE POLICY "property_drafts: agent update own"
  ON property_drafts FOR UPDATE
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid() AND status = 'pending');

-- DELETE: агент не может удалять черновики
