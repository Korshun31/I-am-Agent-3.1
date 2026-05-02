-- TD-054 / TD-068 — пересоздаём индексы как case-insensitive c TRIM,
-- чтобы 'Test 1' и 'TEST 1' (или 'Bangkok' и 'bangkok') считались дубликатами.
-- Дублей при UPPER(TRIM(...)) сравнении нет — проверено SELECT'ом до миграции.

DROP INDEX IF EXISTS properties_company_code_suffix_unique;
DROP INDEX IF EXISTS locations_company_geo_unique;

CREATE UNIQUE INDEX IF NOT EXISTS properties_company_code_suffix_unique
  ON properties (company_id, UPPER(TRIM(code)), UPPER(COALESCE(TRIM(code_suffix), '')))
  WHERE code IS NOT NULL AND TRIM(code) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS locations_company_geo_unique
  ON locations (company_id, UPPER(TRIM(country)), UPPER(TRIM(region)), UPPER(TRIM(city)));
