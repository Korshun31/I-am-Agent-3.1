-- Reassign all bookings of admin korshun31@list.ru from his user_id to NULL (company).
-- Reason: legacy create logic put booking_agent_id = creator (admin). Admin doesn't
-- want company bookings showing as his personal responsibility on the calendar.
-- Trigger trg_enforce_booking_agent_matches_property explicitly allows
-- booking_agent_id = NULL (see 20260428000000_booking_assignment_integrity.sql).

DO $$
DECLARE
  admin_id UUID;
  affected INT;
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE email = 'korshun31@list.ru';
  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'User korshun31@list.ru not found in auth.users';
  END IF;

  UPDATE bookings
  SET booking_agent_id = NULL
  WHERE booking_agent_id = admin_id;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RAISE NOTICE 'Reassigned % bookings from admin % to company (NULL)', affected, admin_id;
END $$;
