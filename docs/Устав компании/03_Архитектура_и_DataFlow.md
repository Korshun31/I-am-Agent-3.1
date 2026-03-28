# 🏗 Архитектура и Data Flow

---

## Принцип обновления данных

**Архитектура: push-signal + fetch on demand**

```
Action (approve/reject/save)
  → broadcastChange('properties')   [companyChannel]
    → WebMainScreen: refreshKey.properties++
      → WebPropertiesScreen: useEffect([refreshKey]) → load()
        → getProperties() → setProperties(props)
        → setSelected(prev → fresh)   // sync selected panel
        → setHistoryRefreshKey(k+1)   // sync rejection history
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
      ├── propertiesService.js   — CRUD + approve/reject + history
      ├── notificationsService.js
      ├── bookingsService.js
      ├── companyService.js
      ├── locationsService.js
      └── companyChannel.js      — broadcastChange

Data Layer (Supabase / PostgreSQL)
  ├── properties
  ├── property_drafts
  ├── property_rejection_history  ← append-only журнал
  ├── bookings
  ├── companies
  ├── company_members
  ├── notifications
  └── auth.users
```

---

## Notification Review Flow

```
WebNotificationBell
├── handleApprove(notif)
│   ├── approvePropertyDraft(draft.id) или approveProperty(propertyId)
│   ├── markActionTaken(notif.id)
│   ├── onPropertiesChanged?.()  → setRefreshKey(properties+1)
│   └── sendNotification(agent)
│
└── handleReject(notif, reason)
    ├── rejectPropertyDraft(draft.id, reason) или rejectProperty(propertyId, reason)
    │   ├── properties.update({ property_status, rejection_reason })
    │   └── property_rejection_history.insert(...)  ← новая запись
    ├── markActionTaken(notif.id)
    ├── onPropertiesChanged?.()  → setRefreshKey(properties+1)
    └── sendNotification(agent)
```

---

## History Refresh Chain

```
setRefreshKey(properties+1)
  → useEffect([refreshKey])
    → load()
    → setDraftRefreshKey(k+1)
    → setHistoryRefreshKey(k+1)
      → PropertyDetail useEffect([property.id, property.property_status, historyRefreshKey])
        → getPropertyRejectionHistory(property.id)
          → render нумерованного списка
```

---

## Auto-approve при admin save rejected

```
WebPropertyEditPanel.handleSave (mode='edit')
  IF isCompanyAdmin && property.property_status === 'rejected'
    → updates.property_status = 'approved'
    → updates.rejection_reason = ''
    → updateProperty(property.id, updates)
    → sendNotification(property.user_id, type='property_approved')
```
