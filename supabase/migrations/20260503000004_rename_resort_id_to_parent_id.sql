-- TD-043: переименовать properties.resort_id в parent_id.
-- Имя resort_id исторически узкое — поле работает и для резортов (parent → houses)
-- и для кондо (parent → apartments). Семантически это просто id родителя.
--
-- Безопасно: ALTER TABLE RENAME COLUMN атомарен, FK constraint сохраняется автоматически.
-- SQL-функций / RLS-политик / triggers, использующих resort_id, в проекте нет.
--
-- Rollback: симметрично переименовать обратно (resort_id ← parent_id).

ALTER TABLE properties RENAME COLUMN resort_id TO parent_id;

-- Индекс может отсутствовать (явного CREATE INDEX в миграциях нет) — IF EXISTS страхует.
ALTER INDEX IF EXISTS idx_properties_resort_id RENAME TO idx_properties_parent_id;

-- FK constraint: имя могло сгенерироваться или быть явным. Переименовываем для красоты.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'properties_resort_id_fkey'
      AND conrelid = 'properties'::regclass
  ) THEN
    ALTER TABLE properties RENAME CONSTRAINT properties_resort_id_fkey TO properties_parent_id_fkey;
  END IF;
END $$;

-- Сбросить кэш PostgREST, чтобы клиент сразу видел parent_id вместо resort_id.
NOTIFY pgrst, 'reload schema';
