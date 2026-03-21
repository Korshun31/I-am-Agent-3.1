-- =============================================================================
-- TEAM FEATURE — Этап 1: ОТКАТ (ROLLBACK)
-- =============================================================================
-- Отменяет ВСЁ что сделал 20250321000000_team_feature_stage1_up.sql
--
-- ⚠️  ВНИМАНИЕ: этот скрипт УДАЛИТ все данные из таблиц:
--     companies, company_members, company_invitations
--     и удалит новые поля из properties.
--
-- Запускать только если что-то пошло не так!
-- =============================================================================

-- Удаляем функции
DROP FUNCTION IF EXISTS generate_secret_code();
DROP FUNCTION IF EXISTS verify_invitation_secret(UUID, TEXT);
DROP FUNCTION IF EXISTS get_invitation_by_token(UUID);
DROP FUNCTION IF EXISTS auth_is_company_owner(UUID);
DROP FUNCTION IF EXISTS auth_is_company_member(UUID);

-- Удаляем индексы на properties (до удаления колонок)
DROP INDEX IF EXISTS idx_properties_responsible_agent_id;
DROP INDEX IF EXISTS idx_properties_company_id;

-- Удаляем новые поля из properties
ALTER TABLE properties DROP COLUMN IF EXISTS submitted_by;
ALTER TABLE properties DROP COLUMN IF EXISTS rejection_reason;
ALTER TABLE properties DROP COLUMN IF EXISTS property_status;
ALTER TABLE properties DROP COLUMN IF EXISTS responsible_agent_id;
ALTER TABLE properties DROP COLUMN IF EXISTS company_id;

-- Удаляем таблицы в обратном порядке (из-за зависимостей FK)
DROP TABLE IF EXISTS company_invitations;
DROP TABLE IF EXISTS company_members;
DROP TABLE IF EXISTS companies;
