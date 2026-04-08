-- TD-001: Очистка устаревшего поля agents.role
-- Поле agents.role содержит мусор: значение 'standard' является тарифом, не ролью
-- Роль хранится ТОЛЬКО в company_members.role
-- Тариф хранится ТОЛЬКО в agents.plan

UPDATE agents SET role = NULL WHERE role = 'standard';
