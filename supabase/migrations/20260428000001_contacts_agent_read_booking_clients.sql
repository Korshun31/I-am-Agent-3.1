-- TD-099: Agent reads contact-clients of bookings they are responsible for.
-- Date: 2026-04-28
-- Description:
--   Existing contacts policies cover three agent visibility paths: own
--   created contacts (user_id = auth.uid()), property owners (via
--   properties.responsible_agent_id), and full company access for owner.
--   Missing path: clients linked to bookings the agent owns
--   (bookings.booking_agent_id = auth.uid()).
--
--   Without this policy, when admin creates a booking and assigns it to
--   an agent, the agent sees the booking on the calendar but the linked
--   client name comes back as null (RLS blocks the contacts row).
--
--   This migration adds the fourth SELECT policy to close that gap. It is
--   purely additive — Postgres OR-combines RLS SELECT policies, so existing
--   visibility rules are preserved. No data migration is needed.
--
--   Cleanup of the JS-side workaround in WebContactsScreen.js:536-566 is
--   tracked separately as TD-107.

DROP POLICY IF EXISTS "contacts: agent reads booking clients" ON contacts;
CREATE POLICY "contacts: agent reads booking clients"
  ON contacts FOR SELECT
  USING (
    id IN (
      SELECT contact_id
      FROM bookings
      WHERE booking_agent_id = auth.uid()
        AND contact_id IS NOT NULL
    )
  );

COMMENT ON POLICY "contacts: agent reads booking clients" ON contacts IS
  'TD-099: enable agent to read client contacts of bookings where they are the responsible agent. Closes the gap behind the JS workaround in WebContactsScreen (TD-107 will remove the workaround).';
