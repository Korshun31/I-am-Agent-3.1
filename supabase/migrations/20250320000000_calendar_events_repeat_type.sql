-- Add repeat_type for recurring calendar events: daily, weekly, monthly, yearly
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS repeat_type text DEFAULT null;
