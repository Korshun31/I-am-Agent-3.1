-- TD-038: Allow users to delete their own account.
-- Required by Apple App Store, GDPR, PDPA (Thailand).
--
-- Checks:
-- 1. User must be authenticated
-- 2. If user owns a company with active agents → block deletion
--    (must deactivate all agents first)
--
-- Cascade:
-- Deleting auth.users cascades to: companies, company_members,
-- bookings, calendar_events, notifications, property_drafts,
-- agent_location_access, users_profile (via trigger or FK).
-- Properties stay (responsible_agent_id → NULL, submitted_by → NULL).

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_company_id UUID;
  v_active_agents INTEGER;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user owns a company with active agents
  SELECT id INTO v_company_id
  FROM companies
  WHERE owner_id = v_uid AND status = 'active';

  IF v_company_id IS NOT NULL THEN
    SELECT count(*) INTO v_active_agents
    FROM company_members
    WHERE company_id = v_company_id
      AND role = 'agent'
      AND status = 'active';

    IF v_active_agents > 0 THEN
      RAISE EXCEPTION 'CANNOT_DELETE_HAS_AGENTS';
    END IF;
  END IF;

  -- Delete users_profile first (before auth.users cascade)
  DELETE FROM users_profile WHERE id = v_uid;

  -- Delete auth.users — cascades everything else
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;
