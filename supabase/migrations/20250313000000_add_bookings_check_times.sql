-- Add check-in and check-out time for booking confirmation
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS check_in_time TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS check_out_time TEXT;
COMMENT ON COLUMN bookings.check_in_time IS 'Check-in time, e.g. 14:00';
COMMENT ON COLUMN bookings.check_out_time IS 'Check-out time, e.g. 12:00';
