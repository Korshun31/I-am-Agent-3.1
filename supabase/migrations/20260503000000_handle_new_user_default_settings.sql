-- Migration: handle_new_user — default settings inside trigger (TD-034)
-- Date: 2026-05-03
-- Description:
--   Previously the trigger inserted users_profile with empty settings, and
--   authService.signUp() did a separate UPDATE to set
--   { language: 'en', selectedCurrency: 'USD' }. Two round-trips, split logic.
--
--   New rule: trigger writes default settings in the same INSERT. JS no longer
--   touches settings after signUp. Invite-flow path is unchanged (no-op as
--   before, profile is created later by WebInviteAcceptScreen).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id UUID;
BEGIN
  -- Invite-flow: do nothing in DB. Profile + membership are created later
  -- by WebInviteAcceptScreen.handleSubmit + join_company_via_invitation.
  IF (NEW.raw_user_meta_data->>'invite_token') IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Standard signup (admin creating their own workspace):
  INSERT INTO users_profile (id, email, name, role, settings)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'standard',
    '{"language": "en", "selectedCurrency": "USD"}'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO companies (owner_id, name, status)
  VALUES (NEW.id, '', 'active')
  RETURNING id INTO new_company_id;

  INSERT INTO company_members (company_id, user_id, role, status)
  VALUES (new_company_id, NEW.id, 'admin', 'active');

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Auth trigger. Invite-flow (raw_user_meta_data.invite_token present): no-op — profile is created later by WebInviteAcceptScreen.handleSubmit. Standard signup: creates users_profile (with default settings: language=en, selectedCurrency=USD) + company + admin membership.';
