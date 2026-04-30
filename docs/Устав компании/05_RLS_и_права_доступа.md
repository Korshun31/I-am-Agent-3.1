# 🔐 RLS и права доступа

---

## Унификация терминологии plan vs role (2026-03-30)

> Введено: 2026-03-30, migration `20260330000002_canonical_plan_and_roles.sql`.  
> Цель: разделить понятия "тарифный план" и "роль в команде".

### Тарифные планы (`agents.plan`)

| Значение | Описание |
|----------|----------|
| `standard` | Базовый пользователь |
| `premium` | Владелец компании или участник команды |
| `korshun` | Super-admin (korshun31@list.ru) |

Поле `agents.role` остаётся для обратной совместимости (не удалено в Phase 1).

### Роли в команде (`company_members.role`)

| Значение | Описание |
|----------|----------|
| `admin` | Владелец компании (ранее `owner`, мигрировано) |
| `agent` | Приглашённый агент с ограниченными правами |

Значение `owner` удалено из check constraint и мигрировано в `admin`.

### Бугфикс Phase 1

`company_members.status` (TEXT `'active'`|`'inactive'`) отсутствовал во всех предыдущих миграциях.  
authService выполнял `.eq('status','active')` → PostgREST error → `membershipData=null` → агенты не определялись как члены команды.  
Исправлено добавлением колонки с `DEFAULT 'active'` для всех существующих строк.

---

## Матрица ролей

| Операция | Company Owner (Admin) | Agent (team member) | Анонимный |
|----------|-----------------------|---------------------|-----------|
| SELECT properties | ✅ (все объекты компании) | ✅ **только** `responsible_agent_id = uid` | ❌ |
| INSERT property | ✅ | ✅ при `can_manage_property` (с company scope) | ❌ |
| UPDATE property | ✅ | ✅ при `can_manage_property` + `responsible_agent_id = uid` | ❌ |
| DELETE property (admin) | ✅ (любой объект компании) | — | ❌ |
| DELETE property (agent) | ✅ | ✅ при `can_manage_property` + `responsible_agent_id = uid` | ❌ |
| INSERT booking | ✅ | ✅ при `can_manage_bookings` (с company scope) | ❌ |
| UPDATE booking | ✅ | ✅ при `can_manage_bookings` + `booking_agent_id = uid` | ❌ |
| DELETE booking | ✅ | ✅ при `can_manage_bookings` + `booking_agent_id = uid` | ❌ |
| SELECT notifications | ✅ | ✅ (только свои) | ❌ |
| INSERT notifications | ✅ | ✅ | ❌ |
| SELECT bookings | ✅ (все компании) | ✅ (только свои объекты) | ❌ |
| SELECT contacts | ✅ | ✅ (собственники своих объектов, клиенты своих бронирований) | ❌ |

> **Критическое правило (CF-001):** `properties.user_id` (создатель) **не является** правом доступа. После переназначения ответственного или его снятия агент-создатель теряет доступ к объекту немедленно. Единственный критерий доступа агента — `responsible_agent_id = auth.uid()`.

> **LOCK-001 — снят 2026-04-30 (этап 2 — упрощение прав, модерация выпилена).** Старая логика «удалять только не-approved» убрана. Новая: агент удаляет свой объект при `can_manage_property = true` И `responsible_agent_id = auth.uid()`. См. RLS-миграцию `20260429000001_simplify_properties_rls_phase2.sql`.

---

## Актуальная модель ролей (checkpoint 2026-03-30)

- Действующая модель `company_members.role`: только `admin` и `agent`.
- Исторические значения `owner` и `worker` считаются legacy-терминами и не являются действующим правилом доступа.
  - `owner` в старых миграциях соответствует текущему `admin`.
  - `worker` удалён из действующей модели.
- Проверено по constraint'ам БД:
  - `company_members_role_check` допускает только `admin/agent`;
  - `company_members_status_check` допускает только `active/inactive`.

---

## Approve / Reject — снято 2026-04-30 (этап 2)

Модерация выпилена. Функции `approveProperty`, `approvePropertyDraft`, `rejectProperty`, `rejectPropertyDraft` удалены из `propertiesService`. Таблица `property_drafts` и её RLS-политики дропнуты в RLS-миграции этапа 2 (`20260429000001_simplify_properties_rls_phase2.sql`).

## Rejection History — снято 2026-04-30 (этап 2)

Таблица `property_rejection_history` физически остаётся в БД до этапа 3 (cleanup-миграция дропнет её), но не пишется и не читается. RLS-политики пока сохранены, но не имеют практического значения.

---

## Agent permissions (granular)

Из `company_members.permissions` JSONB:

| Поле | Что разрешает |
|------|--------------|
| `can_manage_property` | Добавлять, редактировать (включая цены) и удалять свои объекты |
| `can_manage_bookings` | Добавлять, редактировать и удалять свои бронирования |

**Сняты 2026-04-30 (этап 2 — упрощение прав, модерация выпилена):**
- `can_add_property`, `can_edit_info`, `can_edit_prices` — заменены на единый `can_manage_property`
- `can_book`, `can_delete_booking` — заменены на единый `can_manage_bookings`
- `can_see_financials` (TD-088) — агент всегда видит финансы своих бронирований
- `can_manage_clients` (TD-102) — агент всегда работает со своими контактами

Старые ключи физически остаются в JSONB до этапа 3 (cleanup-миграция), но не читаются ни кодом, ни RLS.

---

## Proposal: роль "помощник админа" / `can_moderate_properties` — закрыто 2026-04-30

**Статус:** ❌ ЗАКРЫТО в пользу простоты (P1-002 снят 2026-04-30, этап 2).

Модерация целиком выпилена. Идея «старшего агента» с правом одобрять/отклонять чужие объекты больше не имеет смысла — одобрять нечего. Если в будущем понадобится разделить агентов по уровню ответственности — это будет другая концепция, не основанная на approve/reject flow.
