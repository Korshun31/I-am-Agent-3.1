# 🚀 Бэклог идей и TODO

---

## Приоритет: Высокий

### P1-001: Роль "помощник админа" / `can_moderate_properties`
**Описание:** Возможность назначить старшего агента, который может approve/reject объекты.  
**Блокер:** Требует расширения RLS (см. `05_RLS_и_права_доступа.md` → Proposal).  
**Файлы:** `supabase/migrations/new`, `src/services/propertiesService.js`, `src/web/components/WebNotificationBell.js`

### P1-002: Обязательность причины отклонения на уровне БД
**Описание:** Сейчас `reason` required только в UI. Добавить `CHECK (reason <> '')` в таблицу `property_rejection_history` и рассмотреть `NOT NULL` + default '' на `properties.rejection_reason`.  
**Файлы:** `supabase/migrations/new`  
**Примечание:** Аккуратно — не сломать существующие данные с пустыми причинами.

### P1-003: Backfill истории отклонений для legacy-объектов
**Описание:** Объекты с `rejection_reason` но без записей в `property_rejection_history`.  
**Plan:** описан в `04_SQL_миграции_реестр.md`.  
**Статус:** Pending, требует тестирования на staging.

---

## Приоритет: Средний

### P2-001: Усиление audit trail
**Описание:** Добавить `rejection_type` в текущие инсерты (сейчас всегда `property_submitted`). Корректно определять `edit_submitted` / `price_submitted` / `manual`.  
**Файлы:** `src/services/propertiesService.js`

### P2-002: Улучшение UX уведомлений
**Описание:**
- Группировать уведомления по объекту (не показывать 5 отдельных строк для одного)
- Добавить timestamp в список уведомлений
- Возможность "прочитать все"
**Файлы:** `src/web/components/WebNotificationBell.js`

### P2-003: Permissions в UI (TODO items из APP_MAP_WEB.md)
**Описание:** Скрыть / показать элементы UI по `can_edit_info`, `can_edit_prices`, `can_see_financials`, `can_add_property`, `can_delete_booking`.  
**Файлы:** `src/web/screens/WebPropertiesScreen.js`, `src/web/components/WebPropertyEditPanel.js`

### P2-004: История правок объекта (не только отклонений)
**Описание:** Версионирование изменений объекта (кто, что, когда изменил). Возможно через отдельную таблицу `property_change_history`.  
**Статус:** Идея, не проработана.

---

## Приоритет: Низкий / Backlog

### P3-001: Mobile parity для review flow
**Описание:** В Flutter-приложении реализовать аналогичный review-flow (approve/reject из уведомлений).  
**Блокер:** Сначала нужна стабильность Web-flow.

### P3-002: Экспорт истории отклонений
**Описание:** Возможность экспортировать CSV с историей отклонений для отчётности.  
**Файлы:** `src/services/propertiesService.js`, `src/web/screens/WebPropertiesScreen.js`

### P3-003: Push-уведомления (браузер)
**Описание:** Сейчас уведомления только в колокольчике. Добавить браузерные push-уведомления для ключевых событий (new property, approved, rejected).  
**Блокер:** Требует Service Worker.

### P3-004: Фильтр объектов по статусу в левом списке
**Описание:** Возможность показывать только `pending` / `rejected` / `approved` объекты в левом списке.  
**Файлы:** `src/web/screens/WebPropertiesScreen.js`

### P3-005: Добавить `updated_at` в таблицу `properties`
**Описание:** Колонка нужна для audit trail и потенциальной инвалидации кэша.  
**Примечание:** Требует миграции + обновления всех `INSERT/UPDATE` в `propertiesService`.  
**ADR:** ADR-002 описывает, почему это было отложено.
