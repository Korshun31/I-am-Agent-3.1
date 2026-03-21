-- =============================================================================
-- TEAM FEATURE — Этап 2: дополнительные поля в таблице companies
-- =============================================================================
-- Добавляет поля для хранения всех данных компании (логотип, соцсети и т.д.)
-- Чтобы ОТМЕНИТЬ: запусти соответствующий down.sql
-- =============================================================================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS telegram TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS working_hours TEXT;
