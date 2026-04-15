-- TD-024: Capture deactivate_member function from live DB.
-- Atomically: remove membership, revoke location access,
-- unassign responsible_agent_id from properties.

CREATE OR REPLACE FUNCTION public.deactivate_member(p_company_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1) Remove membership
  DELETE FROM public.company_members
  WHERE company_id = p_company_id
    AND user_id = p_user_id
    AND role = 'agent';

  -- 2) Revoke location access
  DELETE FROM public.agent_location_access
  WHERE company_id = p_company_id
    AND user_id = p_user_id;

  -- 3) Unassign from properties
  UPDATE public.properties
  SET responsible_agent_id = NULL
  WHERE company_id = p_company_id
    AND responsible_agent_id = p_user_id;
END;
$$;
