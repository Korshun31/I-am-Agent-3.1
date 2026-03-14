-- =============================================================================
-- I am Agent: дополнение схемы для выгрузки данных
-- =============================================================================
-- Выполните в Supabase: SQL Editor → New query → вставьте и запустите.
-- Добавляет недостающие столбцы в существующие таблицы.
-- Ошибки "column already exists" можно игнорировать.
-- =============================================================================

-- ВАЖНО: Снимаем FK на auth.users — agent_id приходит из другого проекта,
-- в вашем auth.users такого пользователя нет. Без этого insert падает.
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_agent_id_fkey;
ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_agent_id_fkey;
ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_agent_id_fkey;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_agent_id_fkey;
ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_agent_id_fkey;

-- CONTACTS
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS telegram TEXT DEFAULT '';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS whatsapp TEXT DEFAULT '';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS document_number TEXT DEFAULT '';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS nationality TEXT DEFAULT '';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS birthday TEXT DEFAULT '';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT '';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS extra_phones JSONB DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS extra_emails JSONB DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS extra_telegrams JSONB DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS extra_whatsapps JSONB DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- LOCATIONS (если есть отличия)
-- обычно: id, agent_id, country, region, city, created_at — достаточно

-- LOCATION_DISTRICTS (если нет)
-- CREATE TABLE IF NOT EXISTS location_districts (...) — см. technical task

-- PROPERTIES
ALTER TABLE properties ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'house';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS code TEXT DEFAULT '';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS code_suffix TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS resort_id UUID;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS location_id UUID;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_id_2 UUID;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS city TEXT DEFAULT '';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS district TEXT DEFAULT '';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS google_maps_link TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS bedrooms INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS bathrooms INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS area NUMERIC;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS houses_count INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS floors INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS beach_distance NUMERIC;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS market_distance NUMERIC;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS air_conditioners INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS internet_speed TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS comments TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS videos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS amenities JSONB DEFAULT '{}'::jsonb;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS pets_allowed BOOLEAN DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS long_term_booking BOOLEAN DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS price_monthly NUMERIC;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS price_monthly_is_from BOOLEAN DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS booking_deposit NUMERIC;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS booking_deposit_is_from BOOLEAN DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS save_deposit NUMERIC;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS save_deposit_is_from BOOLEAN DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS commission NUMERIC;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS commission_is_from BOOLEAN DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS electricity_price NUMERIC;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS water_price NUMERIC;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS water_price_type TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS gas_price NUMERIC;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS internet_price NUMERIC;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS cleaning_price NUMERIC;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS exit_cleaning_price NUMERIC;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE properties ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- BOOKINGS
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS check_in_time TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS check_out_time TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS owner_commission_one_time NUMERIC;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS owner_commission_monthly NUMERIC;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_days JSONB DEFAULT '[]'::jsonb;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- CALENDAR_EVENTS
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#64B5F6';
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS reminder_minutes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS repeat_type TEXT;
