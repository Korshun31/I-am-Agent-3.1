-- RLS политика DELETE для таблицы properties
-- Удалять может:
-- 1. Boss (одиночный пользователь) — создатель объекта (agent_id = текущий пользователь)
-- 2. Admin (владелец компании) — может удалять любой объект своей компании
-- Agent — не может удалять никогда (не попадает ни под одно условие)

CREATE POLICY "properties: owner can delete"
  ON properties FOR DELETE
  USING (
    agent_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = properties.company_id
        AND companies.owner_id = auth.uid()
    )
  );
