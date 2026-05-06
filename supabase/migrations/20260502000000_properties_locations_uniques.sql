-- TD-054: уникальный код объекта в рамках компании (с учётом code_suffix).
-- Дочерние юниты (дома в резорте, апартаменты в кондо) наследуют code от родителя,
-- различаются только code_suffix — поэтому ключ включает COALESCE(code_suffix, '').
-- Объекты без кода (NULL/пусто) — пропускаются, можно сколько угодно.

CREATE UNIQUE INDEX IF NOT EXISTS properties_company_code_suffix_unique
  ON properties (company_id, code, COALESCE(code_suffix, ''))
  WHERE code IS NOT NULL AND TRIM(code) <> '';

-- TD-068: уникальная локация (страна + регион + город) в рамках компании.

CREATE UNIQUE INDEX IF NOT EXISTS locations_company_geo_unique
  ON locations (company_id, country, region, city);
