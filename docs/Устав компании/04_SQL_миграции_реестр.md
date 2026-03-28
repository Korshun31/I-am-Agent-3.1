# 🗄 Реестр SQL-миграций

---

## Таблица миграций

| Миграция | Цель | Что меняет | Риски | Примечание |
|----------|------|-----------|-------|------------|
| `001_create_bookings.sql` | Начальная схема бронирований | `bookings` table | — | Базовая схема |
| `20250224000000_add_properties_code_suffix_owner_id_2.sql` | Расширение кода объекта | `properties`: `code_suffix`, `owner_id_2` | — | — |
| `20250306000000_add_bookings_photos.sql` | Фото к бронированиям | `bookings.photos` | — | — |
| `20250310000000_add_properties_website_url.sql` | Сайт объекта | `properties.website_url` | — | — |
| `20250311000000_add_properties_price_is_from.sql` | Цены «от» | `properties.*_is_from` bool-поля | — | — |
| `20250312000000_add_properties_address.sql` | Адрес объекта | `properties.address` | — | — |
| `20250313000000_add_bookings_check_times.sql` | Время заезда/выезда | `bookings.check_in_time`, `check_out_time` | — | — |
| `20250315000000_add_bookings_owner_commission.sql` | Комиссия собственника в бронированиях | `bookings.owner_commission*` | — | — |
| `20250317000000_add_bookings_created_at.sql` | Метка времени создания | `bookings.created_at` | — | — |
| `20250318000000_add_contacts_extra_telegrams_whatsapps.sql` | Мульти-контакты | `contacts`: доп. телефоны/мессенджеры | — | — |
| `20250319000000_calendar_events_reminder_array.sql` | Напоминания в событиях | `calendar_events.reminders[]` | — | — |
| `20250320000000_calendar_events_repeat_type.sql` | Повторяющиеся события | `calendar_events.repeat_type` | — | — |
| `20250321000000_team_feature_stage1_up.sql` | Командная функциональность | `companies`, `company_members`, `team_invites` | Критично: перестройка модели доступа | Есть down-миграция |
| `20250321000001_team_feature_stage2_companies_extra_fields.sql` | Доп. поля компании | `companies.*` | — | — |
| `20250322000000_agent_property_owners_access.sql` | Доступ агентов к собственникам | RLS на `contacts` | Средний | — |
| `20250322000001_notifications.sql` | Система уведомлений | `notifications` table + RLS | — | — |
| `20250323000000_property_drafts.sql` | Черновики правок агента | `property_drafts` table + RLS | Средний | Ключевая фича |
| `20250323000001_add_properties_floor_number.sql` | Этаж объекта | `properties.floors` | — | — |
| `20250324000000_fix_properties_rls.sql` | Фикс RLS объектов | RLS policies на `properties` | Средний | — |
| `20250324000001_properties_rls_edit_permission.sql` | Разрешение редактирования | RLS: `can_edit_info` check | Средний | — |
| `20250324000002_fix_property_drafts_rls.sql` | Фикс RLS черновиков | RLS policies на `property_drafts` | Средний | — |
| `20250324000003_add_bookings_missing_columns.sql` | Недостающие поля бронирований | `bookings.*` | — | — |
| `20250325000000_enable_properties_realtime.sql` | Realtime для объектов | `supabase_realtime` publication | Низкий | — |
| `20250325000001_properties_delete_rls.sql` | Политика удаления | RLS DELETE на `properties` | Средний | — |
| `20250325000002_add_company_members_assigned_locations.sql` | Локации агента | `company_members.assigned_locations` | — | — |
| `20250326000000_rename_agent_id_to_user_id.sql` | Переименование поля | `agent_id` → `user_id` | **Высокий**: breaking change | — |
| `20250326000001_companies_extra_fields_and_drafts_company.sql` | Черновики с company_id | `property_drafts.company_id` | Средний | — |
| `20250326000002_agent_location_access.sql` | Доступ по локациям | RLS через `assigned_locations` | Средний | — |
| `20250327000000_get_company_team_function.sql` | PostgreSQL функция для команды | `get_company_team()` | Низкий | — |
| `20260323000000_fix_company_members_unique_constraint_name.sql` | Фикс constraint | `company_members` unique | Низкий | — |
| `20260327120000_finalize_user_id_migration.sql` | Финализация user_id | Несколько таблиц | Высокий | Крупный рефактор |
| `20260327130000_contacts_calendar_events_company_id.sql` | company_id в контактах | `contacts`, `calendar_events` | Средний | — |
| `20260327140000_rls_contacts_calendar_events.sql` | Company-first RLS | RLS на contacts/calendar | Средний | — |
| `20260327150000_rls_bookings_company_first.sql` | Company-first RLS | RLS на bookings | Средний | — |
| `20260327160000_rls_locations_company_first.sql` | Company-first RLS | RLS на locations | Средний | — |
| `20260327170000_rls_properties_cleanup.sql` | Очистка legacy RLS | RLS на properties | **Высокий**: убирает старые политики | Idempotent |
| `20260328000000_property_rejection_history.sql` | Журнал отклонений | `property_rejection_history` table + RLS | Низкий | Append-only |

---

## Таблица `property_rejection_history` — детали

**Назначение:** append-only журнал всех отклонений объектов.

```sql
CREATE TABLE property_rejection_history (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     uuid        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reason          text        NOT NULL DEFAULT '',
  rejection_type  text        NOT NULL DEFAULT 'property_submitted'
                              CHECK (rejection_type IN ('property_submitted','edit_submitted','price_submitted','manual')),
  rejected_by     uuid        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

**Важно:**
- Записи **никогда не обновляются и не удаляются** (кроме CASCADE при удалении объекта).
- Каждый `reject` (прямой или через draft) добавляет **новую строку**.
- `properties.rejection_reason` — это **последняя причина**, используется как fallback в UI если история пуста (legacy-объекты до миграции).

---

## Backfill стратегия (для legacy-объектов)

Объекты с заполненным `properties.rejection_reason` и пустой историей можно бэкфиллить:

```sql
-- ПЛАН (не запускать без тестирования на staging):
-- Найти кандидатов:
SELECT id, rejection_reason FROM properties
WHERE property_status = 'rejected'
  AND rejection_reason IS NOT NULL
  AND rejection_reason <> ''
  AND NOT EXISTS (
    SELECT 1 FROM property_rejection_history
    WHERE property_id = properties.id
  );

-- Safe plan: INSERT по одной строке на объект с rejection_type='manual'
-- НЕ запускать массово без проверки: может затронуть данные, которые уже вручную синхронизированы.
```

**Статус:** не запущен. Описан как forward-plan.

---

## SQL-ограничения, которые НЕ enforced в БД

| Правило | Где enforced | Статус |
|---------|--------------|--------|
| Причина отклонения обязательна | UI/Service (`reason \|\| ''`) | ⚠️ Только UI, не CHECK в БД |
| Только admin может отклонять | RLS INSERT на history | ✅ Enforced |
| История append-only | Нет UPDATE/DELETE RLS | ✅ Enforced через отсутствие политик |
