-- Migration: find_or_create_booking_contact RPC
-- Date: 2026-05-05
-- TD: dedup contacts on phone/email when creating a client from booking form
-- (agreed 2026-04-28).
--
-- Why SECURITY DEFINER: an agent has limited RLS visibility on contacts,
-- so a JS-side search would return zero matches even if the company already
-- has a contact with the same phone/email. This function runs with elevated
-- privileges and searches across the whole company; the agent then gets
-- access to the matched contact transparently via the existing RLS rule
-- "contacts: agent reads booking clients" (TD-099) once the booking is saved.
--
-- Input: client payload (same shape as createContact in contactsService.js).
-- Output: jsonb { id uuid, existed boolean }.
-- Match policy: type='clients' AND same company AND
--   ( normalized phone (digits only, len>=5) matches phone column
--     OR lowercased trimmed email matches email column ).
-- If multiple matches — the most recently created wins.
--
-- Known accepted trade-off: this function is a partial timing/existence
-- oracle — an agent can probe whether a phone/email already exists in the
-- company by observing existed=true/false. Without this, dedup is impossible
-- (RLS hides chunks of company contacts from agents). Mitigation outside
-- this migration: rate-limit on the client side and audit-log RPC calls
-- when needed.

CREATE OR REPLACE FUNCTION public.find_or_create_booking_contact(
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_phone_norm text;
  v_email_norm text;
  v_match_id uuid;
  v_new_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- Resolve company: owner of an active company OR member.
  SELECT id INTO v_company_id
  FROM companies
  WHERE owner_id = v_user_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_company_id IS NULL THEN
    SELECT company_id INTO v_company_id
    FROM company_members
    WHERE user_id = v_user_id AND status = 'active'
    ORDER BY joined_at DESC
    LIMIT 1;
  END IF;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'CONTACT_NO_COMPANY';
  END IF;

  -- Defense vs CHECK contacts_name_not_blank (TD-101): never reach INSERT
  -- with empty/whitespace-only name, give the caller a clear error.
  IF TRIM(COALESCE(p_payload->>'name', '')) = '' THEN
    RAISE EXCEPTION 'CONTACT_NAME_REQUIRED';
  END IF;

  v_phone_norm := REGEXP_REPLACE(COALESCE(p_payload->>'phone', ''), '\D', '', 'g');
  v_email_norm := LOWER(TRIM(COALESCE(p_payload->>'email', '')));

  -- Try to find an existing contact in the same company.
  IF LENGTH(v_phone_norm) >= 5 OR (LENGTH(v_email_norm) > 0 AND v_email_norm LIKE '%@%') THEN
    SELECT id INTO v_match_id
    FROM contacts
    WHERE company_id = v_company_id
      AND type = 'clients'
      AND (
        (LENGTH(v_phone_norm) >= 5
         AND REGEXP_REPLACE(COALESCE(phone, ''), '\D', '', 'g') = v_phone_norm)
        OR
        (LENGTH(v_email_norm) > 0
         AND v_email_norm LIKE '%@%'
         AND LOWER(TRIM(COALESCE(email, ''))) = v_email_norm)
      )
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_match_id IS NOT NULL THEN
      RETURN jsonb_build_object('id', v_match_id, 'existed', true);
    END IF;
  END IF;

  -- No match — insert a new contact (clients type only, fields mirror createContact).
  INSERT INTO contacts (
    user_id, company_id, type,
    name, last_name, phone, email,
    telegram, whatsapp,
    document_number, nationality, birthday,
    photo_url,
    extra_phones, extra_emails, extra_telegrams, extra_whatsapps,
    documents
  )
  VALUES (
    v_user_id, v_company_id, 'clients',
    COALESCE(p_payload->>'name', ''),
    COALESCE(p_payload->>'last_name', ''),
    COALESCE(p_payload->>'phone', ''),
    COALESCE(p_payload->>'email', ''),
    COALESCE(p_payload->>'telegram', ''),
    COALESCE(p_payload->>'whatsapp', ''),
    COALESCE(p_payload->>'document_number', ''),
    COALESCE(p_payload->>'nationality', ''),
    COALESCE(p_payload->>'birthday', ''),
    COALESCE(p_payload->>'photo_url', ''),
    COALESCE(p_payload->'extra_phones', '[]'::jsonb),
    COALESCE(p_payload->'extra_emails', '[]'::jsonb),
    COALESCE(p_payload->'extra_telegrams', '[]'::jsonb),
    COALESCE(p_payload->'extra_whatsapps', '[]'::jsonb),
    COALESCE(p_payload->'documents', '[]'::jsonb)
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('id', v_new_id, 'existed', false);
END;
$$;

COMMENT ON FUNCTION public.find_or_create_booking_contact(jsonb) IS
  'Used by AddBookingModal/WebBookingEditPanel to dedup client contacts within a company by phone/email. SECURITY DEFINER bypasses agent RLS for the search; new rows get user_id=auth.uid() as creator.';

REVOKE ALL ON FUNCTION public.find_or_create_booking_contact(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.find_or_create_booking_contact(jsonb) TO authenticated;
