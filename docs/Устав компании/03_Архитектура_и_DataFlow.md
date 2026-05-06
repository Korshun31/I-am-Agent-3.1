# 🏗 Архитектура и Data Flow

---

## Принцип обновления данных

**Архитектура: push-signal + fetch on demand**

```
Action (save / delete)
  → broadcastChange('properties')   [companyChannel]
    → WebMainScreen: refreshKey.properties++
      → WebPropertiesScreen: useEffect([refreshKey]) → load()
        → getProperties() → setProperties(props)
        → setSelected(prev → fresh)   // sync selected panel
```

**Принцип**: не слушать каждое изменение в БД постоянно. Только целевые сигналы после конкретных действий.

---

## Запрещённые паттерны

- ❌ `supabase.channel().on('postgres_changes', ...)` — только там, где уже есть (notifications, dashboard)
- ❌ `window.addEventListener` / `window.dispatchEvent` для синхронизации между компонентами
- ❌ `setInterval` / polling
- ✅ `broadcastChange(key)` → `refreshKey` → `load()`

---

## Слои системы

```
UI Layer (React Native / Web)
  └── src/web/screens/        — screens
  └── src/web/components/     — reusable panels
  └── src/screens/            — mobile screens

Service Layer
  └── src/services/
      ├── propertiesService.js   — CRUD
      ├── notificationsService.js
      ├── bookingsService.js
      ├── companyService.js
      ├── locationsService.js
      └── companyChannel.js      — broadcastChange

Data Layer (Supabase / PostgreSQL)
  ├── properties
  ├── property_drafts             ← снято 2026-04-30, DROP в этапе 3
  ├── property_rejection_history  ← снято 2026-04-30, DROP в этапе 3
  ├── bookings
  ├── companies
  ├── company_members
  ├── notifications
  └── auth.users
```

### Data Contract: owner commission flags

- Для owner-комиссий канонический формат: `value + is_percent`.
- Поля:
  - `owner_commission_one_time`, `owner_commission_one_time_is_percent`
  - `owner_commission_monthly`, `owner_commission_monthly_is_percent`
- Legacy-флаги `owner_commission_*_is_from` не используются в коде и подлежат удалению на уровне схемы.
- Это правило не затрагивает другие `*_is_from` поля (`price_monthly_is_from`, `booking_deposit_is_from`, `save_deposit_is_from`, `commission_is_from`).

---

## UI Contract: Mobile top area parity

Для mobile-экранов с навигацией по вкладкам фиксируется единый UI-контракт верхней зоны:

- `Header block`: title centered + bell right (одинаковые размеры/позиции/бейджи уведомлений).
- `Toolbar block`: search left + action icons right (допускается разное количество иконок).
- Контент экрана (списки/календари/сетки) начинается ниже этих двух блоков.

Это контракт визуальной консистентности (UX-level), не меняющий data flow и backend-логику.

---

## Notification Review Flow / History Refresh Chain / Auto-approve — сняты 2026-04-30 (этап 2)

Все три блока описывали flow модерации (approve/reject/history). Модерация выпилена. `handleApprove`, `handleReject`, `handleViewEditReview` удалены из `WebNotificationBell`. `historyRefreshKey`, `getPropertyRejectionHistory`, auto-approve логика в `WebPropertyEditPanel.handleSave` удалены. См. ADR-015.

Вместо review-flow админу теперь приходят информационные уведомления `property_created` и `booking_created` — без действий.

---

## Текущий режим после релиза (2026-03-28)

**Что работает сейчас:**

| Тип данных | Механизм обновления |
|---|---|
| Объекты | `broadcastChange` → `refreshKey` → `load()` |
| Инициатор действия (своя сессия) | `onPropertiesChanged()` → `setRefreshKey` → `load()` |
| Уведомления (bell + browser) | Realtime `postgres_changes` на таблицу `notifications` |
| Права и локации агента | `broadcastChange('permissions')` → `setUser(freshUser)` |

**Нет постоянной слежки за БД.** Каждый экран обновляется только тогда, когда получает сигнал от конкретного действия (save / delete / permissions change).

**Realtime подписки** существуют ровно в двух местах:
1. `WebNotificationBell` — подписка на `notifications` для мгновенной доставки уведомлений.
2. Browser push notifications — отдельный канал, не влияет на бизнес-данные.

Всё остальное — targeted fetch по сигналу. Это решение зафиксировано в ADR-009.
