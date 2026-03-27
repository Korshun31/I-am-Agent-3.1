# Company-First Migration — Этап A: Контракт, Freeze, DoD

> Дата фиксации: 2026-03-23  
> Версия контракта: **v1.2** (обновлено: company-first RLS зафиксирован для всех таблиц)  
> Статус: **ЭТАП A ЗАКРЫТ · ЭТАП B: READY TO START ✅**  
> Последнее обновление: 2026-03-27 — RLS company-first зафиксирован в миграциях; Contact Access Contract добавлен

---

## 1. Role Contract v1.1

### Роли и права

| Роль | Источник | Права |
|---|---|---|
| `owner` | `companies.owner_id` + `company_members.role='owner'` | Полный доступ ко всем данным компании. Управляет командой. Одобряет/отклоняет черновики. |
| `agent` | `company_members.role='agent'`, `status='active'` | Видит только свои объекты + назначенные. Создаёт черновики (не публикует напрямую). Не редактирует районы/локации. |
| `worker` | **UI-термин только** | `owner` без активной команды. В коде не реализуется — только визуальное разделение в UI. |

### Источник прав

- **Идентичность**: `auth.users.id` = `user_id` везде.
- **Роль в компании**: `company_members.role` + `company_members.permissions` (JSONB).
- **Активность членства**: `company_members.status` (`'active'` | `'inactive'`).
- **Доступные локации агента**: `agent_location_access(user_id, company_id, location_id)`.
- **Права на конкретные действия**: `teamPermissions` (JS-объект из `company_members.permissions`).

### Правило увольнения агента — SOFT DEACTIVATE (единственный контракт)

> ❌ **ЗАПРЕЩЕНО**: удалять запись из `company_members` (hard delete).  
> ✅ **ОБЯЗАТЕЛЬНО**: использовать только soft deactivate.

Шаги при увольнении:
1. `company_members.status = 'inactive'` — членство деактивируется, запись сохраняется.
2. `agent_location_access` — удалить все записи агента в данной компании (доступ к локациям снимается).
3. `properties.responsible_agent_id` — переназначить в `NULL` для всех объектов компании, где агент был ответственным.
4. `auth.users` — **НЕ трогать**. Пользователь сохраняет личный аккаунт.
5. `company_members.permissions` и `role` — **сохраняются** (история членства).

### Member Lifecycle Policy

```
active ──────────────────> inactive ──────────────> (optional) active
  │                            │                           │
  │  deactivateMember()        │  reactivateMember()       │
  │  - status='inactive'       │  - status='active'        │
  │  - revoke location access  │  - reassign locations     │
  │  - unassign properties     │  - restore permissions    │
  └────────────────────────────┴───────────────────────────┘
```

**Что сохраняется при деактивации:**
- Запись `company_members` (role, permissions, joined_at).
- Профиль `agents` / `auth.users` без изменений.
- История объектов (`agent_id` на properties остаётся как авторство).

**Что снимается при деактивации:**
- Записи `agent_location_access` для данной компании.
- `responsible_agent_id` на объектах компании → `NULL`.
- Активный сеанс не разрывается принудительно (делается при следующей загрузке профиля через проверку `status`).

### Ограничение: role `owner` (собственник недвижимости)

- Роль "собственник объекта" (`property_owners` / `contacts`) в текущей фазе **не реализуется**.
- Таблица `properties.owner_id` существует, но ссылается на `contacts`, не на `auth.users` — архитектурно нейтральна.
- В Phase B не трогать.

---

## 2. Migration Freeze Rules (Sprint Freeze)

### Запрещено (без согласования):

1. Переименовывать колонку `properties.agent_id` — она используется в RLS и в сервисных функциях.
2. Менять структуру `company_members` (добавлять/удалять колонки) — **исключение**: добавить колонку `status` для soft deactivate (требует `[FREEZE EXCEPTION]`).
3. Менять RLS-политики на `companies`, `company_members`, `properties` — любая ошибка = потеря доступа.
4. Менять сигнатуру `auth_is_company_owner` и `auth_is_company_member` — используются в 4+ RLS политиках.
5. Менять `getUserProfile` — центральная функция, изменение ломает весь AuthContext.
6. Менять `get_company_team` SQL-функцию.
7. **Удалять записи из `company_members`** (hard delete) — нарушает lifecycle policy.

### Разрешено без согласования:

1. Добавлять новые поля в `companies` (через миграцию IF NOT EXISTS).
2. Добавлять новые функции в сервисы (не изменяя существующие).
3. UI-изменения в компонентах (без изменения API-слоя).
4. Добавлять индексы.
5. Создавать новые таблицы.
6. Изменять `docs/`.

### Согласование исключений:

- Любое исключение из freeze — описать в PR как `[FREEZE EXCEPTION]` с обоснованием.
- Требует явного ОК от Lead Developer перед мержем.

---

## 3. Definition of Done (Checklist для Этапа B)

### Функциональные условия:

- [ ] `owner` видит все объекты компании (по `company_id`).
- [ ] `agent` с `status='active'` видит только `agent_id = user.id` OR `responsible_agent_id = user.id`.
- [ ] `agent` с `status='inactive'` не имеет доступа к данным компании (проверка в `getUserProfile`).
- [ ] При добавлении объекта агентом — объект получает `company_id` компании агента автоматически.
- [ ] Агент без назначенных локаций не видит чужих локаций/районов.
- [ ] Увольнение агента (`deactivateMember`) — soft deactivate: `status='inactive'`, локации сняты, `responsible_agent_id → NULL`.
- [ ] Реактивация агента (`reactivateMember`) — `status='active'`, локации переназначаются вручную.
- [ ] `broadcastChange('permissions')` корректно обновляет права агента на всех клиентах.
- [ ] `worker` (owner без команды) не видит раздел Team в UI.

### SQL-инварианты:

- [ ] Каждый объект компании имеет `properties.company_id IS NOT NULL` (не `NULL` для новых объектов).
- [ ] `company_members` не содержит записей `status='active'` с одним `user_id` в двух разных компаниях.
- [ ] `agent_location_access` не содержит записей для `user_id`, у которого `company_members.status='inactive'` в данной компании.
- [ ] `property_drafts.user_id` всегда ссылается на существующий `auth.users.id`.
- [ ] `auth_is_company_member(company_id)` учитывает `status` — возвращает `TRUE` только для активных членов.
- [ ] ❌ Нет ни одного `DELETE FROM company_members` в продовом коде — только `UPDATE status`.

### UI-инварианты:

- [ ] Агент не видит кнопку "Добавить район".
- [ ] Агент в wizard видит только свои назначенные локации.
- [ ] В AccountScreen у агента — read-only блок локаций (без edit).
- [ ] Admin видит все объекты своей компании в одном списке.
- [ ] Нотификации для Admin приходят только по черновикам своей компании.

---

## 4. RLS / Access Control (текущее состояние prod)

### 4.1 Policy matrix по таблицам

| Таблица | Политика | Субъект | Действие | Условие |
|---|---|---|---|---|
| **properties** | `properties: owner reads company` | owner | SELECT | `companies.owner_id = auth.uid()` |
| **properties** | `properties: agent reads own and assigned` | agent | SELECT | `user_id = uid OR responsible_agent_id = uid` |
| **properties** | `properties: owner or agent can insert` | all | INSERT | `user_id = auth.uid()` |
| **properties** | `properties: agent update own` | agent | UPDATE | own OR responsible + `can_edit_info` |
| **properties** | `properties: responsible agent can update` | agent | UPDATE | `responsible_agent_id = auth.uid()` |
| **properties** | `properties: owner approves submitted` | owner | UPDATE | `companies.owner_id = auth.uid()` |
| **properties** | `properties: owner can delete` | owner/creator | DELETE | `user_id = uid OR companies.owner_id = uid` |
| **bookings** | `bookings: owner full access to company` | owner | ALL | `auth_is_company_owner(company_id)` |
| **bookings** | `bookings: agent own` | agent | ALL | `user_id = auth.uid()` |
| **bookings** | `bookings: agent reads assigned property bookings` | agent | SELECT | `properties.responsible_agent_id = uid` |
| **contacts** | `contacts: owner full access to company` | owner | ALL | `auth_is_company_owner(company_id)` |
| **contacts** | `contacts: agent read own` | agent | SELECT | `user_id = auth.uid()` |
| **contacts** | `contacts: agent write own` | agent | INSERT | `user_id = auth.uid()` |
| **contacts** | `contacts: agent update own` | agent | UPDATE | `user_id = auth.uid()` |
| **contacts** | `contacts: agent delete own` | agent | DELETE | `user_id = auth.uid()` |
| **contacts** | `contacts: agent reads property owners` | agent | SELECT | `owner_id / owner_id_2` на managed props |
| **calendar_events** | `calendar_events: owner full access to company` | owner | ALL | `auth_is_company_owner(company_id)` |
| **calendar_events** | `calendar_events: agent own` | agent | ALL | `user_id = auth.uid()` |
| **locations** | `locations: owner full access` | owner | ALL | `user_id = auth.uid()` |
| **locations** | `locations: company member read` | agent | SELECT | `agent_location_access.user_id = uid` |
| **location_districts** | `location_districts: owner full access` | owner | ALL | через `locations.user_id` |
| **location_districts** | `location_districts: company member read` | agent | SELECT | через `agent_location_access` |

### 4.2 Removed (legacy) policies

| Таблица | Политика (удалена) | Причина |
|---|---|---|
| properties | `Agents can read/insert/update/delete own properties` | Заменена company-first SELECT/INSERT |
| properties | `team_members_read_company_properties` | Заменена `properties: owner reads company` |
| properties | `team_members_insert_company_properties` | Заменена `properties: owner or agent can insert` |
| properties | `company_owner_update_submitted_properties` | Переименована в `properties: owner approves submitted` |
| bookings | `Users can manage own bookings` | Заменена `bookings: owner full access to company` + `bookings: agent own` |
| contacts | `Users can manage own contacts` | Заменена split-политиками выше |
| calendar_events | `Users can manage own calendar_events` | Заменена split-политиками выше |
| locations | `Agents can view/insert/update/delete own locations` | Заменена `locations: owner full access` + `company member read` |

### 4.3 Contact Access Contract (финальный, v1.0)

> Зафиксировано 2026-03-27. Обновлено (финал): 2026-03-27.

#### Модель хранения

Каждый контакт несёт **два ownership-поля**:

| Поле | Роль | Описание |
|---|---|---|
| `company_id` | **scope** | К какой компании принадлежит контакт. Устанавливается при создании через `resolveCompanyId()`. Неизменен при update. |
| `user_id` | **author** | Кто создал контакт. Используется агентом для фильтрации собственных записей. |

Каждый пользователь работает в рамках компании:
- **owner/admin** — владелец компании (`companies.owner_id`).
- **agent** — активный член приглашённой компании (`company_members.status='active'`).
- **private user** — одиночный owner собственной (личной) компании.

#### Матрица доступа

| Субъект | Чтение | Запись | Политика |
|---|---|---|---|
| **owner/admin** | Все контакты компании (по `company_id`) | Полный CRUD в рамках компании | `contacts: owner full access to company` |
| **agent** | Только собственные контакты (`user_id = auth.uid()`) | INSERT/UPDATE/DELETE только своих, в рамках компании | `contacts: agent read own` + `agent write own` |
| **agent** | Собственники объектов, где агент ответственный (`owner_id`, `owner_id_2`) | ❌ Только чтение | `contacts: agent reads property owners` |
| **agent** | Контакты других агентов | ❌ Нет доступа по умолчанию | — |

#### Соответствие в коде (contactsService.js)

| Функция | Логика |
|---|---|
| `getContacts(type)` | owner → `company_id = ownedCompany.id`; agent/private → `user_id = session.user.id` |
| `getContactById(id)` | owner → `id + company_id = ownedCompany.id`; agent/private → `id + user_id = session.user.id` |
| `createContact(...)` | `resolveCompanyId()` → throws `CONTACT_NO_COMPANY` если null |
| `resolveCompanyId(userId)` | owner: `companies.owner_id`; member (any active role): `company_members.user_id + status='active'` |

### 4.4 Миграции company-first RLS

| Файл | Содержание |
|---|---|
| `20260327130000_contacts_calendar_events_company_id.sql` | ADD COLUMN + backfill + index + NOT NULL для `contacts` и `calendar_events` |
| `20260327140000_rls_contacts_calendar_events.sql` | Company-first RLS для `contacts` + `calendar_events`; legacy удалены |
| `20260327150000_rls_bookings_company_first.sql` | Rename `agent_id→user_id`, ADD `company_id`, company-first RLS для `bookings` |
| `20260327160000_rls_locations_company_first.sql` | Company-first RLS для `locations` + `location_districts`; legacy удалены |
| `20260327170000_rls_properties_cleanup.sql` | Cleanup legacy policies; keep/recreate approval flow |

---

## 5. Gap Check

### ✅ Соответствует контракту:

| Что | Файл/Таблица |
|---|---|
| `company_members.user_id` (переименовано из `agent_id`) | `20250326000000_rename_agent_id_to_user_id.sql` |
| `property_drafts.user_id` (переименовано из `agent_id`) | `20250326000000_rename_agent_id_to_user_id.sql` |
| `auth_is_company_member` использует `user_id` | `20250326000000_rename_agent_id_to_user_id.sql` |
| `agent_location_access` таблица и RLS | `20250326000002_agent_location_access.sql` |
| `getAgentLocationAccess` / `setAgentLocationAccess` | `src/services/companyService.js` |
| `getLocationsForAgent` через JOIN | `src/services/locationsService.js` |
| `assignedLocationIds` загружается из `agent_location_access` | `src/services/authService.js` |
| `broadcastChange('permissions')` после сохранения локаций | `src/web/components/WebTeamSection.js` |
| `get_company_team` SQL использует `user_id` | `20250327000000_get_company_team_function.sql` |
| `deactivateCompany` проверяет наличие агентов перед отключением | `src/services/companyService.js` |

### Устранённые расхождения (pre-B блокеры — все закрыты):

| # | Статус | Файл | Решение |
|---|---|---|---|
| G2 / B0.1 | ✅ **Closed** | `src/services/propertiesService.js` | `getProperties` теперь использует `.or('user_id.eq.${agentId},responsible_agent_id.eq.${agentId}')` |
| G6 / B0.2 | ✅ **Closed** | `src/services/propertiesService.js` | `createProperty/Full` автоматически проставляет `company_id` через `resolveAgentCompanyId()` |
| G3 / B0.3 | ✅ **Closed** | `src/services/companyService.js` | Реализован `deactivateMember(companyId, userId)` через RPC `deactivate_member`; `company_members.status` добавлен; `getUserProfile` фильтрует только `status='active'` |
| G5 / B0.4 | ✅ **Closed** | `supabase/migrations/20260323000000_fix_company_members_unique_constraint_name.sql` | UNIQUE constraint переименован в `company_members_company_id_user_id_key`; upsert по `(company_id, user_id)` работает |
| G1 | **LOW / Phase B** | `src/services/propertiesService.js` L120–161 | District update фильтрует только по `user_id` — не охватывает `responsible_agent_id`. Перенесён в Phase B. |
| G4 | **LOW / Techdebt** | `src/services/authService.js` | Hardcoded email для роли `admin` при signUp. Не блокер. |

### Post-B0 fixes (locations)

| Статус | Что сделано |
|---|---|
| ✅ **Closed** | Web Account UI агента: локации загружаются через `getLocationsForAgent(userId, companyId)`; кнопка "Добавить/удалить локацию" скрыта для агента (`src/web/screens/WebAccountScreen.js`) |
| ✅ **Closed** | `WebPropertyEditPanel`: поля Город/Район заменены на dropdowns из `agent_location_access` / `getCompanyLocations`; свободный ввод запрещён; `location_id` сохраняется в БД |
| ✅ **Closed** | `getCompanyLocations(companyId)` добавлен в `locationsService.js` |
| ✅ **Closed** | RLS-политики `locations: company member read` и `location_districts: company member read` — применены в prod; зафиксированы в `20260327160000_rls_locations_company_first.sql` |

---

## 5. Итог

**Этап A: ЗАКРЫТ.**  
Role Contract v1.1 зафиксирован. Soft deactivate — единственный контракт увольнения. Hard delete запрещён.

**Этап B: READY TO START ✅**  
Все pre-B блокеры (B0.1–B0.4) закрыты. Дополнительные фиксы по локациям выполнены.  
_Предыдущий статус (до 2026-03-27): "НЕ стартуем до закрытия B0.1–B0.4"._

---

## Changelog

| Дата | Изменение |
|---|---|
| 2026-03-23 | Этап A зафиксирован. Role Contract v1.0 + Freeze Rules + DoD. |
| 2026-03-23 | Role Contract v1.1: soft deactivate как единственный контракт увольнения. |
| 2026-03-27 | Docs sync after B0 closure + locations fixes: B0.1–B0.4 closed, Post-B0 locations fixes отражены, статус Этапа B → READY TO START. |
| 2026-03-27 | Role Contract v1.2: company-first RLS зафиксирован для всех таблиц. Добавлены миграции `20260327130000–170000`. Contact Access Contract задокументирован. Policy matrix и removed-policies table добавлены в секцию 4. |
| 2026-03-27 | RLS safety hotfix: write policies теперь company-scoped (`user_id = auth.uid() AND (owner OR member of company_id)`) для `contacts`, `calendar_events`, `bookings`, `properties` INSERT. `bookings.company_id` NOT NULL зафиксирован в миграции с safety guard. |
| 2026-03-27 | bookings RLS final sync: split agent own policy into read/insert/update/delete; migration aligned with prod. |
| 2026-03-27 | Contact contract finalized; getContactById aligned with role-aware company-first access. Dual ownership fields (company_id = scope, user_id = author) задокументированы. |
