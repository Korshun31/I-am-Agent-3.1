-- Enable Realtime for properties table
ALTER TABLE properties REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE properties;
