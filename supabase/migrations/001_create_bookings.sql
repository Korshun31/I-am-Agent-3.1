-- Create bookings table for I am Agent app
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  passport_id TEXT,
  not_my_customer BOOLEAN NOT NULL DEFAULT false,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  price_monthly NUMERIC,
  total_price NUMERIC,
  booking_deposit NUMERIC,
  save_deposit NUMERIC,
  commission NUMERIC,
  adults INTEGER,
  children INTEGER,
  pets BOOLEAN DEFAULT false,
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bookings"
  ON bookings FOR ALL
  USING (auth.uid() = agent_id)
  WITH CHECK (auth.uid() = agent_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_bookings_property_id ON bookings(property_id);
CREATE INDEX IF NOT EXISTS idx_bookings_agent_id ON bookings(agent_id);
CREATE INDEX IF NOT EXISTS idx_bookings_check_in ON bookings(check_in);
