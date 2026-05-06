-- Этап 3 упрощения прав агента — финальная физическая чистка БД (cleanup-миграция).
-- Всё что снято логически в этапах 1-2, теперь удаляется физически.
--
-- Контекст:
--   • Этап 1 (20260429000000_simple_perms_overhaul_phase1.sql) — добавил can_manage_property и can_manage_bookings, поставил DB-default property_status='approved'.
--   • Этап 2 (20260429000001_simplify_properties_rls_phase2.sql) — переписал RLS на новые галочки, дропнул RLS-политики property_drafts, отписал её от realtime publication.
--   • Этап 3 (этот файл) — DROP таблиц property_drafts и property_rejection_history, DROP колонок property_status и rejection_reason, jsonb_strip старых ключей прав из company_members.permissions.
--
-- Аудит sandbox перед миграцией (2026-04-30):
--   • property_drafts: 3 строки, 5 индексов, 3 FK CASCADE наружу, 0 RLS-политик, не в realtime.
--   • property_rejection_history: 3 строки, 2 индекса, 2 FK CASCADE, 3 RLS-политики (снимутся с DROP TABLE).
--   • properties.property_status: text NOT NULL default 'approved', 0 строк со значением кроме 'approved'.
--   • properties.rejection_reason: text NULL, 2 строки с непустым значением (потеряются).
--   • company_members.permissions: у всех 12 строк есть can_manage_property и can_manage_bookings; старые ключи лежат хвостами.
--   • Триггер auto_set_property_company уже чистый (без упоминания submitted/property_status), не трогаем.
--   • Функций в БД использующих удаляемые сущности — нет.

-- 1. DROP таблицы property_drafts. Снимутся вместе с ней: 5 индексов, 3 FK, 0 RLS-политик.
DROP TABLE IF EXISTS public.property_drafts;

-- 2. DROP таблицы property_rejection_history. Снимутся вместе с ней: 2 индекса, 2 FK, 3 RLS-политики (rejection_history: agent reads own and assigned, rejection_history: owner reads company, rejection_history: owner can insert).
DROP TABLE IF EXISTS public.property_rejection_history;

-- 3. DROP колонок property_status и rejection_reason из properties. Никаких CHECK constraint, индексов или FK на них нет.
ALTER TABLE public.properties DROP COLUMN IF EXISTS property_status;
ALTER TABLE public.properties DROP COLUMN IF EXISTS rejection_reason;

-- 4. Очистка устаревших ключей прав из company_members.permissions JSONB.
-- Удаляем 6 старых ключей (can_manage_clients уже выпилен ранее).
-- can_manage_property и can_manage_bookings остаются нетронутыми.
UPDATE public.company_members
SET permissions = permissions
  - 'can_add_property'
  - 'can_edit_info'
  - 'can_edit_prices'
  - 'can_book'
  - 'can_delete_booking'
  - 'can_see_financials';
