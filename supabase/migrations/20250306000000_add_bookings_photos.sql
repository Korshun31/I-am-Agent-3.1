-- Add photos column to bookings for storing booking-related photos
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]';
