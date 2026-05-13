-- =============================================================================
-- TD-127: realtime-уведомление админа об изменении имени агента.
--
-- Проблема: users_profile защищена RLS-политикой users_profile_self (см.
-- baseline_schema.sql:2174) — каждый видит только свою строку. Поэтому
-- postgres_changes для смены чужого имени НЕ доходит до подписчика, даже если
-- бы users_profile была в publication.
--
-- Решение: триггер на UPDATE users_profile.name/last_name/photo_url, который
-- "тыкает" соответствующую строку в company_members (она уже подписана
-- companyChannel.js, имеет REPLICA IDENTITY FULL и видна админу через RLS).
-- Админ получает событие UPDATE по company_members, фронт перезагружает команду
-- через get_company_team RPC (SECURITY DEFINER, видит свежие имена).
-- =============================================================================

-- 1) Колонка updated_at в company_members (для bump-сигнала).
ALTER TABLE public.company_members
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2) Гарантируем что company_members в publication supabase_realtime
--    (по факту работает в проде, но явно — для прозрачности и идемпотентности).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'company_members'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.company_members';
  END IF;
END
$$;

-- 3) Функция: bump updated_at у всех мембершипов пользователя.
CREATE OR REPLACE FUNCTION public.bump_company_members_on_profile_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.company_members
     SET updated_at = now()
   WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.bump_company_members_on_profile_change() IS
  'TD-127: при смене name/last_name/photo_url в users_profile тыкает строки company_members этого юзера, чтобы realtime-подписчики (админы) получили UPDATE и перезагрузили команду.';

-- 4) Триггер: только на реальное изменение имени/фамилии/фото.
DROP TRIGGER IF EXISTS bump_members_on_profile_change ON public.users_profile;
CREATE TRIGGER bump_members_on_profile_change
  AFTER UPDATE OF name, last_name, photo_url ON public.users_profile
  FOR EACH ROW
  WHEN (
    OLD.name       IS DISTINCT FROM NEW.name       OR
    OLD.last_name  IS DISTINCT FROM NEW.last_name  OR
    OLD.photo_url  IS DISTINCT FROM NEW.photo_url
  )
  EXECUTE FUNCTION public.bump_company_members_on_profile_change();
