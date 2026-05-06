-- TD-007: properties.updated_at — отметка последнего изменения объекта.
--
-- В prod (doosuanuttihcyxtkarf) колонка, backfill, default, NOT NULL,
-- функция и триггер фактически были накатаны 2026-04-22 через psql
-- напрямую — без файла миграции в git. Этот файл закрывает хвост:
-- идемпотентная версия миграции для воспроизводимости из репо и для
-- накатывания в sandbox (mdxujiuvmondmagfnwob) перед мержем dev→main.
--
-- Поведение: все CRUD на properties автоматически обновляют updated_at
-- через триггер. dataUploadService на тарифе korshun читает это поле
-- для сортировки объектов на сайте по дате последнего изменения.

-- 1) Колонка
ALTER TABLE properties ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- 2) Backfill для существующих строк. До этой миграции updated_at
--    не было — реальной истории нет, поэтому ставим created_at.
UPDATE properties
SET updated_at = created_at
WHERE updated_at IS NULL;

-- 3) Default + NOT NULL
ALTER TABLE properties ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE properties ALTER COLUMN updated_at SET NOT NULL;

-- 4) Функция-триггер: на каждом UPDATE проставляет updated_at = now().
CREATE OR REPLACE FUNCTION properties_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 5) Триггер BEFORE UPDATE
DROP TRIGGER IF EXISTS trg_properties_set_updated_at ON properties;
CREATE TRIGGER trg_properties_set_updated_at
BEFORE UPDATE ON properties
FOR EACH ROW
EXECUTE FUNCTION properties_set_updated_at();

-- 6) Перезагрузка кеша схемы PostgREST.
NOTIFY pgrst, 'reload schema';
