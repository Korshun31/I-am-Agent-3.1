-- Однократная миграция данных: перенос районов из properties в location_districts.
-- Перенесено из supabase_migrations/migrate_properties_districts_to_location_districts.sql.
-- Идемпотентная (ON CONFLICT DO NOTHING) — повторный запуск безопасен.

INSERT INTO location_districts (location_id, district)
SELECT DISTINCT p.location_id, trim(p.district)
FROM properties p
WHERE p.location_id IS NOT NULL
  AND p.district IS NOT NULL
  AND trim(p.district) <> ''
ON CONFLICT (location_id, district) DO NOTHING;
