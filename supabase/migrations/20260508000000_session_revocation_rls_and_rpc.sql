-- TD-128 (Session revocation) — слой 3 (RLS-аудит SELECT) и слой 2 (RPC am_i_still_active).
--
-- Задача: уволенный агент (status='inactive' в company_members) теряет доступ
-- к чтению броней и объектов мгновенно, без зависимости от зануления полей
-- booking_agent_id/responsible_agent_id в RPC deactivate_member.
--
-- Что делает миграция (только аддитивные операции, существующие данные не трогает):
-- 1. CREATE OR REPLACE FUNCTION am_i_still_active() — клиент дёргает её при возврате
--    приложения из фона и при cold start; возвращает true только если у текущего
--    юзера есть хоть одно активное членство (status='active' в company_members).
-- 2. Пересоздаёт три SELECT-политики, добавляя проверку auth_is_company_member
--    (она уже фильтрует по status='active'):
--      - bookings: agent read own
--      - bookings: agent reads assigned property bookings
--      - properties: agent reads assigned

-- 1) RPC am_i_still_active

CREATE OR REPLACE FUNCTION public.am_i_still_active()
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
      FROM public.company_members
     WHERE user_id = auth.uid()
       AND status = 'active'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.am_i_still_active() TO authenticated;

-- 2) Ужесточение SELECT-политик. DROP+CREATE — Postgres не поддерживает
--    ALTER POLICY с заменой USING выражения, только пересоздание.

DROP POLICY IF EXISTS "bookings: agent read own" ON public.bookings;
CREATE POLICY "bookings: agent read own"
  ON public.bookings
  FOR SELECT
  USING (
    booking_agent_id = auth.uid()
    AND public.auth_is_company_member(company_id)
  );

DROP POLICY IF EXISTS "bookings: agent reads assigned property bookings" ON public.bookings;
CREATE POLICY "bookings: agent reads assigned property bookings"
  ON public.bookings
  FOR SELECT
  USING (
    public.auth_is_company_member(company_id)
    AND EXISTS (
      SELECT 1
        FROM public.properties p
       WHERE p.id = bookings.property_id
         AND p.responsible_agent_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "properties: agent reads assigned" ON public.properties;
CREATE POLICY "properties: agent reads assigned"
  ON public.properties
  FOR SELECT
  USING (
    responsible_agent_id = auth.uid()
    AND public.auth_is_company_member(company_id)
  );
