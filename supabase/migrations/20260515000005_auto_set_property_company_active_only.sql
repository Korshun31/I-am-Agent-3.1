-- Триггер auto_set_property_company при создании объекта искал membership
-- юзера в company_members без фильтра status='active'. Если бы у юзера
-- оказались две строки membership (одна inactive в старой компании,
-- одна active в новой), триггер мог схватить inactive — и INSERT упал бы
-- на RLS, юзер видел бы непонятную ошибку при добавлении объекта.
--
-- Сейчас в проде такого случая нет (у каждого юзера ровно одна membership),
-- но добавляем фильтр на будущее — единичная строка `AND status = 'active'`.

CREATE OR REPLACE FUNCTION public.auto_set_property_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT id INTO v_company_id
  FROM companies WHERE owner_id = auth.uid() AND status = 'active';

  IF v_company_id IS NULL THEN
    SELECT company_id INTO v_company_id
    FROM company_members
    WHERE user_id = auth.uid()
      AND role = 'agent'
      AND status = 'active';
  END IF;

  IF NEW.company_id IS NULL THEN
    NEW.company_id := v_company_id;
  END IF;

  RETURN NEW;
END;
$$;
