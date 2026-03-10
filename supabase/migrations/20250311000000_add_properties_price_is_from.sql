-- Add "is_from" flags for price fields (show "От" before price when true = minimum price)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS price_monthly_is_from BOOLEAN DEFAULT FALSE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS booking_deposit_is_from BOOLEAN DEFAULT FALSE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS save_deposit_is_from BOOLEAN DEFAULT FALSE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS commission_is_from BOOLEAN DEFAULT FALSE;
