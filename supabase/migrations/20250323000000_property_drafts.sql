-- =============================================================================
-- PROPERTY DRAFTS: система черновиков редактирований объектов
-- =============================================================================
-- Что делает этот файл:
--   1. Создаёт таблицу property_drafts (черновики изменений агентов)
--   2. Включает RLS: агент видит свои, владелец компании видит все своей компании
--   3. Добавляет индексы для быстрого поиска
--   4. Исправляет баг с CHECK constraint в таблице properties
--      (убираем несуществующий статус 'submitted')
-- =============================================================================

-- =============================================================================
-- ШАГ 1: ТАБЛИЦА property_drafts
-- =============================================================================

CREATE TABLE IF NOT EXISTS property_drafts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  agent_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Полный снапшот всех изменённых полей объекта (только то, что агент хочет изменить)
  draft_data        JSONB       NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason  TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  -- Один черновик на пару объект + агент (UPSERT-совместимо)
  UNIQUE(property_id, agent_id)
);

-- =============================================================================
-- ШАГ 2: ИНДЕКСЫ
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_property_drafts_property_id ON property_drafts(property_id);
CREATE INDEX IF NOT EXISTS idx_property_drafts_agent_id    ON property_drafts(agent_id);
CREATE INDEX IF NOT EXISTS idx_property_drafts_status      ON property_drafts(status);

-- =============================================================================
-- ШАГ 3: RLS
-- =============================================================================

ALTER TABLE property_drafts ENABLE ROW LEVEL SECURITY;

-- Агент: полный доступ только к своим черновикам
CREATE POLICY "property_drafts: agent full access to own"
  ON property_drafts FOR ALL
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

-- Владелец компании: SELECT на все черновики объектов своей компании
-- Используем SECURITY DEFINER функцию auth_is_company_owner (уже существует)
-- чтобы избежать бесконечной рекурсии в RLS
CREATE POLICY "property_drafts: owner can read company drafts"
  ON property_drafts FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM properties p
      WHERE p.id = property_drafts.property_id
        AND p.company_id IS NOT NULL
        AND auth_is_company_owner(p.company_id)
    )
  );

-- Владелец компании: UPDATE черновиков своей компании (для одобрения/отклонения)
CREATE POLICY "property_drafts: owner can update company drafts"
  ON property_drafts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM properties p
      WHERE p.id = property_drafts.property_id
        AND p.company_id IS NOT NULL
        AND auth_is_company_owner(p.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM properties p
      WHERE p.id = property_drafts.property_id
        AND p.company_id IS NOT NULL
        AND auth_is_company_owner(p.company_id)
    )
  );

-- =============================================================================
-- ШАГ 4: ИСПРАВЛЕНИЕ БАГА в таблице properties
-- Статус 'submitted' никогда не был в CHECK constraint — удаляем старый и
-- пересоздаём с теми же 4 допустимыми значениями.
-- ВАЖНО: используем DROP IF EXISTS + ADD — безопасно при любом состоянии данных,
-- т.к. 'submitted' в данных не существует (он ломал INSERT ещё раньше).
-- =============================================================================

ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_property_status_check;

ALTER TABLE properties
  ADD CONSTRAINT properties_property_status_check
  CHECK (property_status IN ('draft', 'pending', 'approved', 'rejected'));
