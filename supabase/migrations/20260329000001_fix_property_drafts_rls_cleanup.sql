-- =============================================================================
-- CLEANUP: property_drafts RLS policies
--
-- История проблемы:
--   1) 20250323000000_property_drafts.sql создала политики с agent_id
--   2) 20250324000002_fix_property_drafts_rls.sql создала новые политики
--      "agent select/insert/update own" — тоже с agent_id
--   3) 20250326000000_rename_agent_id_to_user_id.sql переименовала колонку
--      agent_id → user_id, но удалила только часть политик из пункта (2).
--      Политики из пункта (2) остались висеть с неактуальными именами/выражениями.
--
-- Решение: DROP IF EXISTS всех существующих политик (безопасно — не падает
-- если политика не существует), затем создать полный чистый набор.
-- =============================================================================

-- ── Удаляем все возможные варианты agent-политик ─────────────────────────────
DROP POLICY IF EXISTS "property_drafts: agent full access to own"    ON property_drafts;
DROP POLICY IF EXISTS "property_drafts: agent select own"            ON property_drafts;
DROP POLICY IF EXISTS "property_drafts: agent insert own"            ON property_drafts;
DROP POLICY IF EXISTS "property_drafts: agent update own"            ON property_drafts;
DROP POLICY IF EXISTS "property_drafts: agent can insert"            ON property_drafts;
DROP POLICY IF EXISTS "property_drafts: agent can update own pending" ON property_drafts;

-- ── Удаляем owner-политики (пересоздадим ниже явно) ─────────────────────────
DROP POLICY IF EXISTS "property_drafts: owner can read company drafts"   ON property_drafts;
DROP POLICY IF EXISTS "property_drafts: owner can update company drafts" ON property_drafts;

-- =============================================================================
-- Агент: доступ только к своим черновикам (user_id = текущая колонка)
-- =============================================================================

-- SELECT: агент видит свои черновики
CREATE POLICY "property_drafts: agent select own"
  ON property_drafts FOR SELECT
  USING (user_id = auth.uid());

-- INSERT: агент может создавать черновики только со статусом 'pending'
CREATE POLICY "property_drafts: agent insert own"
  ON property_drafts FOR INSERT
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

-- UPDATE: агент может менять свои черновики, результат всегда 'pending'
CREATE POLICY "property_drafts: agent update own"
  ON property_drafts FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

-- =============================================================================
-- Владелец компании: доступ к черновикам объектов своей компании
-- =============================================================================

-- SELECT: нужен чтобы adminAgentDraft на web и mobile мог найти черновик агента
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

-- UPDATE: для approvePropertyDraft / rejectPropertyDraft
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
