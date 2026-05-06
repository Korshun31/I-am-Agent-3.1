-- TD-086: Add booking_agent_id — responsible person for each booking.
-- Analogous to properties.responsible_agent_id.
--
-- booking_agent_id = NULL → booking belongs to "Company" (admin)
-- booking_agent_id = UUID → booking belongs to specific agent
--
-- Agent can edit/delete only bookings where booking_agent_id = their id.
-- Agent sees full client data only for their own bookings.

-- 1. Add column
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS booking_agent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Backfill: existing bookings get booking_agent_id = user_id (creator = responsible)
UPDATE bookings SET booking_agent_id = user_id WHERE booking_agent_id IS NULL;

-- 3. Update RLS: agent read own → by booking_agent_id instead of user_id
DROP POLICY IF EXISTS "bookings: agent read own" ON bookings;
CREATE POLICY "bookings: agent read own"
  ON bookings FOR SELECT
  USING (booking_agent_id = auth.uid());

-- 4. Update RLS: agent update own → by booking_agent_id
DROP POLICY IF EXISTS "bookings: agent update own" ON bookings;
CREATE POLICY "bookings: agent update own"
  ON bookings FOR UPDATE
  USING ((booking_agent_id = auth.uid()) AND (auth_is_company_owner(company_id) OR auth_is_company_member(company_id)));

-- 5. Update RLS: agent delete own → by booking_agent_id
DROP POLICY IF EXISTS "bookings: agent delete own" ON bookings;
CREATE POLICY "bookings: agent delete own"
  ON bookings FOR DELETE
  USING ((booking_agent_id = auth.uid()) AND (auth_is_company_owner(company_id) OR auth_is_company_member(company_id)));

-- 6. Index for performance
CREATE INDEX IF NOT EXISTS idx_bookings_booking_agent_id ON bookings(booking_agent_id);
