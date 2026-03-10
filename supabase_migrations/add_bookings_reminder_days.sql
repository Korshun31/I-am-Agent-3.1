-- Add reminder_days column to bookings for notification scheduling
-- Values: array of days before check-in (e.g. [1, 3, 7, 30] = day, 3 days, week, month)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_days JSONB DEFAULT '[]';
