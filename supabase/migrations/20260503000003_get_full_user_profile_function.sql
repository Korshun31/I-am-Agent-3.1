-- TD-035: объединить 5 последовательных запросов из authService.getUserProfile в один RPC.
-- Возвращает JSONB со всеми данными профиля + связанные сущности (компания, членство в команде, локации агента).
-- SECURITY DEFINER — обходит RLS, поэтому внутри явная проверка `auth.uid() = p_user_id`.

CREATE OR REPLACE FUNCTION public.get_full_user_profile(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile           users_profile;
  v_owned_company     companies;
  v_membership        company_members;
  v_member_company    companies;
  v_assigned_loc_ids  uuid[];
BEGIN
  -- Безопасность: юзер может запросить только свой профиль.
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- 1. users_profile (основной профиль)
  SELECT * INTO v_profile FROM users_profile WHERE id = p_user_id;
  IF v_profile.id IS NULL THEN
    RETURN NULL; -- orphan auth user (без users_profile row)
  END IF;

  -- 2. Активная компания, которой юзер владелец
  SELECT * INTO v_owned_company
  FROM companies
  WHERE owner_id = p_user_id AND status = 'active'
  LIMIT 1;

  -- 3. Членство в команде (company_members)
  SELECT * INTO v_membership
  FROM company_members
  WHERE user_id = p_user_id AND status = 'active'
  LIMIT 1;

  -- 4. Локации агента (только если юзер — agent с компанией)
  IF v_membership.role = 'agent' AND v_membership.company_id IS NOT NULL THEN
    SELECT COALESCE(array_agg(location_id), ARRAY[]::uuid[]) INTO v_assigned_loc_ids
    FROM agent_location_access
    WHERE user_id = p_user_id AND company_id = v_membership.company_id;
  ELSE
    v_assigned_loc_ids := ARRAY[]::uuid[];
  END IF;

  -- 5. Имя + owner_id компании, в которой юзер состоит (для teamMembership.companyName/adminId)
  IF v_membership.company_id IS NOT NULL THEN
    SELECT * INTO v_member_company FROM companies WHERE id = v_membership.company_id LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'profile',        to_jsonb(v_profile),
    'ownedCompany',   CASE WHEN v_owned_company.id IS NOT NULL THEN to_jsonb(v_owned_company) ELSE NULL END,
    'membership',     CASE WHEN v_membership.user_id IS NOT NULL THEN jsonb_build_object(
                        'company_id',  v_membership.company_id,
                        'role',        v_membership.role,
                        'permissions', v_membership.permissions
                      ) ELSE NULL END,
    'memberCompany',  CASE WHEN v_member_company.id IS NOT NULL THEN jsonb_build_object(
                        'name',     v_member_company.name,
                        'owner_id', v_member_company.owner_id
                      ) ELSE NULL END,
    'assignedLocationIds', to_jsonb(v_assigned_loc_ids)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_full_user_profile(uuid) TO authenticated;
