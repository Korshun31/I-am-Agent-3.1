-- =============================================================================
-- Simple permissions overhaul — Phase 2 RLS
-- =============================================================================
-- Этап 2 упрощения модели прав агента:
--  • выпиливаем модерацию объектов (черновики, статусы pending/rejected,
--    кнопки одобрить/отклонить);
--  • переписываем RLS-политики properties и bookings так, чтобы они
--    проверяли НОВЫЕ галочки прав:
--      - can_manage_property  — добавлять/редактировать/удалять свои объекты;
--      - can_manage_bookings  — добавлять/редактировать/удалять свои брони.
--
-- Фаза 1 (миграция 20260429000000) уже подложила оба новых ключа всем
-- активным агентам через бэкфилл, поэтому никто доступа не теряет: кто
-- раньше мог редактировать — может; кто мог бронить — может.
--
-- Таблицу property_drafts физически НЕ удаляем здесь — это Фаза 3
-- (cleanup-миграция). В этом файле только закрываем доступ к ней через RLS
-- и снимаем с supabase_realtime publication, чтобы клиент перестал ловить
-- изменения. Сама таблица станет «спящей» — в неё нельзя ни читать, ни
-- писать через клиент.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. property_drafts — отключаем доступ через RLS, убираем из realtime.
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "property_drafts: agent select own"            ON property_drafts;
DROP POLICY IF EXISTS "property_drafts: agent insert own"            ON property_drafts;
DROP POLICY IF EXISTS "property_drafts: agent update own"            ON property_drafts;
DROP POLICY IF EXISTS "property_drafts: owner can read company drafts"   ON property_drafts;
DROP POLICY IF EXISTS "property_drafts: owner can update company drafts" ON property_drafts;

-- supabase_realtime может не содержать таблицу — глушим NOTICE.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE property_drafts;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 2. properties — INSERT с проверкой can_manage_property для агента.
-- -----------------------------------------------------------------------------
-- Раньше политика разрешала любому активному члену компании создавать
-- объект. Теперь у агента дополнительно проверяется галочка
-- can_manage_property; владелец компании по-прежнему создаёт без проверки.

DROP POLICY IF EXISTS "properties: owner or agent can insert" ON properties;
CREATE POLICY "properties: owner or agent can insert"
  ON properties FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      auth_is_company_owner(company_id)
      OR EXISTS (
        SELECT 1 FROM company_members cm
        WHERE cm.company_id = properties.company_id
          AND cm.user_id    = auth.uid()
          AND cm.status     = 'active'
          AND COALESCE((cm.permissions->>'can_manage_property')::boolean, false) = true
      )
    )
  );

-- -----------------------------------------------------------------------------
-- 3. properties — UPDATE для агента: ответственный + can_manage_property.
-- -----------------------------------------------------------------------------
-- До этого политика 20260330000000 проверяла только responsible_agent_id.
-- Ужесточаем: ещё нужна галочка can_manage_property.

DROP POLICY IF EXISTS "properties: agent update assigned" ON properties;
CREATE POLICY "properties: agent update assigned"
  ON properties FOR UPDATE
  USING (
    responsible_agent_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = properties.company_id
        AND cm.user_id    = auth.uid()
        AND cm.status     = 'active'
        AND COALESCE((cm.permissions->>'can_manage_property')::boolean, false) = true
    )
  )
  WITH CHECK (
    responsible_agent_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = properties.company_id
        AND cm.user_id    = auth.uid()
        AND cm.status     = 'active'
        AND COALESCE((cm.permissions->>'can_manage_property')::boolean, false) = true
    )
  );

-- -----------------------------------------------------------------------------
-- 4. properties — UPDATE для админа: модерационная политика заменена на
--    нормальный полный апдейт по company_id.
-- -----------------------------------------------------------------------------
-- "owner approves submitted" из 20260327170000 была единственной UPDATE-
-- политикой для админа. Если её просто DROPnуть — админ потеряет UPDATE.
-- Поэтому пересоздаём без модерационного смысла.

DROP POLICY IF EXISTS "properties: owner approves submitted" ON properties;
CREATE POLICY "properties: owner full update company"
  ON properties FOR UPDATE
  USING  (auth_is_company_owner(company_id))
  WITH CHECK (auth_is_company_owner(company_id));

-- -----------------------------------------------------------------------------
-- 5. properties — DELETE для агента: вместо «не-approved» → can_manage_property.
-- -----------------------------------------------------------------------------
-- Старое правило «agent can delete own non-approved» не имеет смысла без
-- модерации. Заменяем на «agent can delete assigned» с проверкой галочки.
-- Политика админа "company owner can delete" сохраняется.

DROP POLICY IF EXISTS "properties: agent can delete own non-approved" ON properties;
CREATE POLICY "properties: agent can delete assigned"
  ON properties FOR DELETE
  USING (
    responsible_agent_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = properties.company_id
        AND cm.user_id    = auth.uid()
        AND cm.status     = 'active'
        AND COALESCE((cm.permissions->>'can_manage_property')::boolean, false) = true
    )
  );

-- -----------------------------------------------------------------------------
-- 6. bookings — INSERT/UPDATE/DELETE с проверкой can_manage_bookings.
-- -----------------------------------------------------------------------------
-- Раньше политики broни проверяли только членство в компании. Теперь у
-- агента дополнительно проверяется can_manage_bookings; админу как и
-- прежде — без проверки галочки.

DROP POLICY IF EXISTS "bookings: agent insert own" ON bookings;
CREATE POLICY "bookings: agent insert own"
  ON bookings FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      auth_is_company_owner(company_id)
      OR (
        auth_is_company_member(company_id)
        AND EXISTS (
          SELECT 1 FROM company_members cm
          WHERE cm.company_id = bookings.company_id
            AND cm.user_id    = auth.uid()
            AND cm.status     = 'active'
            AND COALESCE((cm.permissions->>'can_manage_bookings')::boolean, false) = true
        )
      )
    )
    AND (
      auth_is_company_owner(company_id)
      OR booking_agent_id IS NULL
      OR booking_agent_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "bookings: agent update own" ON bookings;
CREATE POLICY "bookings: agent update own"
  ON bookings FOR UPDATE
  USING (
    booking_agent_id = auth.uid()
    AND (
      auth_is_company_owner(company_id)
      OR (
        auth_is_company_member(company_id)
        AND EXISTS (
          SELECT 1 FROM company_members cm
          WHERE cm.company_id = bookings.company_id
            AND cm.user_id    = auth.uid()
            AND cm.status     = 'active'
            AND COALESCE((cm.permissions->>'can_manage_bookings')::boolean, false) = true
        )
      )
    )
  )
  WITH CHECK (
    booking_agent_id = auth.uid()
    AND (
      auth_is_company_owner(company_id)
      OR (
        auth_is_company_member(company_id)
        AND EXISTS (
          SELECT 1 FROM company_members cm
          WHERE cm.company_id = bookings.company_id
            AND cm.user_id    = auth.uid()
            AND cm.status     = 'active'
            AND COALESCE((cm.permissions->>'can_manage_bookings')::boolean, false) = true
        )
      )
    )
  );

DROP POLICY IF EXISTS "bookings: agent delete own" ON bookings;
CREATE POLICY "bookings: agent delete own"
  ON bookings FOR DELETE
  USING (
    booking_agent_id = auth.uid()
    AND (
      auth_is_company_owner(company_id)
      OR (
        auth_is_company_member(company_id)
        AND EXISTS (
          SELECT 1 FROM company_members cm
          WHERE cm.company_id = bookings.company_id
            AND cm.user_id    = auth.uid()
            AND cm.status     = 'active'
            AND COALESCE((cm.permissions->>'can_manage_bookings')::boolean, false) = true
        )
      )
    )
  );
