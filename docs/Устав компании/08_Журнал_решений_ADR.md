# 📝 Журнал архитектурных решений (ADR)

Формат: `[ADR-NNN] Краткое название`

---

## ADR-001: Введение `property_rejection_history`

**Дата:** 2026-03-28  
**Статус:** Принято и реализовано  

**Контекст:**  
`properties.rejection_reason` — единственное поле для причины отклонения. При повторном отклонении предыдущая причина перезаписывается. Нет истории, нет аудита.

**Решение:**  
Создать отдельную таблицу `property_rejection_history` (append-only журнал). Каждый `reject` добавляет новую строку. `properties.rejection_reason` остаётся как "последняя причина" для legacy-совместимости и fallback в UI.

**Альтернативы:**  
- JSON-массив в `properties` — отклонено: усложняет RLS, неудобен для сортировки/фильтрации.
- Вынести в `property_events` — избыточно для текущего масштаба.

**Последствия:**  
- Обе функции reject (`rejectProperty`, `rejectPropertyDraft`) теперь INSERT в историю.
- UI `PropertyDetail` загружает историю через `getPropertyRejectionHistory`.
- История не удаляется при auto-approve (это аудит-лог).

---

## ADR-002: Отказ от зависимости на `properties.updated_at`

**Дата:** 2026-03-28  
**Статус:** Принято и реализовано (hotfix)  

**Контекст:**  
Для принудительного обновления UI истории отклонений планировалось использовать `properties.updated_at` в deps `useEffect`. При попытке обновить это поле через `.update()` Supabase вернул ошибку: "column 'updated_at' not found in schema cache" — колонка отсутствует в таблице.

**Решение:**  
Ввести local state `historyRefreshKey` (number) в `WebPropertiesScreen`. Инкрементируется в:
1. `onReject` handler (правая панель)
2. `useEffect([refreshKey])` (глобальный refresh от bell/broadcast)

`PropertyDetail` получает `historyRefreshKey` как prop и использует его в deps загрузки истории.

**Альтернативы:**  
- Добавить `updated_at` в `properties` — отложено, потребует миграции и проверки всех мест где свойство используется.
- Realtime подписка на `property_rejection_history` — противоречит архитектурному принципу (только targeted refresh).

**Последствия:**  
- Никаких изменений схемы БД.
- Гарантированное обновление истории после каждого reject из любого источника.

---

## ADR-003: `historyRefreshKey` в `useEffect([refreshKey])`

**Дата:** 2026-03-28  
**Статус:** Принято и реализовано  

**Контекст:**  
После реализации `historyRefreshKey` обнаружилось, что reject через `WebNotificationBell` не инкрементирует ключ — обновление происходит через глобальный `refreshKey`, а не через локальный `onReject` handler.

**Решение:**  
В `useEffect([refreshKey])` добавить `setHistoryRefreshKey(k => k + 1)`. Таким образом любой refresh-сигнал (broadcast или local) гарантированно обновляет историю.

```javascript
useEffect(() => {
  if (refreshKey) {
    load();
    setDraftRefreshKey(k => k + 1);
    setHistoryRefreshKey(k => k + 1);  // ← ADR-003
  }
}, [refreshKey]);
```

---

## ADR-004: Явный фидбек при ошибках approve/reject

**Дата:** 2026-03-28  
**Статус:** Принято и реализовано  

**Контекст:**  
Ошибки в `handleApprove` и `handleReject` в `WebNotificationBell.js` логировались только в `console.warn`. При этом `markActionTaken` и `setNotifs` вызывались независимо от результата — UI показывал "действие выполнено", даже если БД вернула ошибку.

**Решение:**  
- Обернуть бизнес-логику в `try...catch`.
- `markActionTaken` и `setNotifs` — только внутри `try`.
- В `catch`: `console.error` + `window.alert(error.message)` для явного фидбека.

**Последствия:**  
- Пользователь видит сообщение об ошибке вместо молчаливого отказа.
- UI не обновляется при неудаче (состояние остаётся корректным).

---

## ADR-005: Отказ от `window.dispatchEvent` для синхронизации

**Дата:** 2026-03-28  
**Статус:** Принято и реализовано (cleanup)  

**Контекст:**  
Временно были добавлены `window.dispatchEvent('properties:refresh', ...)` в `WebNotificationBell` и соответствующий `useEffect` listener в `WebPropertiesScreen` для быстрой синхронизации после approve/reject.

**Решение:**  
Удалить `window.dispatchEvent` и listener. Использовать только:
1. `broadcastChange('properties')` → inter-session refresh через companyChannel
2. `onPropertiesChanged?.()` → intra-session refresh для initiator (admin)

**Последствия:**  
- Код чище, меньше механизмов синхронизации.
- Единственный путь обновления: `refreshKey → load()`.

---

## ADR-006: `onPropertiesChanged` callback для initiator refresh

**Дата:** 2026-03-28  
**Статус:** Принято и реализовано  

**Контекст:**  
`companyChannel` игнорирует self-broadcast (`sender_id === sessionId`). Admin, выполнивший approve/reject, не видел обновления в своём же экране.

**Решение:**  
Добавить `onPropertiesChanged?: () => void` в `WebNotificationBell`. Вызывается после успешного approve/reject. Прокинут через `WebLayout` → `WebMainScreen`, где инкрементирует `setRefreshKey(properties+1)`.

**Цепочка:** `onPropertiesChanged` → `setRefreshKey` → `useEffect([refreshKey])` → `load()`

---

## ADR-007: `edit_submitted` → правая review-панель

**Дата:** 2026-03-28  
**Статус:** Принято и реализовано  

**Контекст:**  
`property_submitted` открывается в правой `WebPropertyEditPanel`. `edit_submitted` открывал `DiffModal` — разрыв в UX.

**Решение:**  
Добавить `handleViewEditReview` в `WebNotificationBell`: загружает оригинальный объект + pending draft, мержит `{ ...property, ...(draft.draft_data || {}) }`, открывает правую review-панель. `DiffModal` сохранён в коде, но не используется в этом flow.

---

## ADR-008: Auto-approve при admin-edit rejected

**Дата:** 2026-03-28  
**Статус:** Принято и реализовано  

**Контекст:**  
После отклонения объект имеет статус `rejected`. Если admin вручную правит и сохраняет — логично автоматически одобрить, очистить `rejection_reason` и уведомить агента.

**Решение:**  
В `WebPropertyEditPanel.handleSave`: если `isCompanyAdmin && property.property_status === 'rejected'`, добавить в `updates`: `property_status: 'approved'`, `rejection_reason: ''`, и отправить `sendNotification(property.user_id, 'property_approved')`.

**История в БД не удаляется** — это журнал, а не текущее состояние.
