-- Закрываем фишинг-канал через SECURITY DEFINER RPC create_notification.
-- До фикса обе версии функции (6-арг и 7-арг) принимали любые p_recipient_id /
-- p_sender_id без проверки, что caller — это сам отправитель и что recipient
-- из той же компании. Любой залогиненный юзер мог через supabase.rpc
-- подкинуть жертве уведомление от «системы» / «админа» / любого коллеги.
--
-- Теперь внутри функции:
--   1) auth.uid() IS NOT NULL — анонимных вызовов нет.
--   2) p_sender_id = auth.uid() — нельзя представляться другим.
--   3) Отправитель — активный член какой-то компании (status='active').
--   4) Получатель — активный член ТОЙ ЖЕ компании.
--
-- Системных вызовов из триггеров / БД-функций / edge-functions у функции
-- create_notification нет (проверено grep'ом по всему репо), поэтому bypass
-- для NULL auth.uid() не нужен. Все 7 JS-callers (bookingsService /
-- propertiesService) уже передают p_sender_id = session.user.id — фикс ни
-- одного существующего вызова не сломает.
--
-- CREATE OR REPLACE сохраняет GRANT'ы и не создаёт «дырку» при накате.

CREATE OR REPLACE FUNCTION public.create_notification(
  p_recipient_id  uuid,
  p_sender_id     uuid,
  p_type          text,
  p_title         text,
  p_body          text,
  p_property_id   uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id           uuid;
  v_caller       uuid := auth.uid();
  v_company_id   uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'create_notification: forbidden (no auth context)'
      USING ERRCODE = '42501';
  END IF;

  IF p_sender_id IS DISTINCT FROM v_caller THEN
    RAISE EXCEPTION 'create_notification: forbidden (sender mismatch)'
      USING ERRCODE = '42501';
  END IF;

  SELECT company_id INTO v_company_id
  FROM public.company_members
  WHERE user_id = v_caller
    AND status = 'active'
  ORDER BY joined_at DESC NULLS LAST
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'create_notification: forbidden (sender is not an active member)'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE user_id = p_recipient_id
      AND company_id = v_company_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'create_notification: forbidden (recipient not in same company)'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.notifications (recipient_id, sender_id, type, title, body, property_id)
  VALUES (p_recipient_id, p_sender_id, p_type, p_title, p_body, p_property_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.create_notification(
  p_recipient_id  uuid,
  p_sender_id     uuid,
  p_type          text,
  p_title         text,
  p_body          text,
  p_property_id   uuid DEFAULT NULL,
  p_booking_id    uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id           uuid;
  v_caller       uuid := auth.uid();
  v_company_id   uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'create_notification: forbidden (no auth context)'
      USING ERRCODE = '42501';
  END IF;

  IF p_sender_id IS DISTINCT FROM v_caller THEN
    RAISE EXCEPTION 'create_notification: forbidden (sender mismatch)'
      USING ERRCODE = '42501';
  END IF;

  SELECT company_id INTO v_company_id
  FROM public.company_members
  WHERE user_id = v_caller
    AND status = 'active'
  ORDER BY joined_at DESC NULLS LAST
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'create_notification: forbidden (sender is not an active member)'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE user_id = p_recipient_id
      AND company_id = v_company_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'create_notification: forbidden (recipient not in same company)'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.notifications (recipient_id, sender_id, type, title, body, property_id, booking_id)
  VALUES (p_recipient_id, p_sender_id, p_type, p_title, p_body, p_property_id, p_booking_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
