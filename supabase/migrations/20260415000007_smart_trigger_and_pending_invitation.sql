-- TD-040 Part 1: Function to check if there's a pending invitation for an email.
-- Called from Registration screen before signUp() to show modal.
-- Returns company_name and invite_token if found, empty result if not.

CREATE OR REPLACE FUNCTION public.check_pending_invitation(p_email TEXT)
RETURNS TABLE (
  company_name TEXT,
  invite_token UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT c.name, ci.invite_token
  FROM company_invitations ci
  JOIN companies c ON c.id = ci.company_id
  WHERE lower(trim(ci.email)) = lower(trim(p_email))
    AND ci.status IN ('sent', 'pending')
    AND ci.expires_at > now()
  LIMIT 1;
END;
$$;

-- TD-040 Part 2: Smart trigger — conditional workspace creation.
-- If the new user has an accepted invitation → create only users_profile.
-- If no invitation → create users_profile + workspace + admin membership.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id UUID;
  has_accepted_invitation BOOLEAN;
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

  -- Check if this user is joining via invitation
  SELECT EXISTS (
    SELECT 1 FROM company_invitations
    WHERE lower(trim(email)) = lower(trim(NEW.email))
      AND status = 'accepted'
  ) INTO has_accepted_invitation;

  -- Only create workspace if NOT invited
  IF NOT has_accepted_invitation THEN
    INSERT INTO companies (owner_id, name, status)
    VALUES (NEW.id, '', 'active')
    RETURNING id INTO new_company_id;

    INSERT INTO company_members (company_id, user_id, role, status)
    VALUES (new_company_id, NEW.id, 'admin', 'active');
  END IF;

  RETURN NEW;
END;
$$;
