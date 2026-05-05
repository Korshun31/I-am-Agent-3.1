--
-- PostgreSQL database dump
--

\restrict CiqKyny7lVlczSaHB8LbaXzDVQyPgR3cbIXIWjdQyvALPhyQApMCe4V3Lc9LJaX

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: auth_is_company_member(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auth_is_company_member(p_company_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.company_members
    WHERE company_id = p_company_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
END;
$$;


--
-- Name: auth_is_company_owner(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auth_is_company_owner(p_company_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM companies
    WHERE id = p_company_id
      AND owner_id = auth.uid()
  );
END;
$$;


--
-- Name: auto_set_property_company(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_set_property_company() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  DECLARE                                                                                                                                                                         
    v_company_id UUID;                                      
  BEGIN                                       
    SELECT id INTO v_company_id           
    FROM companies WHERE owner_id = auth.uid() AND status = 'active';
                                                                                                                                                                                  
    IF v_company_id IS NULL THEN          
      SELECT company_id INTO v_company_id                                                                                                                                         
      FROM company_members WHERE user_id = auth.uid() AND role = 'agent';                                                                                                         
    END IF;                                   
                                                                                                                                                                                  
    IF NEW.company_id IS NULL THEN                          
      NEW.company_id := v_company_id;                                                                                                                                             
    END IF;                                   
                                                                                                                                                                                  
    RETURN NEW;                                             
  END;                                                                                                                                                                            
  $$;


--
-- Name: cascade_property_responsible_to_bookings(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cascade_property_responsible_to_bookings() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  BEGIN
    IF NEW.responsible_agent_id IS DISTINCT FROM OLD.responsible_agent_id THEN                                          
      UPDATE bookings
        SET booking_agent_id = NULL                                                                                     
        WHERE property_id = NEW.id                          
          AND check_out >= CURRENT_DATE                                                                                 
          AND booking_agent_id IS NOT NULL;                                                                             
    END IF;
    RETURN NEW;                                                                                                         
  END;                                                      
  $$;


--
-- Name: check_email_exists(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_email_exists(p_email text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$                                                                                                                               
  BEGIN           
    RETURN EXISTS (
      SELECT 1 FROM users_profile WHERE lower(email) = lower(p_email)
    );                                                                                                                                
  END;
  $$;


--
-- Name: check_email_status(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_email_status(p_email text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_email_lc  TEXT;
  has_profile BOOLEAN;
  has_auth    BOOLEAN;
BEGIN
  v_email_lc := lower(trim(p_email));

  IF v_email_lc IS NULL OR length(v_email_lc) = 0 THEN
    RAISE EXCEPTION 'Empty email';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.users_profile
    WHERE lower(email) = v_email_lc
  ) INTO has_profile;

  IF has_profile THEN
    RETURN 'occupied';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE lower(email) = v_email_lc
  ) INTO has_auth;

  IF has_auth THEN
    RETURN 'orphan';
  END IF;

  RETURN 'free';
END;
$$;


--
-- Name: FUNCTION check_email_status(p_email text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.check_email_status(p_email text) IS 'Returns email registration status: free / occupied (in users_profile) / orphan (in auth.users only). Used by invite-agent Edge Function.';


--
-- Name: check_pending_invitation(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_pending_invitation(p_email text) RETURNS TABLE(company_name text, invite_token uuid, company_id uuid, invitation_status text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  BEGIN
    RETURN QUERY
    SELECT c.name, ci.invite_token, ci.company_id, ci.status                                                                                                                      
    FROM company_invitations ci
    JOIN companies c ON c.id = ci.company_id                                                                                                                                      
    WHERE lower(trim(ci.email)) = lower(trim(p_email))                                                                                                                            
      AND ci.status IN ('sent', 'pending', 'revoked')
      AND ci.expires_at > now()                                                                                                                                                   
    ORDER BY ci.created_at DESC                             
    LIMIT 1;                                                                                                                                                                      
  END;                                                      
  $$;


--
-- Name: create_notification(uuid, uuid, text, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_notification(p_recipient_id uuid, p_sender_id uuid, p_type text, p_title text, p_body text, p_property_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO notifications (recipient_id, sender_id, type, title, body, property_id)
  VALUES (p_recipient_id, p_sender_id, p_type, p_title, p_body, p_property_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;


--
-- Name: create_notification(uuid, uuid, text, text, text, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_notification(p_recipient_id uuid, p_sender_id uuid, p_type text, p_title text, p_body text, p_property_id uuid DEFAULT NULL::uuid, p_booking_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  DECLARE
    v_id UUID;
  BEGIN                                                                                                                 
    INSERT INTO notifications (recipient_id, sender_id, type, title, body, property_id, booking_id)
    VALUES (p_recipient_id, p_sender_id, p_type, p_title, p_body, p_property_id, p_booking_id)                          
    RETURNING id INTO v_id;                                                                                             
    RETURN v_id;
  END;                                                                                                                  
  $$;


--
-- Name: deactivate_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.deactivate_member(p_company_id uuid, p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$                                                                                                                                                                           
  DECLARE                                                                                                                                                                         
    v_system_email TEXT;
    v_old_email TEXT;                                                                                                                                                             
  BEGIN                                                     
    v_system_email := 'deactivated_' || extract(epoch from now())::bigint || '_' || left(md5(random()::text), 8) || '@system.internal';
                                              
    SELECT email INTO v_old_email FROM auth.users WHERE id = p_user_id;

    UPDATE public.company_members                                                                                                                                                 
    SET status = 'inactive'
    WHERE company_id = p_company_id                                                                                                                                               
      AND user_id = p_user_id                               
      AND role = 'agent';
                                                                                                                                                                                  
    UPDATE public.users_profile
    SET email = v_system_email                                                                                                                                                    
    WHERE id = p_user_id;                                   
                                              
    UPDATE auth.users                     
    SET email = v_system_email,
        email_confirmed_at = NULL                                                                                                                                                 
    WHERE id = p_user_id;
                                                                                                                                                                                  
    DELETE FROM public.agent_location_access                
    WHERE company_id = p_company_id
      AND user_id = p_user_id;                
                                          
    UPDATE public.properties
    SET responsible_agent_id = NULL                                                                                                                                               
    WHERE company_id = p_company_id
      AND responsible_agent_id = p_user_id;                                                                                                                                       
                                                            
    UPDATE public.bookings
    SET booking_agent_id = NULL
    WHERE company_id = p_company_id           
      AND booking_agent_id = p_user_id;   
  END;
  $$;


--
-- Name: delete_own_account(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_own_account() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
                                          
    DELETE FROM users_profile WHERE id = v_uid;
    DELETE FROM auth.users WHERE id = v_uid;                                                                                                                                      
  END;
  $$;


--
-- Name: enforce_booking_agent_matches_property(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_booking_agent_matches_property() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  DECLARE
    v_responsible UUID;
  BEGIN                                                                                                                 
    IF NEW.booking_agent_id IS NULL THEN
      RETURN NEW;                                                                                                       
    END IF;                                                                                                             
    SELECT responsible_agent_id INTO v_responsible
      FROM properties                                                                                                   
      WHERE id = NEW.property_id;                           
    IF v_responsible IS NULL OR NEW.booking_agent_id <> v_responsible THEN                                              
      RAISE EXCEPTION 'BOOKING_AGENT_MISMATCH'
        USING ERRCODE = '23514',                                                                                        
              DETAIL  = 'booking_agent_id must equal property.responsible_agent_id or be NULL';                         
    END IF;                                                                                                             
    RETURN NEW;                                                                                                         
  END;                                                                                                                  
  $$;


--
-- Name: generate_secret_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_secret_code() RETURNS text
    LANGUAGE sql
    AS $$
  SELECT lpad(floor(random() * 1000000)::text, 6, '0');
$$;


--
-- Name: get_auth_user_id_by_email(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_auth_user_id_by_email(p_email text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;
  RETURN v_id;
END;
$$;


--
-- Name: FUNCTION get_auth_user_id_by_email(p_email text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_auth_user_id_by_email(p_email text) IS 'Returns auth.users.id for the given email (case-insensitive) or NULL. Used by invite-agent Edge Function for orphan cleanup. Service-role only — not granted to anon/authenticated.';


--
-- Name: get_company_team(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_company_team(p_company_id uuid) RETURNS TABLE(member_id uuid, user_id uuid, role text, status text, joined_at timestamp with time zone, name text, last_name text, email text, photo_url text, permissions jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$                                                                                                                                                                           
  BEGIN
    RETURN QUERY                                                                                                                                                                  
    SELECT                                                  
      cm.id          AS member_id,
      cm.user_id,
      cm.role,
      cm.status,
      cm.joined_at,                                                                                                                                                               
      a.name,
      a.last_name,                                                                                                                                                                
      a.email,                                              
      a.photo_url,
      cm.permissions
    FROM company_members cm
    JOIN users_profile a ON a.id = cm.user_id                                                                                                                                     
    WHERE cm.company_id = p_company_id
    ORDER BY cm.joined_at ASC;                                                                                                                                                    
  END;                                                                                                                                                                            
  $$;


--
-- Name: get_full_user_profile(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_full_user_profile(p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: get_invitation_by_token(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_invitation_by_token(p_token uuid) RETURNS TABLE(invitation_id uuid, company_id uuid, company_name text, email text, status text, expires_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE company_invitations
  SET status = 'pending'
  WHERE invite_token = p_token
    AND company_invitations.status = 'sent'
    AND company_invitations.expires_at > now();

  RETURN QUERY
  SELECT ci.id, ci.company_id, c.name, ci.email, ci.status, ci.expires_at
  FROM company_invitations ci
  JOIN companies c ON c.id = ci.company_id
  WHERE ci.invite_token = p_token
    AND ci.status IN ('sent', 'pending')
    AND ci.expires_at > now();
END;
$$;


--
-- Name: get_invitation_status(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_invitation_status(p_token uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_status  TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  SELECT status, expires_at
    INTO v_status, v_expires
  FROM company_invitations
  WHERE invite_token = p_token;

  IF v_status IS NULL THEN
    RETURN 'not_found';
  END IF;

  -- Final statuses take priority over expiration: admin's revoke or user's
  -- decline should be reported even if the link has also passed its TTL.
  IF v_status IN ('accepted', 'revoked', 'declined') THEN
    RETURN v_status;
  END IF;

  IF v_expires IS NOT NULL AND v_expires <= now() THEN
    RETURN 'expired';
  END IF;

  RETURN v_status;
END;
$$;


--
-- Name: FUNCTION get_invitation_status(p_token uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_invitation_status(p_token uuid) IS 'Returns invitation status by token: sent / pending / revoked / accepted / declined / expired / not_found. Used by WebInviteAcceptScreen to block UI early if invitation cannot be accepted.';


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  new_company_id UUID;
BEGIN
  IF (NEW.raw_user_meta_data->>'invite_token') IS NOT NULL THEN
    RETURN NEW;
  END IF;

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


--
-- Name: FUNCTION handle_new_user(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.handle_new_user() IS 'Auth trigger. Invite-flow (raw_user_meta_data.invite_token present): no-op — profile is created later by WebInviteAcceptScreen.handleSubmit. Standard signup: creates users_profile + company + admin membership.';


--
-- Name: join_company_via_invitation(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.join_company_via_invitation(p_token uuid) RETURNS TABLE(joined_company_id uuid, joined_company_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid          UUID;
  v_email        TEXT;
  v_cid          UUID;
  v_status       TEXT;
  v_expires_at   TIMESTAMPTZ;
  v_invite_email TEXT;
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

  SELECT ci.company_id, ci.status, ci.expires_at, ci.email
    INTO v_cid, v_status, v_expires_at, v_invite_email
  FROM public.company_invitations ci
  WHERE ci.invite_token = p_token;

  IF v_cid IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  IF lower(trim(v_invite_email)) <> lower(trim(v_email)) THEN
    RAISE EXCEPTION 'Email mismatch';
  END IF;

  -- Accept sent/pending; allow re-call when already accepted (idempotent)
  IF v_status NOT IN ('sent', 'pending', 'accepted') THEN
    RAISE EXCEPTION 'Invitation is not active (status=%)', v_status;
  END IF;

  IF v_expires_at <= now() THEN
    RAISE EXCEPTION 'Invitation expired';
  END IF;

  -- Mark as accepted (no-op if already accepted)
  UPDATE public.company_invitations
     SET status = 'accepted'
   WHERE invite_token = p_token
     AND status IN ('sent', 'pending');

  -- Add to company team
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


--
-- Name: FUNCTION join_company_via_invitation(p_token uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.join_company_via_invitation(p_token uuid) IS 'Adds current user as team agent after magic-link click. Accepts invitations in status sent/pending, marks them as accepted, idempotent on repeated clicks.';


--
-- Name: reset_invitation_secret(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_invitation_secret(p_invitation_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$                                                                                                                                                                           
  DECLARE                                                   
    v_new_code TEXT;
  BEGIN
    v_new_code := lpad(floor(random() * 1000000)::text, 6, '0');
                                              
    UPDATE company_invitations            
    SET secret_code = v_new_code,
        attempts = 0,                                                                                                                                                             
        status = 'sent'
    WHERE id = p_invitation_id;                                                                                                                                                   
                                                            
    RETURN v_new_code;                    
  END;
  $$;


--
-- Name: verify_invitation_secret(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_invitation_secret(p_token uuid, p_code text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$                                                                                                                                                                           
  DECLARE                                                                                                                                                                         
    v_invitation_id UUID;                                                                                                                                                         
    v_current_attempts INTEGER;                             
    v_remaining INTEGER;                                                                                                                                                          
  BEGIN
    SELECT id, attempts INTO v_invitation_id, v_current_attempts                                                                                                                  
    FROM company_invitations                                
    WHERE invite_token = p_token
      AND status IN ('sent', 'pending')       
      AND expires_at > now();             

    IF v_invitation_id IS NULL THEN                                                                                                                                               
      RETURN -1;
    END IF;                                                                                                                                                                       
                                                            
    IF v_current_attempts >= 5 THEN
      UPDATE company_invitations
      SET status = 'revoked'                  
      WHERE id = v_invitation_id;         
      RETURN -1;
    END IF;                                                                                                                                                                       
   
    IF NOT EXISTS (                                                                                                                                                               
      SELECT 1 FROM company_invitations                     
      WHERE id = v_invitation_id
        AND secret_code = p_code              
    ) THEN                                
      UPDATE company_invitations
      SET attempts = attempts + 1                                                                                                                                                 
      WHERE id = v_invitation_id;
                                                                                                                                                                                  
      v_remaining := 5 - (v_current_attempts + 1);          

      IF v_remaining <= 0 THEN                
        UPDATE company_invitations        
        SET status = 'revoked'
        WHERE id = v_invitation_id;                                                                                                                                               
        RETURN -1;
      END IF;                                                                                                                                                                     
                                                            
      RETURN v_remaining;
    END IF;
                                              
    UPDATE company_invitations            
    SET status = 'accepted', attempts = 0
    WHERE id = v_invitation_id;                                                                                                                                                   
   
    RETURN 0;                                                                                                                                                                     
  END;                                                      
  $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agent_location_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_location_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    location_id uuid NOT NULL,
    user_id uuid NOT NULL,
    company_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    property_id uuid NOT NULL,
    contact_id uuid,
    passport_id text,
    not_my_customer boolean DEFAULT false NOT NULL,
    check_in date NOT NULL,
    check_out date NOT NULL,
    price_monthly numeric,
    total_price numeric,
    booking_deposit numeric,
    save_deposit numeric,
    commission numeric,
    adults integer,
    children integer,
    pets boolean DEFAULT false,
    comments text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    photos jsonb DEFAULT '[]'::jsonb,
    reminder_days jsonb DEFAULT '[]'::jsonb,
    check_in_time text,
    check_out_time text,
    owner_commission_one_time numeric,
    owner_commission_monthly numeric,
    currency text DEFAULT 'THB'::text,
    owner_commission_monthly_is_percent boolean DEFAULT false,
    owner_commission_one_time_is_percent boolean DEFAULT false,
    company_id uuid,
    booking_agent_id uuid,
    monthly_breakdown jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: COLUMN bookings.owner_commission_one_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.owner_commission_one_time IS 'One-time commission from property owner (paid at check-in)';


--
-- Name: COLUMN bookings.owner_commission_monthly; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.owner_commission_monthly IS 'Monthly commission from property owner (paid each month of stay)';


--
-- Name: COLUMN bookings.monthly_breakdown; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.monthly_breakdown IS 'TD-082: помесячная разбивка стоимости. Массив { month: "YYYY-MM", amount: number }. Пустой = авто-расчёт по price_monthly.';


--
-- Name: calendar_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    event_date date NOT NULL,
    event_time time without time zone,
    title text NOT NULL,
    color text DEFAULT '#64B5F6'::text NOT NULL,
    comments text,
    created_at timestamp with time zone DEFAULT now(),
    reminder_minutes jsonb DEFAULT '[]'::jsonb,
    repeat_type text,
    is_completed boolean DEFAULT false,
    company_id uuid NOT NULL
);


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    logo_url text,
    telegram text,
    whatsapp text,
    instagram text,
    working_hours text,
    CONSTRAINT companies_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


--
-- Name: company_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    email text NOT NULL,
    invite_token uuid DEFAULT gen_random_uuid() NOT NULL,
    secret_code text,
    status text DEFAULT 'sent'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    CONSTRAINT company_invitations_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'pending'::text, 'accepted'::text, 'revoked'::text, 'declined'::text])))
);


--
-- Name: company_invitations_backup_2026_04_27; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_invitations_backup_2026_04_27 (
    id uuid,
    company_id uuid,
    email text,
    invite_token uuid,
    secret_code text,
    status text,
    created_at timestamp with time zone,
    expires_at timestamp with time zone,
    attempts integer
);


--
-- Name: company_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'agent'::text NOT NULL,
    joined_at timestamp with time zone DEFAULT now(),
    permissions jsonb DEFAULT '{}'::jsonb,
    assigned_location_ids uuid[] DEFAULT '{}'::uuid[],
    status text DEFAULT 'active'::text NOT NULL,
    CONSTRAINT company_members_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'agent'::text]))),
    CONSTRAINT company_members_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text DEFAULT 'clients'::text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    last_name text DEFAULT ''::text,
    phone text DEFAULT ''::text,
    email text DEFAULT ''::text,
    telegram text DEFAULT ''::text,
    whatsapp text DEFAULT ''::text,
    document_number text DEFAULT ''::text,
    nationality text DEFAULT ''::text,
    birthday text DEFAULT ''::text,
    photo_url text DEFAULT ''::text,
    extra_phones jsonb DEFAULT '[]'::jsonb,
    extra_emails jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    extra_telegrams jsonb DEFAULT '[]'::jsonb,
    extra_whatsapps jsonb DEFAULT '[]'::jsonb,
    documents jsonb DEFAULT '[]'::jsonb,
    company_id uuid NOT NULL,
    CONSTRAINT contacts_name_not_blank CHECK ((TRIM(BOTH FROM name) <> ''::text))
);


--
-- Name: location_districts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.location_districts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    location_id uuid NOT NULL,
    district text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    country text DEFAULT ''::text NOT NULL,
    region text DEFAULT ''::text NOT NULL,
    city text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    company_id uuid NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipient_id uuid NOT NULL,
    sender_id uuid,
    type text NOT NULL,
    title text NOT NULL,
    body text,
    property_id uuid,
    is_read boolean DEFAULT false NOT NULL,
    action_taken boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    booking_id uuid
);


--
-- Name: properties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.properties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    code text DEFAULT ''::text NOT NULL,
    type text DEFAULT 'house'::text NOT NULL,
    location_id uuid,
    owner_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    city text DEFAULT ''::text NOT NULL,
    google_maps_link text DEFAULT ''::text NOT NULL,
    bathrooms integer,
    area real,
    description text DEFAULT ''::text NOT NULL,
    photos jsonb DEFAULT '[]'::jsonb,
    videos jsonb DEFAULT '[]'::jsonb,
    amenities jsonb DEFAULT '{}'::jsonb,
    air_conditioners integer,
    internet_speed text DEFAULT ''::text NOT NULL,
    pets_allowed boolean DEFAULT false,
    long_term_booking boolean DEFAULT false,
    price_monthly numeric,
    booking_deposit numeric,
    save_deposit numeric,
    commission numeric,
    electricity_price numeric,
    water_price numeric,
    water_price_type text DEFAULT ''::text NOT NULL,
    gas_price numeric,
    internet_price numeric,
    cleaning_price numeric,
    exit_cleaning_price numeric,
    comments text DEFAULT ''::text NOT NULL,
    parent_id uuid,
    beach_distance integer,
    market_distance integer,
    district text DEFAULT ''::text,
    bedrooms integer,
    houses_count integer,
    floors integer,
    code_suffix text,
    owner_id_2 uuid,
    website_url text,
    price_monthly_is_from boolean DEFAULT false,
    booking_deposit_is_from boolean DEFAULT false,
    save_deposit_is_from boolean DEFAULT false,
    commission_is_from boolean DEFAULT false,
    address text,
    video_url text,
    currency text DEFAULT 'THB'::text,
    owner_commission_one_time numeric,
    owner_commission_monthly numeric,
    owner_commission_one_time_is_from boolean DEFAULT false,
    owner_commission_monthly_is_from boolean DEFAULT false,
    owner_commission_one_time_is_percent boolean DEFAULT false,
    owner_commission_monthly_is_percent boolean DEFAULT false,
    company_id uuid,
    responsible_agent_id uuid,
    submitted_by uuid,
    floor_number integer,
    photos_thumb text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT properties_name_not_blank CHECK (((name IS NOT NULL) AND (btrim(name) <> ''::text))),
    CONSTRAINT properties_type_check CHECK ((type = ANY (ARRAY['house'::text, 'resort'::text, 'condo'::text, 'resort_house'::text, 'condo_apartment'::text])))
);

ALTER TABLE ONLY public.properties REPLICA IDENTITY FULL;


--
-- Name: COLUMN properties.website_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.properties.website_url IS 'Link to property listing page on external website';


--
-- Name: COLUMN properties.address; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.properties.address IS 'Property address for booking confirmation';


--
-- Name: COLUMN properties.photos_thumb; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.properties.photos_thumb IS 'TD-064: миниатюры 150px. Параллельный массив той же длины/порядка, что photos.';


--
-- Name: users_profile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users_profile (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    name text,
    last_name text,
    phone text,
    telegram text,
    whatsapp text,
    photo_url text,
    document_number text,
    created_at timestamp with time zone DEFAULT now(),
    settings jsonb DEFAULT '{}'::jsonb,
    web_notifications jsonb DEFAULT '{"new_event": false, "new_booking": false, "new_property": false, "booking_changed": false}'::jsonb,
    plan text DEFAULT 'standard'::text
);


--
-- Name: agent_location_access agent_location_access_location_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_location_access
    ADD CONSTRAINT agent_location_access_location_id_user_id_key UNIQUE (location_id, user_id);


--
-- Name: agent_location_access agent_location_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_location_access
    ADD CONSTRAINT agent_location_access_pkey PRIMARY KEY (id);


--
-- Name: users_profile agents_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_profile
    ADD CONSTRAINT agents_email_key UNIQUE (email);


--
-- Name: users_profile agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_profile
    ADD CONSTRAINT agents_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: calendar_events calendar_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: company_invitations company_invitations_invite_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_invitations
    ADD CONSTRAINT company_invitations_invite_token_key UNIQUE (invite_token);


--
-- Name: company_invitations company_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_invitations
    ADD CONSTRAINT company_invitations_pkey PRIMARY KEY (id);


--
-- Name: company_members company_members_company_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_members
    ADD CONSTRAINT company_members_company_id_user_id_key UNIQUE (company_id, user_id);


--
-- Name: company_members company_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_members
    ADD CONSTRAINT company_members_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: location_districts location_districts_location_id_district_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_districts
    ADD CONSTRAINT location_districts_location_id_district_key UNIQUE (location_id, district);


--
-- Name: location_districts location_districts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_districts
    ADD CONSTRAINT location_districts_pkey PRIMARY KEY (id);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: properties properties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_pkey PRIMARY KEY (id);


--
-- Name: company_invitations_active_email_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX company_invitations_active_email_uniq ON public.company_invitations USING btree (company_id, lower(email)) WHERE (status = ANY (ARRAY['sent'::text, 'pending'::text]));


--
-- Name: idx_agent_location_access_location_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_location_access_location_id ON public.agent_location_access USING btree (location_id);


--
-- Name: idx_agent_location_access_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_location_access_user_id ON public.agent_location_access USING btree (user_id);


--
-- Name: idx_bookings_booking_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_booking_agent_id ON public.bookings USING btree (booking_agent_id);


--
-- Name: idx_bookings_check_in; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_check_in ON public.bookings USING btree (check_in);


--
-- Name: idx_bookings_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_company_id ON public.bookings USING btree (company_id);


--
-- Name: idx_bookings_property_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_property_id ON public.bookings USING btree (property_id);


--
-- Name: idx_bookings_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_user_id ON public.bookings USING btree (user_id);


--
-- Name: idx_calendar_events_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_events_company_id ON public.calendar_events USING btree (company_id);


--
-- Name: idx_companies_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_companies_owner_id ON public.companies USING btree (owner_id);


--
-- Name: idx_company_invitations_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_invitations_company_id ON public.company_invitations USING btree (company_id);


--
-- Name: idx_company_invitations_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_invitations_email ON public.company_invitations USING btree (email);


--
-- Name: idx_company_invitations_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_invitations_token ON public.company_invitations USING btree (invite_token);


--
-- Name: idx_company_members_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_members_company_id ON public.company_members USING btree (company_id);


--
-- Name: idx_company_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_members_user_id ON public.company_members USING btree (user_id);


--
-- Name: idx_contacts_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_company_id ON public.contacts USING btree (company_id);


--
-- Name: idx_location_districts_location_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_location_districts_location_id ON public.location_districts USING btree (location_id);


--
-- Name: idx_locations_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_locations_company_id ON public.locations USING btree (company_id);


--
-- Name: idx_notifications_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_booking ON public.notifications USING btree (booking_id);


--
-- Name: idx_notifications_property; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_property ON public.notifications USING btree (property_id);


--
-- Name: idx_notifications_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_recipient ON public.notifications USING btree (recipient_id, is_read, created_at DESC);


--
-- Name: idx_properties_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_properties_company_id ON public.properties USING btree (company_id);


--
-- Name: idx_properties_responsible_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_properties_responsible_agent_id ON public.properties USING btree (responsible_agent_id);


--
-- Name: locations_company_geo_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX locations_company_geo_unique ON public.locations USING btree (company_id, upper(TRIM(BOTH FROM country)), upper(TRIM(BOTH FROM region)), upper(TRIM(BOTH FROM city)));


--
-- Name: properties_company_code_suffix_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX properties_company_code_suffix_unique ON public.properties USING btree (company_id, upper(TRIM(BOTH FROM code)), upper(COALESCE(TRIM(BOTH FROM code_suffix), ''::text))) WHERE ((code IS NOT NULL) AND (TRIM(BOTH FROM code) <> ''::text));


--
-- Name: properties trg_auto_set_property_company; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auto_set_property_company BEFORE INSERT ON public.properties FOR EACH ROW EXECUTE FUNCTION public.auto_set_property_company();


--
-- Name: properties trg_cascade_property_responsible; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_property_responsible AFTER UPDATE OF responsible_agent_id ON public.properties FOR EACH ROW EXECUTE FUNCTION public.cascade_property_responsible_to_bookings();


--
-- Name: bookings trg_enforce_booking_agent_matches_property; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_booking_agent_matches_property BEFORE INSERT OR UPDATE OF booking_agent_id, property_id ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_agent_matches_property();


--
-- Name: agent_location_access agent_location_access_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_location_access
    ADD CONSTRAINT agent_location_access_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: agent_location_access agent_location_access_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_location_access
    ADD CONSTRAINT agent_location_access_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE;


--
-- Name: agent_location_access agent_location_access_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_location_access
    ADD CONSTRAINT agent_location_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_agent_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_booking_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_booking_agent_id_fkey FOREIGN KEY (booking_agent_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: bookings bookings_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: bookings bookings_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: bookings bookings_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_agent_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: companies companies_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: company_invitations company_invitations_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_invitations
    ADD CONSTRAINT company_invitations_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_members company_members_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_members
    ADD CONSTRAINT company_members_agent_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: company_members company_members_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_members
    ADD CONSTRAINT company_members_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: contacts contacts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_profile(id) ON DELETE CASCADE;


--
-- Name: location_districts location_districts_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_districts
    ADD CONSTRAINT location_districts_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE;


--
-- Name: locations locations_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: locations locations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_profile(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: properties properties_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: properties properties_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: properties properties_owner_id_2_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_owner_id_2_fkey FOREIGN KEY (owner_id_2) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: properties properties_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: properties properties_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: properties properties_responsible_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_responsible_agent_id_fkey FOREIGN KEY (responsible_agent_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: properties properties_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: properties properties_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_profile(id) ON DELETE CASCADE;


--
-- Name: location_districts Users can manage districts of own locations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage districts of own locations" ON public.location_districts USING ((location_id IN ( SELECT locations.id
   FROM public.locations
  WHERE (locations.user_id = auth.uid())))) WITH CHECK ((location_id IN ( SELECT locations.id
   FROM public.locations
  WHERE (locations.user_id = auth.uid()))));


--
-- Name: agent_location_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_location_access ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_location_access agent_location_access: admin full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "agent_location_access: admin full access" ON public.agent_location_access USING (public.auth_is_company_owner(company_id)) WITH CHECK (public.auth_is_company_owner(company_id));


--
-- Name: agent_location_access agent_location_access: agent read own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "agent_location_access: agent read own" ON public.agent_location_access FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

--
-- Name: bookings bookings: agent delete own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "bookings: agent delete own" ON public.bookings FOR DELETE USING (((booking_agent_id = auth.uid()) AND (public.auth_is_company_owner(company_id) OR (public.auth_is_company_member(company_id) AND (EXISTS ( SELECT 1
   FROM public.company_members cm
  WHERE ((cm.company_id = bookings.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'active'::text) AND (COALESCE(((cm.permissions ->> 'can_manage_bookings'::text))::boolean, false) = true))))))));


--
-- Name: bookings bookings: agent insert own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "bookings: agent insert own" ON public.bookings FOR INSERT WITH CHECK (((user_id = auth.uid()) AND (public.auth_is_company_owner(company_id) OR (public.auth_is_company_member(company_id) AND (EXISTS ( SELECT 1
   FROM public.company_members cm
  WHERE ((cm.company_id = bookings.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'active'::text) AND (COALESCE(((cm.permissions ->> 'can_manage_bookings'::text))::boolean, false) = true)))))) AND (public.auth_is_company_owner(company_id) OR (booking_agent_id IS NULL) OR (booking_agent_id = auth.uid()))));


--
-- Name: bookings bookings: agent read own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "bookings: agent read own" ON public.bookings FOR SELECT USING ((booking_agent_id = auth.uid()));


--
-- Name: bookings bookings: agent reads assigned property bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "bookings: agent reads assigned property bookings" ON public.bookings FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.properties p
  WHERE ((p.id = bookings.property_id) AND (p.responsible_agent_id = auth.uid())))));


--
-- Name: bookings bookings: agent update own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "bookings: agent update own" ON public.bookings FOR UPDATE USING (((booking_agent_id = auth.uid()) AND (public.auth_is_company_owner(company_id) OR (public.auth_is_company_member(company_id) AND (EXISTS ( SELECT 1
   FROM public.company_members cm
  WHERE ((cm.company_id = bookings.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'active'::text) AND (COALESCE(((cm.permissions ->> 'can_manage_bookings'::text))::boolean, false) = true)))))))) WITH CHECK (((booking_agent_id = auth.uid()) AND (public.auth_is_company_owner(company_id) OR (public.auth_is_company_member(company_id) AND (EXISTS ( SELECT 1
   FROM public.company_members cm
  WHERE ((cm.company_id = bookings.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'active'::text) AND (COALESCE(((cm.permissions ->> 'can_manage_bookings'::text))::boolean, false) = true))))))));


--
-- Name: bookings bookings: owner full access to company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "bookings: owner full access to company" ON public.bookings USING (public.auth_is_company_owner(company_id)) WITH CHECK (public.auth_is_company_owner(company_id));


--
-- Name: calendar_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

--
-- Name: calendar_events calendar_events: company member read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "calendar_events: company member read" ON public.calendar_events FOR SELECT USING ((public.auth_is_company_owner(company_id) OR public.auth_is_company_member(company_id)));


--
-- Name: calendar_events calendar_events: own delete in company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "calendar_events: own delete in company" ON public.calendar_events FOR DELETE USING (((user_id = auth.uid()) AND (public.auth_is_company_owner(company_id) OR public.auth_is_company_member(company_id))));


--
-- Name: calendar_events calendar_events: own insert in company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "calendar_events: own insert in company" ON public.calendar_events FOR INSERT WITH CHECK (((user_id = auth.uid()) AND (public.auth_is_company_owner(company_id) OR public.auth_is_company_member(company_id))));


--
-- Name: calendar_events calendar_events: own update in company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "calendar_events: own update in company" ON public.calendar_events FOR UPDATE USING (((user_id = auth.uid()) AND (public.auth_is_company_owner(company_id) OR public.auth_is_company_member(company_id)))) WITH CHECK (((user_id = auth.uid()) AND (public.auth_is_company_owner(company_id) OR public.auth_is_company_member(company_id))));


--
-- Name: companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

--
-- Name: companies companies: members can read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "companies: members can read" ON public.companies FOR SELECT USING (public.auth_is_company_member(id));


--
-- Name: companies companies: owner full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "companies: owner full access" ON public.companies USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));


--
-- Name: company_invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: company_invitations company_invitations: members can read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "company_invitations: members can read" ON public.company_invitations FOR SELECT USING (public.auth_is_company_member(company_id));


--
-- Name: company_invitations company_invitations: owner full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "company_invitations: owner full access" ON public.company_invitations USING (public.auth_is_company_owner(company_id)) WITH CHECK (public.auth_is_company_owner(company_id));


--
-- Name: company_invitations_backup_2026_04_27; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_invitations_backup_2026_04_27 ENABLE ROW LEVEL SECURITY;

--
-- Name: company_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

--
-- Name: company_members company_members: owner full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "company_members: owner full access" ON public.company_members USING (public.auth_is_company_owner(company_id)) WITH CHECK (public.auth_is_company_owner(company_id));


--
-- Name: company_members company_members: see own record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "company_members: see own record" ON public.company_members FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: company_members company_members: see team; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "company_members: see team" ON public.company_members FOR SELECT USING (public.auth_is_company_member(company_id));


--
-- Name: properties company_owner_update_submitted_properties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_owner_update_submitted_properties ON public.properties FOR UPDATE USING (((company_id IS NOT NULL) AND public.auth_is_company_owner(company_id)));


--
-- Name: contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: contacts contacts: agent read own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "contacts: agent read own" ON public.contacts FOR SELECT USING (((user_id = auth.uid()) AND public.auth_is_company_member(company_id)));


--
-- Name: contacts contacts: agent reads booking clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "contacts: agent reads booking clients" ON public.contacts FOR SELECT USING ((id IN ( SELECT bookings.contact_id
   FROM public.bookings
  WHERE ((bookings.booking_agent_id = auth.uid()) AND (bookings.contact_id IS NOT NULL)))));


--
-- Name: POLICY "contacts: agent reads booking clients" ON contacts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "contacts: agent reads booking clients" ON public.contacts IS 'TD-099: enable agent to read client contacts of bookings where they are the responsible agent. Closes the gap 
  behind the JS workaround in WebContactsScreen (TD-107 will remove the workaround).';


--
-- Name: contacts contacts: agent reads property owners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "contacts: agent reads property owners" ON public.contacts FOR SELECT USING ((id IN ( SELECT properties.owner_id
   FROM public.properties
  WHERE ((properties.responsible_agent_id = auth.uid()) AND (properties.owner_id IS NOT NULL))
UNION
 SELECT properties.owner_id_2
   FROM public.properties
  WHERE ((properties.responsible_agent_id = auth.uid()) AND (properties.owner_id_2 IS NOT NULL)))));


--
-- Name: contacts contacts: own delete in company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "contacts: own delete in company" ON public.contacts FOR DELETE USING (((user_id = auth.uid()) AND (public.auth_is_company_owner(company_id) OR public.auth_is_company_member(company_id))));


--
-- Name: contacts contacts: own insert in company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "contacts: own insert in company" ON public.contacts FOR INSERT WITH CHECK (((user_id = auth.uid()) AND (public.auth_is_company_owner(company_id) OR public.auth_is_company_member(company_id))));


--
-- Name: contacts contacts: own update in company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "contacts: own update in company" ON public.contacts FOR UPDATE USING (((user_id = auth.uid()) AND (public.auth_is_company_owner(company_id) OR public.auth_is_company_member(company_id)))) WITH CHECK (((user_id = auth.uid()) AND (public.auth_is_company_owner(company_id) OR public.auth_is_company_member(company_id))));


--
-- Name: contacts contacts: owner full read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "contacts: owner full read" ON public.contacts FOR SELECT USING (public.auth_is_company_owner(company_id));


--
-- Name: location_districts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.location_districts ENABLE ROW LEVEL SECURITY;

--
-- Name: location_districts location_districts: company member read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "location_districts: company member read" ON public.location_districts FOR SELECT USING (((location_id IN ( SELECT agent_location_access.location_id
   FROM public.agent_location_access
  WHERE (agent_location_access.user_id = auth.uid()))) OR (location_id IN ( SELECT locations.id
   FROM public.locations
  WHERE (locations.user_id = auth.uid())))));


--
-- Name: locations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

--
-- Name: locations locations: company member read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "locations: company member read" ON public.locations FOR SELECT USING ((company_id IN ( SELECT company_members.company_id
   FROM public.company_members
  WHERE ((company_members.user_id = auth.uid()) AND (company_members.status = 'active'::text)))));


--
-- Name: locations locations: own delete in company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "locations: own delete in company" ON public.locations FOR DELETE USING (((user_id = auth.uid()) AND (public.auth_is_company_owner(company_id) OR public.auth_is_company_member(company_id))));


--
-- Name: locations locations: own insert in company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "locations: own insert in company" ON public.locations FOR INSERT WITH CHECK (((user_id = auth.uid()) AND (public.auth_is_company_owner(company_id) OR public.auth_is_company_member(company_id))));


--
-- Name: locations locations: own update in company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "locations: own update in company" ON public.locations FOR UPDATE USING (((user_id = auth.uid()) AND (public.auth_is_company_owner(company_id) OR public.auth_is_company_member(company_id)))) WITH CHECK (((user_id = auth.uid()) AND (public.auth_is_company_owner(company_id) OR public.auth_is_company_member(company_id))));


--
-- Name: company_members members_read_own_membership; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_read_own_membership ON public.company_members FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: companies members_read_their_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_read_their_company ON public.companies FOR SELECT USING (public.auth_is_company_member(id));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications: own records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notifications: own records" ON public.notifications USING ((recipient_id = auth.uid())) WITH CHECK ((recipient_id = auth.uid()));


--
-- Name: properties; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

--
-- Name: properties properties: agent can delete assigned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "properties: agent can delete assigned" ON public.properties FOR DELETE USING (((responsible_agent_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.company_members cm
  WHERE ((cm.company_id = properties.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'active'::text) AND (COALESCE(((cm.permissions ->> 'can_manage_property'::text))::boolean, false) = true))))));


--
-- Name: properties properties: agent reads assigned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "properties: agent reads assigned" ON public.properties FOR SELECT USING ((responsible_agent_id = auth.uid()));


--
-- Name: properties properties: agent update assigned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "properties: agent update assigned" ON public.properties FOR UPDATE USING (((responsible_agent_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.company_members cm
  WHERE ((cm.company_id = properties.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'active'::text) AND (COALESCE(((cm.permissions ->> 'can_manage_property'::text))::boolean, false) = true)))))) WITH CHECK (((responsible_agent_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.company_members cm
  WHERE ((cm.company_id = properties.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'active'::text) AND (COALESCE(((cm.permissions ->> 'can_manage_property'::text))::boolean, false) = true))))));


--
-- Name: properties properties: own insert in company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "properties: own insert in company" ON public.properties FOR INSERT WITH CHECK (((user_id = auth.uid()) AND (public.auth_is_company_owner(company_id) OR public.auth_is_company_member(company_id))));


--
-- Name: properties properties: owner can delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "properties: owner can delete" ON public.properties FOR DELETE USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.companies
  WHERE ((companies.id = properties.company_id) AND (companies.owner_id = auth.uid()))))));


--
-- Name: properties properties: owner full update company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "properties: owner full update company" ON public.properties FOR UPDATE USING (public.auth_is_company_owner(company_id)) WITH CHECK (public.auth_is_company_owner(company_id));


--
-- Name: properties properties: owner or agent can insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "properties: owner or agent can insert" ON public.properties FOR INSERT WITH CHECK (((user_id = auth.uid()) AND (public.auth_is_company_owner(company_id) OR (EXISTS ( SELECT 1
   FROM public.company_members cm
  WHERE ((cm.company_id = properties.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'active'::text) AND (COALESCE(((cm.permissions ->> 'can_manage_property'::text))::boolean, false) = true)))))));


--
-- Name: properties properties: owner reads company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "properties: owner reads company" ON public.properties FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.companies c
  WHERE ((c.id = properties.company_id) AND (c.owner_id = auth.uid())))));


--
-- Name: properties properties: owner updates company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "properties: owner updates company" ON public.properties FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.companies c
  WHERE ((c.id = properties.company_id) AND (c.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.companies c
  WHERE ((c.id = properties.company_id) AND (c.owner_id = auth.uid())))));


--
-- Name: users_profile; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users_profile ENABLE ROW LEVEL SECURITY;

--
-- Name: users_profile users_profile_insert_on_signup; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_profile_insert_on_signup ON public.users_profile FOR INSERT WITH CHECK (true);


--
-- Name: users_profile users_profile_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_profile_self ON public.users_profile USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- PostgreSQL database dump complete
--

\unrestrict CiqKyny7lVlczSaHB8LbaXzDVQyPgR3cbIXIWjdQyvALPhyQApMCe4V3Lc9LJaX

