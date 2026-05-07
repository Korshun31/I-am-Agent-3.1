-- TD-123 (Realtime sync overhaul) — шаг 1: подготовка БД к переходу с manual broadcast
-- на postgres_changes + private channels.
--
-- Что делает миграция (только аддитивные операции, существующий код не затрагивает):
-- 1. Добавляет в publication supabase_realtime пять таблиц: contacts, company_invitations,
--    agent_location_access, companies, users_profile. После этого Postgres начинает
--    отправлять realtime-события по этим таблицам всем подписчикам с правом чтения.
-- 2. Переводит REPLICA IDENTITY в режим FULL для восьми таблиц, которые подпишутся
--    через postgres_changes на следующем шаге. FULL заставляет Postgres писать в WAL
--    полную старую строку при UPDATE/DELETE — без этого realtime-payload содержит
--    только первичный ключ, и фильтр company_id=eq.X не сможет применяться к старой
--    версии строки (актуально для DELETE).
-- 3. Таблица notifications в FULL не переводится: подписчиков postgres_changes на ней
--    нет (web-тосты в WebMainScreen.js слушают bookings/calendar_events/properties).
-- 4. Таблица properties уже имеет REPLICA IDENTITY FULL (см. baseline), повторно
--    не выставляем.

-- 1) Добавление таблиц в publication. Используем DO-блок с проверкой,
--    чтобы миграция была идемпотентной (можно прогнать второй раз без ошибки).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'contacts',
    'company_invitations',
    'agent_location_access',
    'companies',
    'users_profile'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
        FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END
$$;

-- 2) REPLICA IDENTITY FULL для таблиц, которые подпишутся через postgres_changes.
ALTER TABLE public.bookings             REPLICA IDENTITY FULL;
ALTER TABLE public.calendar_events      REPLICA IDENTITY FULL;
ALTER TABLE public.company_members      REPLICA IDENTITY FULL;
ALTER TABLE public.contacts             REPLICA IDENTITY FULL;
ALTER TABLE public.company_invitations  REPLICA IDENTITY FULL;
ALTER TABLE public.agent_location_access REPLICA IDENTITY FULL;
ALTER TABLE public.companies            REPLICA IDENTITY FULL;
ALTER TABLE public.users_profile        REPLICA IDENTITY FULL;
