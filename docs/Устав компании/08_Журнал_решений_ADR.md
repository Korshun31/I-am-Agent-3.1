# 📝 Журнал архитектурных решений (ADR)

Формат: `[ADR-NNN] Краткое название`

---

## ADR-001: Введение `property_rejection_history`

**Дата:** 2026-03-28  
**Статус:** ❌ Отменён 2026-04-30 (этап 2 — модерация выпилена, см. ADR-015). Таблица будет удалена в этапе 3 (cleanup-миграция).  

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
**Статус:** ❌ Отменён 2026-04-30 (этап 2 — историю отклонений показывать больше не нужно, см. ADR-015). `historyRefreshKey` удалён вместе с UI истории.  

**Контекст:**  
Для принудительного обновления UI истории отклонений планировалось использовать `properties.updated_at` в deps `useEffect`. При попытке обновить это поле через `.update()` Supabase вернул ошибку: "column 'updated_at' not found in schema cache" — колонка отсутствует в таблице.

**Решение:**  
Ввести local state `historyRefreshKey` (number) в `WebPropertiesScreen`. Инкрементируется в:
1. `onReject` handler (правая панель)
2. `useEffect([refreshKey])` (глобальный refresh от bell/broadcast)

`PropertyDetail` получает `historyRefreshKey` как prop и использует его в deps загрузки истории.

**Альтернативы:**  
- Добавить `updated_at` в `properties` — реализовано 2026-04-22 (TD-007), уже после отмены этого ADR по причине из ADR-015. Колонка нужна для сортировки выгрузки на сайт через `dataUploadService.js`, не для UI истории отклонений.
- Realtime подписка на `property_rejection_history` — противоречит архитектурному принципу (только targeted refresh).

**Последствия:**  
- Никаких изменений схемы БД.
- Гарантированное обновление истории после каждого reject из любого источника.

---

## ADR-003: `historyRefreshKey` в `useEffect([refreshKey])`

**Дата:** 2026-03-28  
**Статус:** ❌ Отменён 2026-04-30 (этап 2 — UI истории отклонений удалён, см. ADR-015).  

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
**Статус:** ❌ Отменён 2026-04-30 (этап 2 — кнопки approve/reject удалены вместе с модерацией, см. ADR-015). Inline error banner и сами обработчики `handleApprove`/`handleReject` удалены из `WebNotificationBell`.  

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
**Статус:** ❌ Отменён 2026-04-30 (этап 2 — approve/reject больше нет, см. ADR-015). Контекст решения утратил актуальность.  

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
**Статус:** ❌ Отменён 2026-04-30 (этап 2 — approve/reject больше нет, см. ADR-015). Колбэк удалён вместе с обработчиками модерации.  

**Контекст:**  
`companyChannel` игнорирует self-broadcast (`sender_id === sessionId`). Admin, выполнивший approve/reject, не видел обновления в своём же экране.

**Решение:**  
Добавить `onPropertiesChanged?: () => void` в `WebNotificationBell`. Вызывается после успешного approve/reject. Прокинут через `WebLayout` → `WebMainScreen`, где инкрементирует `setRefreshKey(properties+1)`.

**Цепочка:** `onPropertiesChanged` → `setRefreshKey` → `useEffect([refreshKey])` → `load()`

---

## ADR-007: `edit_submitted` → правая review-панель

**Дата:** 2026-03-28  
**Статус:** ❌ Отменён 2026-04-30 (этап 2 — уведомления `edit_submitted` / `property_submitted` удалены, см. ADR-015). `handleViewEditReview` удалён из `WebNotificationBell`.  

**Контекст:**  
`property_submitted` открывается в правой `WebPropertyEditPanel`. `edit_submitted` открывал `DiffModal` — разрыв в UX.

**Решение:**  
Добавить `handleViewEditReview` в `WebNotificationBell`: загружает оригинальный объект + pending draft, мержит `{ ...property, ...(draft.draft_data || {}) }`, открывает правую review-панель. `DiffModal` сохранён в коде, но не используется в этом flow.

---

## ADR-008: Auto-approve при admin-edit rejected

**Дата:** 2026-03-28  
**Статус:** ❌ Отменён 2026-04-30 (этап 2 — статуса `rejected` больше нет, см. ADR-015). Логика auto-approve удалена из `WebPropertyEditPanel.handleSave`.  

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

---

## ADR-014: UI parity для mobile Booking calendar (3-я вкладка)

**Дата:** 2026-03-30  
**Статус:** Принято и реализовано  

**Проблема:**  
Верхняя зона 3-й вкладки (`Booking calendar`, mobile) визуально отличалась от `База`, что создавало заметный разрыв при переключении вкладок.

**Причина:**  
Header/toolbar были оформлены с иными размерами и позициями ключевых элементов (`title`, `bell`, `badge`, `search`, filter icon).

**Решение:**  
Зафиксирован и применён единый паттерн верхней зоны:
1. `Header`: title centered + bell right;  
2. `Toolbar`: search left + filter right;  
3. Основной контент (календарная сетка) начинается ниже toolbar;  
4. Локальный search фильтрует строки по `name/code`.

**Границы решения:**  
UI-only: бизнес-логика бронирований, модерации и уведомлений не менялась.

**Проверка:**  
Визуальная консистентность между `База` и `Booking calendar` достигнута; поиск по `name/code` работает; календарные сценарии без регрессий.

---

## ADR-015: Упрощение прав агента — выпиливание модерации

**Дата:** 2026-04-30  
**Статус:** Принято и реализовано  

**Контекст:**  
Семь раздельных галочек прав (`can_add_property`, `can_edit_info`, `can_edit_prices`, `can_book`, `can_delete_booking`, `can_see_financials`, `can_manage_clients`) и flow модерации (агент создаёт → черновик/pending → админ одобряет/отклоняет → история отклонений) — слишком сложная модель для размера компании-владельца. Владелец на грани релизного выгорания, требует упростить CRM до минимума.

**Решение:**  
Свести права агента к двум галочкам — `can_manage_property` (добавлять/редактировать/удалять свои объекты) и `can_manage_bookings` (то же для своих бронирований). Модерацию объектов выпилить полностью: всё публикуется и сохраняется сразу. Финансы своих бронирований и работа со своими контактами — всегда доступны без отдельных галочек.

**Что снято:**  
- Таблицы: `property_drafts` (DROP в этапе 2), `property_rejection_history` (DROP в этапе 3 после прода).
- Колонки: `properties.property_status`, `properties.rejection_reason` (DROP в этапе 3).
- Уведомления: `property_submitted`, `property_approved`, `property_rejected`, `edit_submitted`, `edit_approved`, `edit_rejected`, `price_*` — DELETE из notifications + удалена отправка из кода.
- Функции сервисов: `submitPropertyDraft`, `approveProperty`, `approvePropertyDraft`, `rejectProperty`, `rejectPropertyDraft` (удалены из `propertiesService`).
- UI: кнопки «Одобрить / Отклонить», бейджи «На проверке» / «Отклонён», блок «История отклонений», review-панель `WebPropertyEditPanel(readOnly=true)`, `DiffModal` (не вызывается).
- Закрыты как «снято в пользу простоты»: TD-005, TD-008, TD-009, TD-052, TD-055, TD-056, TD-057, TD-058, TD-059, TD-087, TD-088, TD-102, TD-111, TD-112; P1-001, P1-002.

**Что добавлено:**  
- Уведомление `property_created` — админу когда агент создаёт объект (информационная плашка).
- Уведомление `booking_created` — админу когда агент создаёт бронирование.

**Альтернативы:**  
- Оставить старую модель и просто реализовать недоделки (TD-005, TD-058) — отклонено: 7 галочек слишком сложны для пользователей, владелец просил упростить.
- Сохранить модерацию, но упростить до двух галочек прав — отклонено половинчатое решение, модерация и так почти не использовалась в реальной работе.

**Реализация (два этапа):**  
- Этап 1 (2026-04-29, аддитивная миграция, коммит `c690e46`): добавлены `can_manage_property` / `can_manage_bookings` в JSONB; DB-default `property_status = 'approved'`. Старые ключи остаются.
- Этап 2 (2026-04-30, 13+ коммитов от `bcf3b34` до `c5ba469`): UI/сервисы переведены на новые галочки, модерация выпилена из кода. RLS-миграция `20260429000001_simplify_properties_rls_phase2.sql`: DROP всех политик `property_drafts`, новые INSERT/UPDATE/DELETE политики для properties и bookings под новые галочки.
- Этап 3 (после прода): cleanup-миграция дропнет таблицы и колонки.

**Последствия:**  
- Отменены ADR-001..ADR-008 (всё что про модерацию).
- 14 TD и 2 P1 закрыты как «снято в пользу простоты».
- Агент получил больше доверия и меньше трения в работе.
- Админ потерял возможность блокировать публикацию объектов — это сознательный компромисс.
