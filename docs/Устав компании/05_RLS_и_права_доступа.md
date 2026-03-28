# 🔐 RLS и права доступа

---

## Матрица ролей

| Операция | Company Owner (Admin) | Agent (team member) | Анонимный |
|----------|-----------------------|---------------------|-----------|
| SELECT properties (своей компании) | ✅ | ✅ (только свои + assigned) | ❌ |
| INSERT property | ✅ | ✅ (с company scope) | ❌ |
| UPDATE property | ✅ | ✅ (только своей + assigned, с `can_edit_info`) | ❌ |
| DELETE property | ✅ | ❌ | ❌ |
| Approve/Reject property | ✅ | ❌ | ❌ |
| SELECT property_drafts | ✅ (все компании) | ✅ (только свои) | ❌ |
| INSERT property_drafts | ✅ | ✅ | ❌ |
| SELECT property_rejection_history | ✅ | ✅ (только своих объектов) | ❌ |
| INSERT property_rejection_history | ✅ (company owner only) | ❌ | ❌ |
| SELECT notifications | ✅ | ✅ (только свои) | ❌ |
| INSERT notifications | ✅ | ✅ | ❌ |
| SELECT bookings | ✅ (все компании) | ✅ (только свои объекты) | ❌ |
| SELECT contacts | ✅ | ✅ (собственники своих объектов, клиенты своих бронирований) | ❌ |

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

-- Agent policy:
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
