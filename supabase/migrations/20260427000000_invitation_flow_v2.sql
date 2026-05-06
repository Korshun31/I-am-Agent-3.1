-- Migration: invitation_flow_v2
-- Date: 2026-04-27
-- Description:
--   Переписываем invitation flow на Supabase Auth inviteUserByEmail + magic link.
--   - Делаем secret_code nullable (новые приглашения создаются без 6-значного кода).
--   - Переписываем handle_new_user: проверяем raw_user_meta_data->>'invite_token'.
--   - Переписываем join_company_via_invitation: принимает status='sent', сама обновляет на 'accepted'.
--
--   Старые функции (verify_invitation_secret, generate_secret_code, reset_invitation_secret,
--   get_invitation_by_token) НЕ трогаем — отложено до финального релиза, чтобы не ломать
--   текущий TestFlight на проде.
--
--   Контекст: project_invitation_flow_plan.md в memory.

-- ============================================================================
-- 0. Backup current state of company_invitations (для возможного отката)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.company_invitations_backup_2026_04_27 AS
SELECT * FROM public.company_invitations;

-- ============================================================================
-- 1. Make secret_code nullable
-- ============================================================================

ALTER TABLE public.company_invitations
  ALTER COLUMN secret_code DROP NOT NULL;

-- ============================================================================
-- 2. Replace handle_new_user trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id   UUID;
  has_invite_token BOOLEAN;
BEGIN
  -- Always create profile
  INSERT INTO users_profile (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'standard'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Detect invitation flow:
  -- Edge Function invite-agent calls supabase.auth.admin.inviteUserByEmail(
  --   email, { data: { invite_token, companyName } }
  -- ) — Supabase puts that data into raw_user_meta_data.
  has_invite_token := (NEW.raw_user_meta_data->>'invite_token') IS NOT NULL;

  -- Only create workspace if NOT invited
  IF NOT has_invite_token THEN
    INSERT INTO companies (owner_id, name, status)
    VALUES (NEW.id, '', 'active')
    RETURNING id INTO new_company_id;

    INSERT INTO company_members (company_id, user_id, role, status)
    VALUES (new_company_id, NEW.id, 'admin', 'active');
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Auth trigger. If raw_user_meta_data has invite_token (passed by Edge Function invite-agent via inviteUserByEmail), only create profile — workspace and admin role are skipped (user joins existing company via join_company_via_invitation). Otherwise — create workspace + admin membership.';

-- ============================================================================
-- 3. Rewrite join_company_via_invitation
-- ============================================================================

DROP FUNCTION IF EXISTS public.join_company_via_invitation(uuid);

CREATE OR REPLACE FUNCTION public.join_company_via_invitation(p_token UUID)
RETURNS TABLE (
  joined_company_id   UUID,
  joined_company_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          UUID;
  v_email        TEXT;
  v_cid          UUID;
  v_status       TEXT;
  v_expires_at   TIMESTAMPTZ;
  v_invite_email TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT u.email INTO v_email
  FROM auth.users u
  WHERE u.id = v_uid;

  IF v_email IS NULL OR length(trim(v_email)) = 0 THEN
    RAISE EXCEPTION 'User email not found';
  END IF;

  SELECT ci.company_id, ci.status, ci.expires_at, ci.email
    INTO v_cid, v_status, v_expires_at, v_invite_email
  FROM public.company_invitations ci
  WHERE ci.invite_token = p_token;

  IF v_cid IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  IF lower(trim(v_invite_email)) <> lower(trim(v_email)) THEN
    RAISE EXCEPTION 'Email mismatch';
  END IF;

  -- Accept sent/pending; allow re-call when already accepted (idempotent)
  IF v_status NOT IN ('sent', 'pending', 'accepted') THEN
    RAISE EXCEPTION 'Invitation is not active (status=%)', v_status;
  END IF;

  IF v_expires_at <= now() THEN
    RAISE EXCEPTION 'Invitation expired';
  END IF;

  -- Mark as accepted (no-op if already accepted)
  UPDATE public.company_invitations
     SET status = 'accepted'
   WHERE invite_token = p_token
     AND status IN ('sent', 'pending');

  -- Add to company team
  INSERT INTO public.company_members AS cm (company_id, user_id, role, status)
  VALUES (v_cid, v_uid, 'agent', 'active')
  ON CONFLICT (company_id, user_id)
  DO UPDATE SET
    role   = EXCLUDED.role,
    status = EXCLUDED.status;

  RETURN QUERY
  SELECT c.id, c.name
  FROM public.companies c
  WHERE c.id = v_cid;
END;
$$;

COMMENT ON FUNCTION public.join_company_via_invitation(UUID) IS
  'Adds current user as team agent after magic-link click. Accepts invitations in status sent/pending, marks them as accepted, idempotent on repeated clicks.';
