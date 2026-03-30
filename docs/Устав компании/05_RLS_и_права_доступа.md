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
| INSERT property | ✅ | ✅ (с company scope) | ❌ |
| UPDATE property | ✅ | ✅ **только** `responsible_agent_id = uid` | ❌ |
| DELETE property (admin) | ✅ (любой объект компании) | — | ❌ |
| DELETE property (agent) | ✅ | ✅ только создатель + статус НЕ `approved` (см. LOCK-001) | ❌ |
| Approve/Reject property | ✅ | ❌ | ❌ |
| SELECT property_drafts | ✅ (все компании) | ✅ (только свои) | ❌ |
| INSERT property_drafts | ✅ | ✅ | ❌ |
| SELECT property_rejection_history | ✅ | ✅ (только своих объектов) | ❌ |
| INSERT property_rejection_history | ✅ (company owner only) | ❌ | ❌ |
| SELECT notifications | ✅ | ✅ (только свои) | ❌ |
| INSERT notifications | ✅ | ✅ | ❌ |
| SELECT bookings | ✅ (все компании) | ✅ (только свои объекты) | ❌ |
| SELECT contacts | ✅ | ✅ (собственники своих объектов, клиенты своих бронирований) | ❌ |

> **Критическое правило (CF-001):** `properties.user_id` (создатель) **не является** правом доступа. После переназначения ответственного или его снятия агент-создатель теряет доступ к объекту немедленно. Единственный критерий доступа агента — `responsible_agent_id = auth.uid()`.

> **LOCK-001 — Удаление объекта по роли (утверждено Human Owner):**  
> Роль `agent` может удалить объект **только** при одновременном выполнении двух условий:  
> 1. Агент является создателем: `properties.user_id = auth.uid()`  
> 2. Статус объекта **не** `approved`: `coalesce(property_status, 'approved') <> 'approved'`  
>  
> Роль `agent` **никогда** не может удалить `approved` объект, даже если является его создателем.  
> Для роли `admin` ограничение `approved` **не применяется**; удаление регулируется стандартными RLS компании.

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

## Approve / Reject — кто может

**Approve:**
- `approveProperty` — только company owner (через RLS UPDATE на `properties`)
- `approvePropertyDraft` — только company owner

**Reject:**
- `rejectProperty` — company owner → обновляет `properties` + INSERT в `property_rejection_history`
- `rejectPropertyDraft` — company owner → обновляет `property_drafts` + `properties` + INSERT в `property_rejection_history`

RLS на `property_rejection_history` INSERT:
```sql
WITH CHECK (
  EXISTS (
    SELECT 1 FROM properties p
    JOIN companies c ON c.id = p.company_id
    WHERE p.id = property_rejection_history.property_id
      AND c.owner_id = auth.uid()
  )
);
```

---

## Rejection History — кто читает

**Company owner:** видит историю всех объектов своей компании.  
**Agent:** видит историю объектов, которые создал или назначен ответственным.

```sql
-- Owner policy:
EXISTS (
  SELECT 1 FROM properties p JOIN companies c ON c.id = p.company_id
  WHERE p.id = property_rejection_history.property_id AND c.owner_id = auth.uid()
)

-- Agent policy (для истории user_id намеренно сохранён: агент-создатель должен видеть
-- историю отклонений своего объекта даже после переназначения ответственного):
EXISTS (
  SELECT 1 FROM properties p
  WHERE p.id = property_rejection_history.property_id
    AND (p.user_id = auth.uid() OR p.responsible_agent_id = auth.uid())
)
```

---

## Agent permissions (granular)

Из `company_members.permissions` JSONB:

| Поле | Что разрешает |
|------|--------------|
| `can_edit_info` | Редактировать основные поля объекта |
| `can_edit_prices` | Редактировать цены |
| `can_see_financials` | Видеть комиссии и финансы |
| `can_add_property` | Добавлять новые объекты |
| `can_book` | Создавать бронирования |
| `can_delete_booking` | Удалять бронирования |
| `can_manage_clients` | Управлять контактами |

---

## Proposal: роль "помощник админа" / `can_moderate_properties`

**Статус:** PROPOSAL (не реализовано).

**Проблема:** сейчас только `company.owner_id` может approve/reject. Если нужен "старший агент" с правом модерации — необходимо:

1. Добавить `can_moderate_properties: boolean` в `company_members.permissions`.
2. Обновить RLS INSERT на `property_rejection_history`:
   ```sql
   -- Добавить к текущей policy:
   OR EXISTS (
     SELECT 1 FROM company_members cm
     JOIN properties p ON p.company_id = cm.company_id
     WHERE p.id = property_rejection_history.property_id
       AND cm.user_id = auth.uid()
       AND cm.status = 'active'
       AND (cm.permissions->>'can_moderate_properties')::boolean = true
   )
   ```
3. Обновить `rejectProperty` / `rejectPropertyDraft` / `approveProperty` аналогично.
4. Сделать отдельной миграцией с полным описанием совместимости.

**Риски:** расширение поверхности атаки (больше пользователей могут менять статусы). Требует аудита всех approve/reject flow.
