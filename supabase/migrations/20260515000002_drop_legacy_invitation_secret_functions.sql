-- Дроп четырёх legacy-функций старого invite-flow с 6-значным secret_code.
-- С 2026-04-27 (миграция 20260427000000_invitation_flow_v2.sql) проект перешёл
-- на magic-link через Supabase Auth + Resend. Функции оставались живыми ради
-- прогрева TestFlight; build 34 на проде, magic-link flow обкатан 2026-05-15.
--
-- Проверки перед дропом:
--   * grep по src/, supabase/functions/, scripts/, App.js — ноль вызовов
--     ни одной из четырёх функций;
--   * grep по supabase/migrations/ — ни одна функция не зовётся изнутри тел
--     других PL/pgSQL функций (включая live join_company_via_invitation /
--     handle_new_user / get_invitation_status);
--   * VIEW / триггеров / RLS-политик с зависимостями нет;
--   * явных GRANT'ов в миграциях нет, дефолтные привилегии уходят вместе с
--     функцией.
--
-- Семантические замены:
--   verify_invitation_secret(token, code) → join_company_via_invitation(token)
--     сам валидирует токен / email caller'а / status / expiry.
--   get_invitation_by_token(token) → get_invitation_status(token)
--     без side-effect sent→pending (в v2 не нужен — join принимает оба статуса).
--   reset_invitation_secret(invitation_id) → resend через Edge Function
--     invite-agent с resend: true.
--   generate_secret_code() → не нужна, secret_code в company_invitations
--     стал nullable.
--
-- Таблица company_invitations и её колонки secret_code / attempts НЕ
-- трогаются — отдельный TD на колоночный cleanup.
-- Backup-таблица company_invitations_backup_2026_04_27 переживает дроп
-- (к функциям не обращалась) — её судьба отдельная (TD #11 в отчёте).
--
-- Сигнатуры указаны явно, чтобы DROP не зацепил случайную перегрузку.

DROP FUNCTION IF EXISTS public.verify_invitation_secret(uuid, text);
DROP FUNCTION IF EXISTS public.reset_invitation_secret(uuid);
DROP FUNCTION IF EXISTS public.get_invitation_by_token(uuid);
DROP FUNCTION IF EXISTS public.generate_secret_code();
