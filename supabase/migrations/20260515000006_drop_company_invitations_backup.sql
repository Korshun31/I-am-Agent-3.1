-- Удаляем backup-таблицу company_invitations_backup_2026_04_27.
-- Она была создана 2026-04-27 в миграции 20260427000000_invitation_flow_v2.sql
-- как страховочный снапшот таблицы company_invitations перед переходом на
-- magic-link flow v2. С тех пор v2-flow обкатан, TestFlight build 34 на проде,
-- ни одного отката не потребовалось. Таблица никем не используется (grep по
-- src/ / supabase/functions/ / scripts/ пуст), RLS включён и политик нет —
-- сейчас она невидима всем, но при случайном permissive-правиле в Dashboard
-- наружу могли бы утечь все исторические приглашения с invite_token / email.
--
-- DROP TABLE с IF EXISTS — идемпотентно, не упадёт если её уже удалили.

DROP TABLE IF EXISTS public.company_invitations_backup_2026_04_27;
