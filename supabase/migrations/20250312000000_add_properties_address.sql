-- Add address column for property (displayed in booking confirmation)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS address TEXT;
COMMENT ON COLUMN properties.address IS 'Property address for booking confirmation';
