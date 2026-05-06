# 🔍 SQL Sanity Check после миграций

> ⚠️ **Снято 2026-04-30 (этап 2 — упрощение прав, модерация выпилена).** Все проверки в этом файле относятся к таблицам `property_rejection_history` и `property_drafts`, которые сняты в этапе 2 и будут физически удалены в этапе 3 (cleanup-миграция). Запускать эти проверки в работающей системе смысла нет.
>
> Файл оставлен как историческая справка о структуре снятых таблиц — пригодится при подготовке cleanup-миграции этапа 3, чтобы убедиться что таблицы существуют перед `DROP TABLE`.

Запускать после каждой миграции в Supabase SQL Editor (или через CLI).

---

## 1. Таблица существует

```sql
-- property_rejection_history
SELECT to_regclass('public.property_rejection_history') IS NOT NULL AS exists;
-- Expected: true

-- property_drafts
SELECT to_regclass('public.property_drafts') IS NOT NULL AS exists;
-- Expected: true

-- notifications
SELECT to_regclass('public.notifications') IS NOT NULL AS exists;
-- Expected: true
```

---

## 2. Структура таблицы `property_rejection_history`

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'property_rejection_history'
ORDER BY ordinal_position;
```

**Ожидаемые колонки:**

| column_name | data_type | is_nullable |
|-------------|-----------|-------------|
| id | uuid | NO |
| property_id | uuid | NO |
| reason | text | NO |
| rejection_type | text | NO |
| rejected_by | uuid | YES |
| created_at | timestamptz | NO |

---

## 3. Constraints и CHECK

```sql
SELECT constraint_name, constraint_type, check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc USING (constraint_name)
WHERE tc.table_name = 'property_rejection_history';
```

**Ожидаемый CHECK:**  
`rejection_type IN ('property_submitted','edit_submitted','price_submitted','manual')`

---

## 4. RLS активен

```sql
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'property_rejection_history';
-- Ожидаемый результат: relrowsecurity = true
```

---

## 5. Политики RLS

```sql
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'property_rejection_history';
```

**Ожидаемые политики:**
- `rejection_history: owner reads company` (SELECT)
- `rejection_history: agent reads own and assigned` (SELECT)
- `rejection_history: owner can insert` (INSERT)

---

## 6. Индексы

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'property_rejection_history';
```

**Ожидаемый индекс:**  
`idx_property_rejection_history_property_date` ON `(property_id, created_at DESC)`

---

## 7. Smoke insert/select (от имени admin)

> Выполнять только в dev/staging, не в production!

```sql
-- Подставить реальные UUID
INSERT INTO property_rejection_history (property_id, reason, rejection_type, rejected_by)
VALUES (
  '<real_property_id>',
  'Smoke test reason',
  'manual',
  auth.uid()
)
RETURNING *;

-- Проверить, что запись появилась:
SELECT * FROM property_rejection_history
WHERE property_id = '<real_property_id>'
ORDER BY created_at DESC
LIMIT 5;
```

---

## 8. Проверка накопления истории

```sql
-- Для конкретного объекта посчитать историю:
SELECT
  COUNT(*) AS total_rejections,
  MAX(created_at) AS latest_rejection,
  MIN(created_at) AS first_rejection
FROM property_rejection_history
WHERE property_id = '<property_uuid>';
```

---

## 9. Проверка agent не может INSERT

```sql
-- Переключиться на роль агента (через RLS test) или проверить через Supabase Dashboard → Table Editor с правами агента
-- Ожидаемый результат: INSERT возвращает ошибку "new row violates row-level security policy"
```

---

## 10. Проверка состояния объекта после отклонений

```sql
SELECT
  p.id,
  p.property_status,
  p.rejection_reason,
  COUNT(prh.id) AS history_count
FROM properties p
LEFT JOIN property_rejection_history prh ON prh.property_id = p.id
WHERE p.property_status = 'rejected'
GROUP BY p.id, p.property_status, p.rejection_reason
ORDER BY history_count DESC;
```

**Что искать:**
- `history_count = 0` при заполненном `rejection_reason` → кандидаты для backfill (см. `04_SQL_миграции_реестр.md`)
- `rejection_reason = ''` при `history_count > 0` → нормально (auto-approve был выполнен, история осталась)
