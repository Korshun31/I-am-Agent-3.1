-- Закрываем утечку PII через get_company_team.
-- Функция SECURITY DEFINER (видит users_profile в обход RLS) возвращала
-- ФИО / email / телефон / фото всех членов любой компании любому залогиненному
-- юзеру, который угадает company_id. Добавляем проверку «caller — активный
-- член или владелец p_company_id».
--
-- Все live-callers (companyService.getActiveTeamMembers / getTeamData) передают
-- собственный companyId пользователя — проверка их не ломает. Триггеров / cron /
-- edge-функций, дёргающих эту RPC, нет (проверено grep'ом по всему репо).
--
-- Сигнатуру и тело RETURN QUERY не меняем — это аддитивное усиление.
-- Используем CREATE OR REPLACE (без DROP), чтобы сохранить существующие GRANT'ы
-- и не делать «дырку» во время наката.

CREATE OR REPLACE FUNCTION public.get_company_team(p_company_id UUID)
RETURNS TABLE (
  member_id   UUID,
  user_id     UUID,
  role        TEXT,
  status      TEXT,
  joined_at   TIMESTAMPTZ,
  name        TEXT,
  last_name   TEXT,
  email       TEXT,
  photo_url   TEXT,
  permissions JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Caller должен быть активным членом ИЛИ владельцем запрашиваемой компании.
  -- Иначе функция в обход RLS отдала бы PII команды другой компании.
  IF auth.uid() IS NULL
     OR (NOT public.auth_is_company_member(p_company_id)
         AND NOT public.auth_is_company_owner(p_company_id)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    cm.id          AS member_id,
    cm.user_id,
    cm.role,
    cm.status,
    cm.joined_at,
    a.name,
    a.last_name,
    a.email,
    a.photo_url,
    cm.permissions
  FROM company_members cm
  JOIN users_profile a ON a.id = cm.user_id
  WHERE cm.company_id = p_company_id
  ORDER BY cm.joined_at ASC;
END;
$$;

COMMENT ON FUNCTION public.get_company_team(uuid) IS
  'Возвращает участников компании. SECURITY DEFINER — обходит RLS users_profile, '
  'поэтому внутри явная проверка auth_is_company_member OR auth_is_company_owner. '
  'Callers: companyService.getActiveTeamMembers / getTeamData.';

-- Анонимным клиентам функция не нужна — отзываем, чтобы её вообще нельзя было
-- дёргать без сессии. Authenticated оставляем (внутренний гард сам решает).
REVOKE EXECUTE ON FUNCTION public.get_company_team(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_company_team(uuid) TO authenticated;
