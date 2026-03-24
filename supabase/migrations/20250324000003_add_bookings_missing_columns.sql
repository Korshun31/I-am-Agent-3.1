-- Add missing columns to bookings table
-- These columns are used in bookingsService.js but were missing from previous migrations.
-- Run in Supabase Dashboard → SQL Editor (already applied manually).

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS owner_commission_one_time_is_percent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS owner_commission_monthly_is_percent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reminder_days JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'THB';
