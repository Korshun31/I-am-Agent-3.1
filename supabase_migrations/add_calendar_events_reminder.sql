-- Add reminder_minutes column to calendar_events
-- null = no reminder, 0 = at moment of event, 5 = 5 min before, etc.

ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS reminder_minutes integer DEFAULT null;
