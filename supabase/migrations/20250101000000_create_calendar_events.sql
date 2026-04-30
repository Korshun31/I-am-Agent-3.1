-- Создание таблицы calendar_events (личный календарь пользователя)
-- Перенесено из supabase_migrations/calendar_events.sql при чистке legacy-папки.
-- Дата 20250101 — чтобы миграция оказалась в начале списка, до всех зависящих от calendar_events.
-- RLS-политики здесь не создаются: они навешиваются позднее в 20260327140000_rls_contacts_calendar_events.sql.

CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_date date NOT NULL,
  event_time time,
  title text NOT NULL,
  color text NOT NULL DEFAULT '#64B5F6',
  comments text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
