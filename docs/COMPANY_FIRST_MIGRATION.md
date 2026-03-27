# Company-First Migration — Этап A: Контракт, Freeze, DoD

> Дата фиксации: 2026-03-23  
> Версия контракта: **v1.1** (обновлено: soft deactivate как единственное правило увольнения)  
> Статус: **ЭТАП A ЗАКРЫТ — ожидает старта Этапа B**

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

## 4. Gap Check

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

### ❌ Расхождения (файл + суть):

| # | Приоритет | Файл | Проблема |
|---|---|---|---|
| G2 | **BLOCKER** | `src/services/propertiesService.js` L15–16 | `getProperties(agentId)` фильтрует только по `responsible_agent_id`, не `agent_id OR responsible_agent_id`. Агент не видит объекты, которые создал сам. |
| G3 | **BLOCKER** | `src/services/companyService.js` | Нет `deactivateMember` (soft) и `reactivateMember`. Нет колонки `status` в `company_members`. |
| G6 | **BLOCKER** | `src/services/propertiesService.js` L36, 60 | `createProperty/Full` не проставляет `company_id` для агентов — нарушает company-first инвариант. |
| G5 | **HIGH** | `supabase/migrations/…stage1_up.sql` L34 | UNIQUE constraint мог остаться по старому имени `(company_id, agent_id)` — проверить в Supabase Dashboard. Если не переименован — `upsert` по `(company_id, user_id)` не работает. |
| G1 | **LOW** | `src/services/propertiesService.js` L120–161 | District update фильтрует только по `agent_id`, не охватывает `responsible_agent_id`. Можно перенести в Phase B. |
| G4 | **LOW** | `src/services/authService.js` L14 | Hardcoded email для роли `admin` при signUp. Техдолг, не блокер. |

### Что блокирует переход к Этапу B:

**B0.1** — `getProperties`: исправить фильтр на `.or('agent_id.eq.${agentId},responsible_agent_id.eq.${agentId}')` (G2).

**B0.2** — `createProperty/Full`: при создании объекта агентом автоматически проставлять `company_id` (G6). Варианты: передавать из JS-контекста или добавить SQL-триггер.

**B0.3** — Реализовать **soft** `deactivateMember(userId, companyId)` (G3):
- a) Добавить `status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive'))` в `company_members` (миграция `[FREEZE EXCEPTION]`).
- b) `UPDATE company_members SET status='inactive' WHERE user_id=… AND company_id=…`
- c) `DELETE FROM agent_location_access WHERE user_id=… AND company_id=…`
- d) `UPDATE properties SET responsible_agent_id=NULL WHERE company_id=… AND responsible_agent_id=…`
- e) `role`, `permissions`, `joined_at` — **сохраняются**.
- f) `auth.users` — **не трогать**.
- Опционально: `reactivateMember(userId, companyId)` → `status='active'`.

**B0.4** — Проверить в Supabase Dashboard: UNIQUE constraint на `company_members` — по `(company_id, user_id)`, не по старому `agent_id` (G5).

---

## 5. Итог

**Этап A: ЗАКРЫТ.**  
Role Contract v1.1 зафиксирован. Soft deactivate — единственный контракт увольнения. Hard delete запрещён.

**Этап B: НЕ стартуем** до закрытия B0.1 – B0.4 (три BLOCKER + один HIGH).
