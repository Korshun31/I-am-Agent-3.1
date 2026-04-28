-- TD-086 closure: booking_agent_id integrity + notifications.booking_id
-- Date: 2026-04-28
--
-- !!! BEFORE APPLYING TO PRODUCTION !!!
--   Run the data-cleanup query first, otherwise existing bookings whose
--   booking_agent_id does not match property.responsible_agent_id will
--   break the integrity trigger on the next UPDATE:
--
--     -- 1) check what would break:
--     SELECT b.id, b.booking_agent_id, p.responsible_agent_id, p.name
--     FROM bookings b
--     JOIN properties p ON p.id = b.property_id
--     WHERE b.booking_agent_id IS NOT NULL
--       AND (p.responsible_agent_id IS NULL
--            OR b.booking_agent_id <> p.responsible_agent_id);
--
--     -- 2) if rows exist — neutralize them to "Company" (NULL):
--     UPDATE bookings b
--       SET booking_agent_id = NULL
--       FROM properties p
--       WHERE p.id = b.property_id
--         AND b.booking_agent_id IS NOT NULL
--         AND (p.responsible_agent_id IS NULL
--              OR b.booking_agent_id <> p.responsible_agent_id);
--
--   Sandbox cleanup was performed manually on 2026-04-28 (65 rows neutralised).
--
-- Description:
--   1. Trigger enforces bookings.booking_agent_id is either NULL or equal to
--      properties.responsible_agent_id of the booking's property.
--   2. Trigger on properties.responsible_agent_id change cascades NULL to
--      bookings.booking_agent_id where check_out >= CURRENT_DATE (current +
--      future stays). Past bookings are kept untouched.
--   3. RLS WITH CHECK patch: agent can write booking_agent_id only equal to
--      auth.uid() or NULL; admin (company_owner) bypasses via the wider
--      "owner full access to company" policy. Trigger 1 is the second line.
--   4. notifications.booking_id column + extended create_notification RPC
--      (adds optional p_booking_id parameter, backward compatible).

-- =============================================================================
-- 1. Trigger: bookings.booking_agent_id must match property.responsible_agent_id
-- =============================================================================

CREATE OR REPLACE FUNCTION enforce_booking_agent_matches_property()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

DROP TRIGGER IF EXISTS trg_enforce_booking_agent_matches_property ON bookings;
CREATE TRIGGER trg_enforce_booking_agent_matches_property
  BEFORE INSERT OR UPDATE OF booking_agent_id, property_id ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION enforce_booking_agent_matches_property();

-- =============================================================================
-- 2. Trigger: cascade properties.responsible_agent_id -> bookings.booking_agent_id
-- =============================================================================

CREATE OR REPLACE FUNCTION cascade_property_responsible_to_bookings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

DROP TRIGGER IF EXISTS trg_cascade_property_responsible ON properties;
CREATE TRIGGER trg_cascade_property_responsible
  AFTER UPDATE OF responsible_agent_id ON properties
  FOR EACH ROW
  EXECUTE FUNCTION cascade_property_responsible_to_bookings();

-- =============================================================================
-- 3. Patch RLS: agent INSERT/UPDATE — booking_agent_id must be self or NULL
-- =============================================================================

DROP POLICY IF EXISTS "bookings: agent insert own" ON bookings;
CREATE POLICY "bookings: agent insert own"
  ON bookings FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (auth_is_company_owner(company_id) OR auth_is_company_member(company_id))
    AND (
      auth_is_company_owner(company_id)
      OR booking_agent_id IS NULL
      OR booking_agent_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "bookings: agent update own" ON bookings;
CREATE POLICY "bookings: agent update own"
  ON bookings FOR UPDATE
  USING (
    booking_agent_id = auth.uid()
    AND (auth_is_company_owner(company_id) OR auth_is_company_member(company_id))
  )
  WITH CHECK (
    booking_agent_id = auth.uid()
    AND (auth_is_company_owner(company_id) OR auth_is_company_member(company_id))
  );

-- =============================================================================
-- 4. notifications.booking_id + extended create_notification RPC
-- =============================================================================

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notifications_booking ON notifications(booking_id);

CREATE OR REPLACE FUNCTION create_notification(
  p_recipient_id  UUID,
  p_sender_id     UUID,
  p_type          TEXT,
  p_title         TEXT,
  p_body          TEXT,
  p_property_id   UUID DEFAULT NULL,
  p_booking_id    UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
