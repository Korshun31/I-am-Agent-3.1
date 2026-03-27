# Company-First Migration — Этап A: Контракт, Freeze, DoD

> Дата фиксации: 2026-03-23  
> Статус: **УТВЕРЖДЁН (ожидает старта Этапа B)**

---

## 1. Role Contract v1

### Роли и права

| Роль | Источник | Права |
|---|---|---|
| `owner` | `companies.owner_id` + `company_members.role='owner'` | Полный доступ ко всем данным компании. Управляет командой. Одобряет/отклоняет черновики. |
| `agent` | `company_members.role='agent'` | Видит только свои объекты + назначенные. Создаёт черновики (не публикует напрямую). Не редактирует районы/локации. |
| `worker` | **UI-термин только** | `owner` без активной команды. В коде не реализуется — только визуальное разделение в UI. |

### Источник прав

- **Идентичность**: `auth.users.id` = `user_id` везде.
- **Роль в компании**: `company_members.role` + `company_members.permissions` (JSONB).
- **Доступные локации агента**: `agent_location_access(user_id, company_id, location_id)`.
- **Права на конкретные действия**: `teamPermissions` (JS-объект из `company_members.permissions`).

### Правило увольнения агента

- Деактивировать членство: удалить запись из `company_members` (или добавить `status='inactive'` — см. Риск R3).
- `auth.users` НЕ удалять — пользователь сохраняет личный аккаунт.
- При деактивации: удалить записи из `agent_location_access` для данной компании.
- Объекты, где агент был `responsible_agent_id`, передать компании (`responsible_agent_id = NULL`).

### Ограничение: role `owner` (собственник недвижимости)

- Роль "собственник объекта" (`property_owners` / `contacts`) в текущей фазе **не реализуется**.
- Таблица `properties.owner_id` существует, но ссылается на `contacts`, не на `auth.users` — архитектурно нейтральна.
- В Phase B не трогать.

---

## 2. Migration Freeze Rules (Sprint Freeze)

### Запрещено (без согласования):

1. Переименовывать колонку `properties.agent_id` — она используется в RLS и в сервисных функциях.
2. Менять структуру `company_members` (добавлять/удалять колонки).
3. Менять RLS-политики на `companies`, `company_members`, `properties` — любая ошибка = потеря доступа.
4. Менять сигнатуру `auth_is_company_owner` и `auth_is_company_member` — используются в 4+ RLS политиках.
5. Менять `getUserProfile` — центральная функция, изменение ломает весь AuthContext.
6. Менять `get_company_team` SQL-функцию.

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
- [ ] `agent` видит только `agent_id = user.id` OR `responsible_agent_id = user.id`.
- [ ] При добавлении объекта агентом — объект получает `company_id` компании агента автоматически.
- [ ] Агент без назначенных локаций не видит чужих локаций/районов.
- [ ] Увольнение агента (`deactivateMember`) — записи в `agent_location_access` удаляются, объекты переходят к компании.
- [ ] `broadcastChange('permissions')` корректно обновляет права агента на всех клиентах.
- [ ] `worker` (owner без команды) не видит раздел Team в UI.

### SQL-инварианты:

- [ ] Каждый объект компании имеет `properties.company_id IS NOT NULL` (не `NULL` для новых объектов).
- [ ] `company_members` не содержит записей с одним `user_id` в двух разных компаниях (один агент — одна компания).
- [ ] `agent_location_access` не содержит записей без соответствующего `company_members` (orphan rows).
- [ ] `property_drafts.user_id` всегда ссылается на существующий `auth.users.id`.
- [ ] `auth_is_company_member(company_id)` возвращает `TRUE` для `owner` (owner есть в `company_members` с `role='owner'`).

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

| # | Файл | Проблема |
|---|---|---|
| G1 | `src/services/propertiesService.js` L120, 134, 153, 161 | Функции `updatePropertiesDistrictForLocation` и `updateResortChildrenDistrict` фильтруют по `properties.agent_id` — это корректно (колонка не переименована), но агент-компания не может редактировать объекты, где он `responsible_agent_id`, только где он `agent_id`. |
| G2 | `src/services/propertiesService.js` L15–16 | `getProperties(agentId)` фильтрует только по `responsible_agent_id`, не по `agent_id OR responsible_agent_id`. Агент не видит объекты, которые он создал сам (там `agent_id = user.id`, но `responsible_agent_id` может быть другим). |
| G3 | `src/services/companyService.js` | Нет функции `deactivateMember(memberId)` — нельзя "уволить" агента. Контракт требует такого механизма. |
| G4 | `src/services/authService.js` L14 | `signUp` содержит hardcoded email (`korshun31@list.ru`) для роли `admin`. Это техдолг, но не блокер для Phase B. |
| G5 | `supabase/migrations/20250321000000_team_feature_stage1_up.sql` L34 | Исходная миграция создала `company_members` с колонкой `agent_id` и UNIQUE constraint `(company_id, agent_id)`. После rename UNIQUE constraint называется `(company_id, agent_id)` — нужно проверить, что constraint переименован или пересоздан с правильным именем. Если нет — `activateCompany` upsert по `onConflict: 'company_id,user_id'` может не работать. |
| G6 | `src/services/propertiesService.js` L36, 60 | `createProperty` и `createPropertyFull` устанавливают `agent_id: session.user.id` но не устанавливают `company_id` для агентов — объект создаётся без привязки к компании. DoD требует `company_id IS NOT NULL` для компанейских объектов. |

### Что блокирует переход к Этапу B:

| Приоритет | Gap | Почему блокирует |
|---|---|---|
| **BLOCKER** | G2 | Агент не видит часть своих объектов → дата-integrity нарушена уже сейчас |
| **BLOCKER** | G6 | Новые объекты агентов создаются без `company_id` → company-first модель невозможна без этого |
| **BLOCKER** | G3 | Нет механизма увольнения → контракт не может быть выполнен |
| **HIGH** | G5 | Риск что `upsert` на `company_members` сломан — нужно проверить в Supabase Dashboard |
| **LOW** | G4 | Techdebt, не блокирует |
| **LOW** | G1 | District update работает для созданных объектов — можно перенести на Phase B |

---

## 5. Итог

**Готовы ли мы стартовать Этап B: НЕТ**

### Что нужно закрыть до старта Phase B (в порядке приоритета):

**B0.1** — Исправить `getProperties` в `propertiesService.js`: фильтр `.or('agent_id.eq.${agentId},responsible_agent_id.eq.${agentId}')` (G2).

**B0.2** — В `createPropertyFull` / `createProperty`: при создании объекта агентом автоматически проставлять `company_id = teamMembership.companyId` (G6). Нужно передавать `company_id` из контекста или добавить SQL-триггер `auto_set_property_company`.

**B0.3** — Реализовать `deactivateMember(memberId, companyId)` в `companyService.js`: удалять из `company_members`, очищать `agent_location_access`, переназначать `responsible_agent_id → NULL` на объектах (G3).

**B0.4** — Проверить в Supabase Dashboard: UNIQUE constraint на `company_members` работает по `(company_id, user_id)` (не по старому `agent_id`) — иначе исправить через миграцию (G5).

После закрытия этих 4 пунктов — зелёный свет на Phase B.
