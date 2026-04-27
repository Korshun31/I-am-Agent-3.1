-- Migration: handle_new_user — skip profile on invite-flow
-- Date: 2026-04-27
-- Description:
--   Previous version (20260427000000_invitation_flow_v2.sql) ALWAYS inserted
--   into users_profile, even when the new auth.users row was created via
--   inviteUserByEmail (i.e. before the agent actually clicked the magic-link
--   and finalized the registration). That left "occupied" rows in users_profile
--   for orphan auth users — and after admin revoked the invitation, the email
--   was still considered taken, blocking re-invitation of the same address.
--
--   New rule: when raw_user_meta_data has invite_token, the trigger does NOT
--   touch users_profile / companies / company_members at all. The profile is
--   created later by WebInviteAcceptScreen.handleSubmit (UPSERT) when the agent
--   actually completes the form. Until then the auth.users row is a pure orphan.
--
--   For non-invite signups (admin creating their own workspace) the logic is
--   unchanged: profile + company + admin membership are created immediately.

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
  INSERT INTO users_profile (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'standard'
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
  'Auth trigger. Invite-flow (raw_user_meta_data.invite_token present): no-op — profile is created later by WebInviteAcceptScreen.handleSubmit. Standard signup: creates users_profile + company + admin membership.';
