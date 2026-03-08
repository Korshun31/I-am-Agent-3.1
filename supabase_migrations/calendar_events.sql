-- Run this SQL in Supabase SQL Editor to create the calendar_events table

CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_date date NOT NULL,
  event_time time,
  title text NOT NULL,
  color text NOT NULL DEFAULT '#64B5F6',
  comments text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Policy: agents can only access their own events
CREATE POLICY "Users can manage own calendar events"
  ON calendar_events
  FOR ALL
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());
