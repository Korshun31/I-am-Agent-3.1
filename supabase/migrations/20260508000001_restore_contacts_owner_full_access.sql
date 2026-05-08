-- Migration: восстановление owner full access на contacts
-- Date: 2026-05-08
--
-- Контекст: запланированная миграция 20260327140000_rls_contacts_calendar_events.sql
-- создавала политику "contacts: owner full access to company" FOR ALL — owner
-- компании получает полный CRUD на любые контакты в своей компании. По правилу
-- проекта «все контакты принадлежат компании, админ редактирует всё» это
-- ожидаемое поведение.
--
-- В проде (audit pg_policy 2026-05-08) обнаружено: вместо FOR ALL живёт только
-- "contacts: owner full read" (FOR SELECT), а UPDATE/DELETE/INSERT-политики
-- требуют user_id = auth.uid() — то есть только сам создатель может править.
-- Когда админ пытается обновить контакт, созданный агентом, UPDATE
-- возвращает 0 строк, .single() кидает «Cannot coerce the result to a single
-- JSON object». Видно симметричное поведение в Test 2 (admin grafkorshun31@ya.ru)
-- и Samui 3.1 (admin korshun31@list.ru) для контактов с user_id != admin.uid().
--
-- Что делаем (идемпотентно, DROP IF EXISTS / CREATE):
-- 1. Дропаем "contacts: owner full read" (только SELECT) — будет покрыта FOR ALL.
-- 2. Дропаем "contacts: owner full access to company" если уже есть.
-- 3. Создаём "contacts: owner full access to company" FOR ALL через
--    auth_is_company_owner(company_id) — точно как было запланировано в
--    20260327140000.
--
-- Эффект: owner компании (companies.owner_id = auth.uid()) получает полный CRUD
-- на любые контакты своей компании. Существующие политики для агентов
-- (read own / write own с проверкой user_id = auth.uid()) остаются как есть —
-- агенты по-прежнему могут править только свои.
--
-- Smoke-тест после наката:
--   * под admin'ом редактировать чужой контакт (user_id != auth.uid()) — должно
--     сохраняться без ошибки;
--   * под агентом редактировать чужой контакт — должно отказывать (как раньше).

DROP POLICY IF EXISTS "contacts: owner full read" ON public.contacts;
DROP POLICY IF EXISTS "contacts: owner full access to company" ON public.contacts;

CREATE POLICY "contacts: owner full access to company"
  ON public.contacts
  FOR ALL
  USING  (auth_is_company_owner(company_id))
  WITH CHECK (auth_is_company_owner(company_id));
