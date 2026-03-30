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

**Примечание (обновление, pre-release delta-fix):**  
Первоначальное решение использовало `window.alert(error.message)`. После F3 и pre-release QA это было признано несовместимым с остальным UI проекта (custom modals/banners). В рамках delta-fix перед релизом `window.alert` заменён на **inline error banner** внутри `WebNotificationBell`:
- Появляется между header и списком уведомлений.
- Автоматически скрывается через 5 секунд (или по кнопке ✕).
- Не блокирует весь браузер, не ломает UX мобильного пользователя.

Текущее решение: **inline banner**, `window.alert` не используется.

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

---

## ADR-009: Lightweight refresh как единственная модель синхронизации

**Дата:** 2026-03-28  
**Статус:** Принято и применено в релизе  

**Контекст:**  
В ходе разработки этапов F–G появилось несколько механизмов синхронизации данных: `window.dispatchEvent`, `onPropertiesChanged`, `historyRefreshKey`, `refreshKey`. Возник риск дублирования и рассинхронов.

**Решение:**  
Зафиксировать одну модель: **push-signal + fetch on demand**.

Для бизнес-данных (объекты, бронирования, права, локации):
```
Action → broadcastChange(key) → WebMainScreen: refreshKey++ → useEffect([refreshKey]) → load()
```

Для инициатора действия (тот, кто нажал кнопку — его сессия не получает self-broadcast):
```
Action → onPropertiesChanged?.() → setRefreshKey(properties+1) → load()
```

Realtime-подписки (`supabase.channel().on('postgres_changes', ...)`) оставлены только для уведомлений (notification bell + browser push). Для всех остальных данных — запрещены.

**Почему так:**  
- Постоянные postgres_changes подписки на все таблицы создают нагрузку на Supabase и риск рассинхронов при reconnect.
- Targeted refresh (only on demand) — предсказуем, легко отлаживается, не требует cleanup-логики на каждом экране.
- Realtime для уведомлений оставлен: там важна мгновенная доставка, а объём событий минимален.

**Применено в:**  
`WebMainScreen`, `WebNotificationBell`, `WebPropertiesScreen`, `WebTeamSection`, `WebAccountScreen`

**Запрещённые паттерны (финально закреплены):**  
- ❌ `window.dispatchEvent` / `window.addEventListener` для синхронизации компонентов  
- ❌ `setInterval` / polling для данных  
- ❌ `postgres_changes` для бизнес-таблиц (только для `notifications`)  
- ✅ `broadcastChange(key)` → `refreshKey` → `load()`
---

## ADR-010: Responsible-only access + Parent-driven cascade

**Дата:** 2026-03-30  
**Статус:** Принято и реализовано  

**Контекст:**  
До этого решения агент получал SELECT-доступ к объекту по двум критериям: `user_id = auth.uid()` (создатель) **или** `responsible_agent_id = auth.uid()` (назначен ответственным). При переназначении ответственного агент-создатель сохранял доступ, что нарушало принцип Company-First: данные компании были доступны агентам, потерявшим ответственность. Дополнительно: изменение ответственного на родительском резорте/кондо не каскадировалось на дочерние объекты — дети оставались на старом агенте.

**Решение:**  
1. **Доступ только по responsible_agent_id.** RLS policy `"properties: agent reads own and assigned"` заменена на `"properties: agent reads assigned"` (`responsible_agent_id = auth.uid()` без `OR user_id`). Аналогично для UPDATE. Миграция: `20260330000000_rls_properties_agent_responsible_only.sql`.  
2. **Сервисный фильтр.** В `propertiesService.getProperties(agentId)` OR-фильтр заменён на `eq('responsible_agent_id', agentId)`.  
3. **Каскад на дочерние объекты.** При сохранении родительского резорта/кондо через Edit Panel вызывается `updatePropertyResponsible(parentId, agentId, cascade=true)`, который обновляет все `resort_id = parentId` одним запросом.  
4. **Блокировка ручного изменения на дочерних объектах.** В `WebPropertyEditPanel` для `isChildUnit=true` пикер ответственного заменён на readonly-метку. В `PropertyEditWizard` пикер скрыт при `isHouseInResort=true`. `buildUpdates` не включает `responsible_agent_id` для дочерних объектов.  
5. **Наследование при создании.** Новый дочерний объект (`create-unit`) получает `responsible_agent_id = parentProperty.responsible_agent_id` автоматически.

**Альтернативы:**  
- Оставить двойной критерий (user_id OR responsible_agent_id) — отклонено: нарушает Company-First; агент-создатель не должен видеть объект после снятия ответственности.  
- Ручное обновление каждого дочернего объекта при смене родительского ответственного — отклонено: admin error-prone, не атомарно.

**Scope:**  
- `supabase/migrations/20260330000000_rls_properties_agent_responsible_only.sql`  
- `src/services/propertiesService.js` (getProperties)  
- `src/web/components/WebPropertyEditPanel.js` (cascade + child lock)  
- `src/components/PropertyEditWizard.js` (buildUpdates + picker visibility)  

**Риски:**  
- Агенты-создатели, которым ответственность была снята, потеряют доступ к ранее «своим» объектам — это ожидаемое поведение по бизнес-правилу, но требует уведомления команды.  
- Если `responsible_agent_id` не был заполнен у части объектов (null) — агент не видит эти объекты. Решение: admin назначает ответственного через Edit Panel.

**Rollback:**  
Восстановить старую policy через миграцию с `OR user_id = auth.uid()`. Вернуть OR-фильтр в `propertiesService.getProperties`.

**Verification:**  
Smoke-test (2026-03-30): назначение агента через Edit Panel → видит родитель + все дочерние; снятие → теряет все; редактирование дочернего — пикер отсутствует.

---

## ADR-011: Финализация словаря ролей (`admin`/`agent`)

**Дата:** 2026-03-30  
**Статус:** Принято и зафиксировано в документации  

**Контекст:**  
В исторических документах и старых миграциях встречаются `owner` и `worker`, что создаёт риск неверной трактовки текущих правил.

**Решение:**  
Зафиксировать единственную актуальную модель ролей в `company_members`: `admin` и `agent`.  
`owner` считать legacy-термином (соответствует `admin`), `worker` считать удалённой ролью.

**SQL-подтверждение:**  
- `company_members_role_check` допускает только `admin/agent`;  
- `company_members_status_check` допускает только `active/inactive`.

**Последствия:**  
Новые фичи и проверки доступа должны опираться только на `admin/agent`. Исторические упоминания `owner/worker` допустимы только как архивные пометки.

---

## ADR-012: Web bookings — защита от `Invalid Date` + восстановление клика по свободной ячейке

**Дата:** 2026-03-30  
**Статус:** Принято и реализовано  

**Проблема:**  
В Web bookings при клике по Gantt возникал `Invalid Date`; после первичного фикса появился регресс — клик по свободной ячейке перестал открывать создание брони.

**Причина:**  
1) В `pxToDate` мог попадать невалидный `x`;  
2) На `react-native-web` `locationX` может быть `undefined`, из-за чего guard корректно отбрасывал событие.

**Решение:**  
Оставлена строгая валидация даты и добавлен безопасный резолвер X-координаты клика (с fallback), чтобы корректно открывать create-flow по свободной ячейке.

**Проверка:**  
`Invalid Date` не появляется, клик по свободной ячейке снова открывает create, кнопка `+ Add booking` работает как раньше.

---

## ADR-013: Mobile bookings — корректный месяц при создании из CalendarScreen

**Дата:** 2026-03-30  
**Статус:** Принято и реализовано  

**Проблема:**  
В App при создании брони из `BookingCalendarScreen` шаг календаря открывался с начала ленты (например, январь 2025), а не с текущего/выбранного месяца.

**Причина:**  
Месяц вычислялся по локальному `locationX` без учёта горизонтального `scroll` таймлайна.

**Решение:**  
Вычисление месяца переведено на абсолютную координату (локальный X + текущий horizontal offset) с guard для невалидных индексов; при невалидном значении в модалку передаётся `initialMonth=null`.

**Проверка:**  
Тап в текущем и проскролленном месяце открывает корректный месяц; путь из `PropertyDetailScreen` не изменён.
