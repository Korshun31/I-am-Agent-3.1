-- Add website_url for house/apartment property listings (link to listing page)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS website_url TEXT;
COMMENT ON COLUMN properties.website_url IS 'Link to property listing page on external website';
