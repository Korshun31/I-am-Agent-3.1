-- Закрываем два канала enumeration перед публичным запуском.
--
-- 1) public.check_email_status(text)
--    SECURITY DEFINER функция, возвращающая 'free' / 'occupied' / 'orphan'
--    по произвольному email. Использовалась только edge-функцией
--    invite-agent через adminClient (service_role). В коде фронта / scripts /
--    CI её никто не зовёт. До этой миграции у anon и authenticated был
--    GRANT EXECUTE — любой залогиненный юзер мог брутфорсом по списку
--    email-адресов конкурентов узнавать, кто из них уже в системе.
--    Отзываем EXECUTE у anon / authenticated, явно подтверждаем у service_role.
--
-- 2) public.check_pending_invitation(text)
--    SECURITY DEFINER функция, возвращавшая по произвольному email название
--    компании + invite_token + status pending-приглашения. В коде не
--    вызывается с 2026-04-27 (коммит 305c5ef, invitation flow v2 на
--    magic-link). Бизнес-задача покрыта get_invitation_status(p_token UUID)
--    + join_company_via_invitation(p_token UUID). Внутренних SQL-вызовов /
--    VIEW / триггеров / RLS-политик с упоминанием функции нет. pg_depend-
--    зависимостей наружу не существует — DROP без CASCADE безопасен.
--    DROP IF EXISTS — идемпотентно.

REVOKE EXECUTE ON FUNCTION public.check_email_status(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_email_status(text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.check_email_status(text) TO service_role;

DROP FUNCTION IF EXISTS public.check_pending_invitation(text);
