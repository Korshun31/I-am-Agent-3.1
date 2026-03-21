-- =============================================================================
-- TEAM FEATURE: Агент видит собственников своих объектов в Контактах
-- =============================================================================
-- Что делает этот файл:
--   1. RPC-функция get_agent_property_owners — возвращает контакты (собственников)
--      объектов, за которые агент ответственен (SECURITY DEFINER обходит RLS)
--   2. RLS-политика на contacts — агент может читать контакты, которые являются
--      собственниками его объектов
-- =============================================================================

-- =============================================================================
-- ФУНКЦИЯ: вернуть контакты-собственники объектов агента
-- =============================================================================
CREATE OR REPLACE FUNCTION get_agent_property_owners()
RETURNS SETOF contacts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  RETURN QUERY
  SELECT DISTINCT c.*
  FROM contacts c
  WHERE c.id IN (
    SELECT owner_id   FROM properties WHERE responsible_agent_id = v_uid AND owner_id   IS NOT NULL
    UNION
    SELECT owner_id_2 FROM properties WHERE responsible_agent_id = v_uid AND owner_id_2 IS NOT NULL
  )
  ORDER BY c.name;
END;
$$;

-- =============================================================================
-- RLS: агент может читать контакты-собственники своих объектов
-- (без этого прямой SELECT contacts WHERE id IN (...) заблокирован RLS)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'contacts'
      AND policyname = 'contacts: agent reads property owners'
  ) THEN
    CREATE POLICY "contacts: agent reads property owners"
      ON contacts FOR SELECT
      USING (
        id IN (
          SELECT owner_id   FROM properties WHERE responsible_agent_id = auth.uid() AND owner_id   IS NOT NULL
          UNION
          SELECT owner_id_2 FROM properties WHERE responsible_agent_id = auth.uid() AND owner_id_2 IS NOT NULL
        )
      );
  END IF;
END;
$$;
