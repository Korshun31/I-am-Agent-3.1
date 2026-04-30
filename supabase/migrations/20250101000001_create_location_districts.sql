-- Создание таблицы location_districts (справочник районов внутри локации)
-- Перенесено из supabase_migrations/location_districts.sql при чистке legacy-папки.
-- Дата 20250101 — чтобы миграция оказалась в начале списка, до всех зависящих от location_districts.
-- RLS-политики здесь не создаются: они навешиваются позднее в 20260327160000_rls_locations_company_first.sql.

CREATE TABLE IF NOT EXISTS location_districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  district text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(location_id, district)
);

ALTER TABLE location_districts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_location_districts_location_id ON location_districts(location_id);
