-- Add owner commission fields for agent calendar events and reminders.
-- Run in Supabase Dashboard → SQL Editor.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS owner_commission_one_time NUMERIC,
  ADD COLUMN IF NOT EXISTS owner_commission_monthly NUMERIC;

COMMENT ON COLUMN bookings.owner_commission_one_time IS 'One-time commission from property owner (paid at check-in)';
COMMENT ON COLUMN bookings.owner_commission_monthly IS 'Monthly commission from property owner (paid each month of stay)';
