# Technical Task: Preparing Supabase Database for Data Upload

**I am Agent** app exports the logged-in user's data to an external Supabase project. The recipient must prepare their database with the schema described below.

---

## Overview

The app will upload data using the **Supabase Service Role Key** (for write access). You provide:
- **Supabase Project URL** — e.g. `https://xxxxx.supabase.co`
- **Supabase Service Role Key** — from Project Settings → API

---

## Data Scope

The following data is exported for the **current user** (agent):
- **properties** — real estate (houses, resorts, condos, apartments)
- **contacts** — clients and owners
- **locations** — countries, regions, cities
- **location_districts** — districts within locations
- **bookings** — reservations
- **calendar_events** — personal calendar events

---

## Tables and Schema

### 1. `agents` (or reuse `auth.users`)

The app uses Supabase Auth. Each agent is `auth.users(id)`. If you need a separate agents table:

```sql
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
  -- optional: name, email, etc. if you want to store agent profile
);
```

**Note:** The upload will insert rows with `agent_id = <source agent uuid>`. You may map this to your own user/agent id or keep as-is.

---

### 2. `locations`

```sql
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country TEXT,
  region TEXT,
  city TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locations_agent_id ON locations(agent_id);
```

| Column      | Type         | Notes                    |
|-------------|--------------|--------------------------|
| id          | UUID         | PK                       |
| agent_id    | UUID         | FK → auth.users          |
| country     | TEXT         |                          |
| region      | TEXT         |                          |
| city        | TEXT         |                          |
| created_at  | TIMESTAMPTZ  |                          |

---

### 3. `location_districts`

```sql
CREATE TABLE IF NOT EXISTS location_districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  district TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(location_id, district)
);

CREATE INDEX IF NOT EXISTS idx_location_districts_location_id ON location_districts(location_id);
```

| Column      | Type         | Notes                    |
|-------------|--------------|--------------------------|
| id          | UUID         | PK                       |
| location_id | UUID         | FK → locations           |
| district    | TEXT         |                          |
| created_at  | TIMESTAMPTZ  |                          |

---

### 4. `contacts`

```sql
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,  -- 'clients' or 'owners'
  name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  telegram TEXT DEFAULT '',
  whatsapp TEXT DEFAULT '',
  document_number TEXT DEFAULT '',
  nationality TEXT DEFAULT '',
  birthday TEXT DEFAULT '',
  photo_url TEXT DEFAULT '',
  extra_phones JSONB DEFAULT '[]'::jsonb,
  extra_emails JSONB DEFAULT '[]'::jsonb,
  extra_telegrams JSONB DEFAULT '[]'::jsonb,
  extra_whatsapps JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_agent_id ON contacts(agent_id);
CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts(agent_id, type);
```

| Column          | Type         | Notes                    |
|-----------------|--------------|--------------------------|
| id              | UUID         | PK                       |
| agent_id        | UUID         | FK → auth.users          |
| type            | TEXT         | 'clients' \| 'owners'    |
| name            | TEXT         |                          |
| last_name       | TEXT         |                          |
| phone           | TEXT         |                          |
| email           | TEXT         |                          |
| telegram        | TEXT         |                          |
| whatsapp        | TEXT         |                          |
| document_number | TEXT         |                          |
| nationality     | TEXT         |                          |
| birthday        | TEXT         |                          |
| photo_url       | TEXT         |                          |
| extra_phones    | JSONB        | Array of strings         |
| extra_emails    | JSONB        | Array of strings         |
| extra_telegrams | JSONB        | Array of strings         |
| extra_whatsapps | JSONB        | Array of strings         |
| updated_at      | TIMESTAMPTZ  |                          |

---

### 5. `properties`

```sql
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'house',  -- 'house' | 'resort' | 'condo'
  name TEXT DEFAULT '',
  code TEXT DEFAULT '',
  code_suffix TEXT,
  resort_id UUID REFERENCES properties(id) ON DELETE CASCADE,  -- parent resort/condo
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  owner_id_2 UUID REFERENCES contacts(id) ON DELETE SET NULL,
  city TEXT DEFAULT '',
  district TEXT DEFAULT '',
  address TEXT,
  google_maps_link TEXT,
  website_url TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  area NUMERIC,
  houses_count INTEGER,
  floors INTEGER,
  beach_distance NUMERIC,
  market_distance NUMERIC,
  air_conditioners INTEGER,
  internet_speed TEXT,
  description TEXT,
  comments TEXT,
  photos JSONB DEFAULT '[]'::jsonb,
  videos JSONB DEFAULT '[]'::jsonb,
  amenities JSONB DEFAULT '{}'::jsonb,
  pets_allowed BOOLEAN DEFAULT false,
  long_term_booking BOOLEAN DEFAULT false,
  price_monthly NUMERIC,
  price_monthly_is_from BOOLEAN DEFAULT false,
  booking_deposit NUMERIC,
  booking_deposit_is_from BOOLEAN DEFAULT false,
  save_deposit NUMERIC,
  save_deposit_is_from BOOLEAN DEFAULT false,
  commission NUMERIC,
  commission_is_from BOOLEAN DEFAULT false,
  electricity_price NUMERIC,
  water_price NUMERIC,
  water_price_type TEXT,  -- 'cubic' | 'person' | 'fixed'
  gas_price NUMERIC,
  internet_price NUMERIC,
  cleaning_price NUMERIC,
  exit_cleaning_price NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_properties_agent_id ON properties(agent_id);
CREATE INDEX IF NOT EXISTS idx_properties_resort_id ON properties(resort_id);
CREATE INDEX IF NOT EXISTS idx_properties_location_id ON properties(location_id);
CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON properties(owner_id);
```

| Column                | Type         | Notes                              |
|-----------------------|--------------|------------------------------------|
| id                    | UUID         | PK                                 |
| agent_id              | UUID         | FK → auth.users                    |
| type                  | TEXT         | 'house' \| 'resort' \| 'condo'     |
| name                  | TEXT         |                                    |
| code                  | TEXT         |                                    |
| code_suffix           | TEXT         | e.g. "72-А" for house in resort    |
| resort_id             | UUID         | FK → properties (parent)           |
| location_id           | UUID         | FK → locations                     |
| owner_id              | UUID         | FK → contacts                      |
| owner_id_2            | UUID         | FK → contacts                      |
| city                  | TEXT         |                                    |
| district              | TEXT         |                                    |
| address               | TEXT         |                                    |
| google_maps_link      | TEXT         |                                    |
| website_url           | TEXT         |                                    |
| bedrooms              | INTEGER      |                                    |
| bathrooms             | INTEGER      |                                    |
| area                  | NUMERIC      | m²                                 |
| houses_count          | INTEGER      | for resort                         |
| floors                | INTEGER      |                                    |
| beach_distance        | NUMERIC      |                                    |
| market_distance       | NUMERIC      |                                    |
| air_conditioners      | INTEGER      |                                    |
| internet_speed        | TEXT         |                                    |
| description           | TEXT         |                                    |
| comments              | TEXT         |                                    |
| photos                | JSONB        | Array of URLs                      |
| videos                | JSONB        | Array of URLs                      |
| amenities             | JSONB        | Object with amenity keys           |
| pets_allowed          | BOOLEAN      |                                    |
| long_term_booking     | BOOLEAN      |                                    |
| price_monthly         | NUMERIC      |                                    |
| price_monthly_is_from | BOOLEAN      |                                    |
| booking_deposit       | NUMERIC      |                                    |
| booking_deposit_is_from | BOOLEAN    |                                    |
| save_deposit          | NUMERIC      |                                    |
| save_deposit_is_from  | BOOLEAN      |                                    |
| commission            | NUMERIC      |                                    |
| commission_is_from    | BOOLEAN      |                                    |
| electricity_price     | NUMERIC      |                                    |
| water_price           | NUMERIC      |                                    |
| water_price_type      | TEXT         | 'cubic' \| 'person' \| 'fixed'      |
| gas_price             | NUMERIC      |                                    |
| internet_price        | NUMERIC      |                                    |
| cleaning_price        | NUMERIC      |                                    |
| exit_cleaning_price   | NUMERIC      |                                    |
| created_at            | TIMESTAMPTZ  |                                    |
| updated_at            | TIMESTAMPTZ  |                                    |

---

### 6. `bookings`

```sql
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  passport_id TEXT,
  not_my_customer BOOLEAN NOT NULL DEFAULT false,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  check_in_time TEXT,
  check_out_time TEXT,
  price_monthly NUMERIC,
  total_price NUMERIC,
  booking_deposit NUMERIC,
  save_deposit NUMERIC,
  commission NUMERIC,
  owner_commission_one_time NUMERIC,
  owner_commission_monthly NUMERIC,
  adults INTEGER,
  children INTEGER,
  pets BOOLEAN DEFAULT false,
  comments TEXT,
  photos JSONB DEFAULT '[]'::jsonb,
  reminder_days JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_agent_id ON bookings(agent_id);
CREATE INDEX IF NOT EXISTS idx_bookings_property_id ON bookings(property_id);
CREATE INDEX IF NOT EXISTS idx_bookings_contact_id ON bookings(contact_id);
CREATE INDEX IF NOT EXISTS idx_bookings_check_in ON bookings(check_in);
```

| Column                     | Type         | Notes                    |
|----------------------------|--------------|--------------------------|
| id                         | UUID         | PK                       |
| agent_id                   | UUID         | FK → auth.users          |
| property_id                | UUID         | FK → properties          |
| contact_id                 | UUID         | FK → contacts (nullable) |
| passport_id                | TEXT         |                          |
| not_my_customer            | BOOLEAN      |                          |
| check_in                   | DATE         |                          |
| check_out                  | DATE         |                          |
| check_in_time              | TEXT         | e.g. "14:00"             |
| check_out_time             | TEXT         | e.g. "12:00"             |
| price_monthly              | NUMERIC      |                          |
| total_price                | NUMERIC      |                          |
| booking_deposit            | NUMERIC      |                          |
| save_deposit               | NUMERIC      |                          |
| commission                 | NUMERIC      |                          |
| owner_commission_one_time  | NUMERIC      |                          |
| owner_commission_monthly   | NUMERIC      |                          |
| adults                     | INTEGER      |                          |
| children                   | INTEGER      |                          |
| pets                       | BOOLEAN      |                          |
| comments                   | TEXT         |                          |
| photos                     | JSONB        | Array of URLs            |
| reminder_days              | JSONB        | Array of integers        |
| created_at                 | TIMESTAMPTZ  |                          |
| updated_at                 | TIMESTAMPTZ  |                          |

---

### 7. `calendar_events`

```sql
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  event_time TIME,
  title TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64B5F6',
  comments TEXT,
  reminder_minutes JSONB DEFAULT '[]'::jsonb,
  repeat_type TEXT,  -- 'daily' | 'weekly' | 'monthly' | 'yearly'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_agent_id ON calendar_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_event_date ON calendar_events(event_date);
```

| Column          | Type         | Notes                              |
|-----------------|--------------|------------------------------------|
| id              | UUID         | PK                                 |
| agent_id        | UUID         | FK → auth.users                    |
| event_date      | DATE         |                                    |
| event_time      | TIME         |                                    |
| title           | TEXT         |                                    |
| color           | TEXT         | e.g. '#64B5F6'                     |
| comments        | TEXT         |                                    |
| reminder_minutes| JSONB        | Array of integers (minutes)        |
| repeat_type     | TEXT         | 'daily' \| 'weekly' \| 'monthly' \| 'yearly' |
| created_at      | TIMESTAMPTZ  |                                    |

---

## Insert Order (Referential Integrity)

When uploading, tables must be inserted in this order to satisfy foreign keys:

1. **locations** (no FKs to our tables)
2. **location_districts** (depends on locations)
3. **contacts** (no FKs to our tables)
4. **properties** (depends on locations, contacts; resort_id can reference same batch)
5. **bookings** (depends on properties, contacts)
6. **calendar_events** (no FKs to our tables)

---

## Row Level Security (RLS)

For Service Role Key writes, RLS is bypassed. If you enable RLS for your own app users, ensure:

- Policies allow the Service Role to insert/update, or
- Temporarily disable RLS for the upload, or
- Use a policy that permits inserts from the service role.

---

## Auth

The app connects with **Service Role Key** — no auth.users records are created in your project. The `agent_id` in uploaded rows is the UUID from the source app's auth. You can:

- Keep `agent_id` as-is and map to your users later, or
- Create a mapping table (source_agent_id → your_user_id).

---

## Photo/Video URLs

`photos` and `videos` in properties, and `photos` in bookings, store **URLs** (strings). These may point to the source app's Supabase Storage. If you want local copies, you'll need a separate process to download and re-upload.

---

## Version

This schema reflects **I am Agent** app state as of March 2026. Future app updates may add columns — consider adding new columns with `ADD COLUMN IF NOT EXISTS` to stay compatible.
