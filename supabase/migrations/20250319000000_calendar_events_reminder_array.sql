-- Change reminder_minutes to jsonb array for multiple reminders
-- If column missing: add as jsonb. If integer: migrate to array. Run in Supabase SQL Editor.
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS reminder_minutes jsonb DEFAULT '[]'::jsonb;
-- If column was integer (from add_calendar_events_reminder.sql), migrate via temp column
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='calendar_events' AND column_name='reminder_minutes' AND data_type='integer') THEN
    ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS _rm_arr jsonb DEFAULT '[]'::jsonb;
    UPDATE calendar_events SET _rm_arr = CASE WHEN reminder_minutes IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(reminder_minutes) END;
    ALTER TABLE calendar_events DROP COLUMN reminder_minutes;
    ALTER TABLE calendar_events RENAME COLUMN _rm_arr TO reminder_minutes;
  END IF;
END $$;
