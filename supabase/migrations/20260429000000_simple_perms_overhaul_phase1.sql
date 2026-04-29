-- Simple permissions overhaul — этап 1: аддитивная миграция данных.
-- Date: 2026-04-29
-- Reference: memory/project_simple_perms_overhaul.md
--
-- Цель: подготовить базу к переходу с пятиполевой модели прав агента
-- (can_add_property / can_edit_info / can_edit_prices / can_book / can_delete_booking)
-- на двухполевую (can_manage_property / can_manage_bookings) — без модерации.
--
-- Этот файл аддитивный: только UPDATE/DELETE существующих строк, без DROP колонок и
-- таблиц. После накатки старый клиент продолжает работать (читает старые поля),
-- новый клиент (в этапе 2) начнёт читать новые поля.
--
-- Шаги:
--   1) backfill двух новых булевых ключей в jsonb company_members.permissions
--      для всех agent-ов (active и неактивных — не фильтруем, чтобы при возможном
--      возврате уволенного его старые права автоматом перевелись в новую модель);
--   2) перевод всех properties со статусом 'pending' / 'rejected' в 'approved' и
--      обнуление rejection_reason. Колонка property_status пока остаётся — её
--      DROP запланирован на этап 3 после полного релиза кода;
--   3) удаление устаревших уведомлений модерации из notifications, чтобы у
--      админов не висели бесполезные записи без рабочих кнопок.
--
-- Обратная совместимость: все старые ключи (can_add_property и т.д.) остаются
-- в JSONB как «мёртвые». Финальная зачистка — этап 3.
--
-- НАКАТКА: SQL Editor в Supabase Studio (sandbox), вручную, по согласованию с
-- владельцем. После накатки — проверить через SELECT, что:
--   * у каждой строки company_members с role='agent' появились ключи
--     can_manage_property и can_manage_bookings;
--   * properties.property_status больше не содержит 'pending' / 'rejected';
--   * в notifications не осталось type IN перечисленных ниже.

BEGIN;

-- 1) backfill новых полей прав
UPDATE company_members
SET permissions = COALESCE(permissions, '{}'::jsonb)
  || jsonb_build_object(
       'can_manage_property',
         COALESCE((permissions->>'can_add_property')::boolean, false)
         OR COALESCE((permissions->>'can_edit_info')::boolean, false)
         OR COALESCE((permissions->>'can_edit_prices')::boolean, false),
       'can_manage_bookings',
         COALESCE((permissions->>'can_book')::boolean, false)
     )
WHERE role = 'agent';

-- 2) перевод всех pending/rejected объектов в approved
-- NB: колонка properties.updated_at добавлена только в prod (см. memory/project_properties_updated_at.md),
-- в sandbox её ещё нет. Не трогаем поле здесь — триггер обновит при наличии, иначе пропустим.
UPDATE properties
SET property_status  = 'approved',
    rejection_reason = NULL
WHERE property_status IN ('pending', 'rejected');

-- 3) удаление устаревших уведомлений модерации
DELETE FROM notifications
WHERE type IN (
  'property_submitted',
  'property_approved',
  'property_rejected',
  'edit_submitted',
  'edit_approved',
  'edit_rejected',
  'price_submitted',
  'price_approved',
  'price_rejected'
);

COMMIT;
