-- Fixes: "column reference \"company_id\" is ambiguous" when joining team after invite.
-- join_company_via_invitation was maintained outside repo / had unqualified company_id in JOIN.
-- This version uses only qualified columns and matches invite by token + auth user email.

-- NOTE: Do NOT name RETURNS TABLE columns company_id / company_name — in plpgsql they become
-- variables and shadow real table columns, so ON CONFLICT (company_id, user_id) becomes ambiguous.
--
-- Changing OUT parameter names changes the function's return type; CREATE OR REPLACE alone fails
-- with 42P13 — must DROP first.

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
  v_uid   UUID;
  v_email TEXT;
  v_cid   UUID;
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

  SELECT ci.company_id INTO v_cid
  FROM public.company_invitations ci
  WHERE ci.invite_token = p_token
    AND lower(trim(ci.email)) = lower(trim(v_email))
    AND ci.status = 'accepted';

  IF v_cid IS NULL THEN
    RAISE EXCEPTION 'No accepted invitation for this token and user';
  END IF;

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
  'Adds current user as team agent after invite code verified (invitation status=accepted).';
