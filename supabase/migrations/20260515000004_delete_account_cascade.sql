-- Каскадное удаление данных компании при удалении аккаунта.
--
-- ПРОБЛЕМА. RPC delete_own_account удаляет auth.users, что каскадит
-- companies (CASCADE owner_id). Но пять FK к companies стоят SET NULL —
-- properties.company_id, bookings.company_id, contacts.company_id,
-- locations.company_id, calendar_events.company_id. После удаления admin'a
-- эти строки остаются в БД с company_id=NULL: RLS никому их не показывает,
-- но они навечно занимают место. У admin'a команды с 1000 объектов после
-- удаления остаётся 1000 мёртвых строк.
--
-- РЕШЕНИЕ. Меняем все пять FK на ON DELETE CASCADE — удаление компании
-- уносит все её данные сразу.
--
-- БЕЗОПАСНО:
--   * DELETE FROM companies триггерится только в одном месте — каскад от
--     DELETE FROM auth.users в RPC delete_own_account. UI-защита уже есть
--     (юзер вводит слово "delete" + предупреждение о потере данных).
--   * companyService.deactivateCompany делает UPDATE status='inactive',
--     НЕ DELETE — режим «возврат в одиночку» с сохранением данных
--     продолжит работать как раньше.
--   * Бизнес-логики на `company_id IS NULL` в src/ и supabase/functions/
--     нет (проверено grep'ом).
--   * bookings.property_id / notifications.property_id /
--     notifications.booking_id уже CASCADE — подкаскад от удаления property
--     подчистит брони и уведомления.
--
-- НЕ ЗАКРЫВАЕТСЯ: orphan-файлы в storage bucket property-photos этой
-- миграцией НЕ чистятся — отдельная задача TD-133.
--
-- ROLLBACK при необходимости — заменить `ON DELETE CASCADE` обратно
-- на `ON DELETE SET NULL` теми же ALTER TABLE.

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_company_id_fkey,
  ADD  CONSTRAINT properties_company_id_fkey
       FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_company_id_fkey,
  ADD  CONSTRAINT bookings_company_id_fkey
       FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_company_id_fkey,
  ADD  CONSTRAINT contacts_company_id_fkey
       FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.locations
  DROP CONSTRAINT IF EXISTS locations_company_id_fkey,
  ADD  CONSTRAINT locations_company_id_fkey
       FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_company_id_fkey,
  ADD  CONSTRAINT calendar_events_company_id_fkey
       FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
