-- TD-042: Rewrite deactivate_member — soft-delete, email release, account block.
--
-- What happens when admin deactivates an agent:
-- 1. company_members → status = 'inactive' (soft-delete, preserves history)
-- 2. Email in auth.users and users_profile replaced with system email
--    (frees original email for re-registration or new invitation)
-- 3. Account blocked (cannot login — email no longer matches)
-- 4. Location access revoked (agent_location_access deleted)
-- 5. responsible_agent_id → NULL on properties (objects go to "company")
-- 6. booking_agent_id → NULL on bookings (bookings go to "company")
--
-- Old agent ID preserved — all historical records (bookings, properties,
-- contacts created by this agent) keep their references.

CREATE OR REPLACE FUNCTION public.deactivate_member(p_company_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_system_email TEXT;
  v_old_email TEXT;
BEGIN
  -- Generate system email to replace the real one
  v_system_email := 'deactivated_' || extract(epoch from now())::bigint || '_' || left(md5(random()::text), 8) || '@system.internal';

  -- Get current email for logging
  SELECT email INTO v_old_email FROM auth.users WHERE id = p_user_id;

  -- 1. Soft-delete membership (keep record for history)
  UPDATE public.company_members
  SET status = 'inactive'
  WHERE company_id = p_company_id
    AND user_id = p_user_id
    AND role = 'agent';

  -- 2. Replace email in users_profile (free the original email)
  UPDATE public.users_profile
  SET email = v_system_email
  WHERE id = p_user_id;

  -- 3. Replace email in auth.users (blocks login + frees email)
  UPDATE auth.users
  SET email = v_system_email,
      email_confirmed_at = NULL
  WHERE id = p_user_id;

  -- 4. Revoke location access
  DELETE FROM public.agent_location_access
  WHERE company_id = p_company_id
    AND user_id = p_user_id;

  -- 5. Unassign from properties
  UPDATE public.properties
  SET responsible_agent_id = NULL
  WHERE company_id = p_company_id
    AND responsible_agent_id = p_user_id;

  -- 6. Unassign from bookings
  UPDATE public.bookings
  SET booking_agent_id = NULL
  WHERE company_id = p_company_id
    AND booking_agent_id = p_user_id;
END;
$$;
