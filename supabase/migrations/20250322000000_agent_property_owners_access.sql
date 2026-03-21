-- Агент может читать контакты собственников объектов, которые ему переданы.
-- Это единственное что нужно — стандартная RLS политика на таблицу contacts.

CREATE POLICY "contacts: agent reads property owners"
  ON contacts FOR SELECT
  USING (
    id IN (
      SELECT owner_id   FROM properties WHERE responsible_agent_id = auth.uid() AND owner_id   IS NOT NULL
      UNION
      SELECT owner_id_2 FROM properties WHERE responsible_agent_id = auth.uid() AND owner_id_2 IS NOT NULL
    )
  );
