-- TD-084: Remove overly permissive RLS policy on bookings.
-- "bookings: company member read" gives agents access to ALL company bookings.
-- Agent should only see bookings on properties where responsible_agent_id = auth.uid()
-- (already covered by "bookings: agent reads assigned property bookings")
-- and own bookings (covered by "bookings: agent read own").

DROP POLICY IF EXISTS "bookings: company member read" ON bookings;
