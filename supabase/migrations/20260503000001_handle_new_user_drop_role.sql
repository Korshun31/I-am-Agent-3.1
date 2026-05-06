-- Migration: handle_new_user — stop writing legacy users_profile.role (TD-001)
-- Date: 2026-05-03
-- Description:
--   users_profile.role is a deprecated billing field; the canonical field is
--   users_profile.plan (created in 20260330000002). The trigger still wrote
--   role='standard' on every signup. We're going to DROP COLUMN role in the
--   next migration, so the trigger must stop touching it first.
--
--   This migration only updates handle_new_user. JS reads of data.role are
--   removed in the same release; column DROP follows in 20260503000002.

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
  INSERT INTO users_profile (id, email, name, settings)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
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
  'Auth trigger. Invite-flow (raw_user_meta_data.invite_token present): no-op — profile is created later by WebInviteAcceptScreen.handleSubmit. Standard signup: creates users_profile (without legacy role column — TD-001) + default settings + company + admin membership.';
