-- =============================================================================
-- БЭКАП СХЕМЫ БАЗЫ ДАННЫХ — до реализации командной системы
-- Дата: 21 марта 2026
-- =============================================================================
-- Это документация текущего состояния таблиц ПЕРЕД добавлением Team Feature.
-- Если нужно откатиться — смотри этот файл и восстанавливай вручную через Supabase SQL Editor.
-- Для отката миграции Этапа 1 используй: supabase/migrations/20250321000000_team_feature_stage1_down.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: agents
-- Создана вручную в Supabase (нет CREATE TABLE в репозитории)
-- -----------------------------------------------------------------------------
-- id           UUID    PK, linked to auth.users
-- email        TEXT
-- name         TEXT
-- last_name    TEXT
-- phone        TEXT
-- telegram     TEXT
-- whatsapp     TEXT
-- document_number TEXT
-- photo_url    TEXT
-- role         TEXT    'standard' | 'premium' | 'admin'   (добавлен add_agents_role.sql)
-- settings     JSONB   { language, selectedCurrency, locations, notificationSettings, workAs, companyInfo }
-- web_notifications JSONB { new_booking, booking_changed, new_event, new_property }

-- RLS: agents могут управлять только своей записью

-- -----------------------------------------------------------------------------
-- TABLE: locations
-- -----------------------------------------------------------------------------
-- id           UUID    PK
-- agent_id     UUID    FK → auth.users
-- country      TEXT
-- region       TEXT
-- city         TEXT
-- created_at   TIMESTAMPTZ

-- RLS: agent_id = auth.uid()

-- -----------------------------------------------------------------------------
-- TABLE: location_districts
-- Создана в: supabase_migrations/location_districts.sql
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS location_districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  district text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(location_id, district)
);

-- -----------------------------------------------------------------------------
-- TABLE: contacts
-- Создана вручную, поля добавлялись через ALTER TABLE
-- -----------------------------------------------------------------------------
-- id               UUID    PK
-- agent_id         UUID    FK → auth.users
-- type             TEXT    'clients' | 'owners'
-- name             TEXT
-- last_name        TEXT
-- phone            TEXT
-- email            TEXT
-- telegram         TEXT
-- whatsapp         TEXT
-- document_number  TEXT
-- nationality      TEXT
-- birthday         TEXT
-- photo_url        TEXT
-- extra_phones     JSONB   []
-- extra_emails     JSONB   []
-- extra_telegrams  JSONB   []   (добавлен 20250318)
-- extra_whatsapps  JSONB   []   (добавлен 20250318)
-- documents        JSONB   []
-- created_at       TIMESTAMPTZ
-- updated_at       TIMESTAMPTZ

-- RLS: agent_id = auth.uid()

-- -----------------------------------------------------------------------------
-- TABLE: properties
-- Создана вручную, поля добавлялись через ALTER TABLE
-- -----------------------------------------------------------------------------
-- id                       UUID       PK
-- agent_id                 UUID       FK → auth.users
-- name                     TEXT
-- type                     TEXT       'house' | 'resort' | 'condo'
-- code                     TEXT
-- code_suffix              TEXT                               (добавлен 20250224)
-- resort_id                UUID       FK → properties(id)    (самоссылка: объект внутри резорта/кондо)
-- location_id              UUID       FK → locations(id)
-- owner_id                 UUID       FK → contacts(id)      первый собственник
-- owner_id_2               UUID       FK → contacts(id)      второй собственник (добавлен 20250224)
-- city                     TEXT
-- district                 TEXT
-- address                  TEXT                              (добавлен 20250312)
-- google_maps_link         TEXT
-- website_url              TEXT                              (добавлен 20250310)
-- bedrooms                 INTEGER
-- bathrooms                INTEGER
-- area                     NUMERIC
-- houses_count             INTEGER
-- floors                   INTEGER
-- beach_distance           NUMERIC
-- market_distance          NUMERIC
-- air_conditioners         INTEGER
-- internet_speed           TEXT
-- description              TEXT
-- comments                 TEXT
-- photos                   JSONB      []
-- videos                   JSONB      []
-- amenities                JSONB      {}
-- pets_allowed             BOOLEAN    default false
-- long_term_booking        BOOLEAN    default false
-- price_monthly            NUMERIC
-- price_monthly_is_from    BOOLEAN    default false          (добавлен 20250311)
-- booking_deposit          NUMERIC
-- booking_deposit_is_from  BOOLEAN    default false          (добавлен 20250311)
-- save_deposit             NUMERIC
-- save_deposit_is_from     BOOLEAN    default false          (добавлен 20250311)
-- commission               NUMERIC
-- commission_is_from       BOOLEAN    default false          (добавлен 20250311)
-- electricity_price        NUMERIC
-- water_price              NUMERIC
-- water_price_type         TEXT
-- gas_price                NUMERIC
-- internet_price           NUMERIC
-- cleaning_price           NUMERIC
-- exit_cleaning_price      NUMERIC
-- created_at               TIMESTAMPTZ
-- updated_at               TIMESTAMPTZ

-- RLS: agent_id = auth.uid()

-- Примечание по типам объектов:
--   type = 'resort'                          → Резорт (родитель)
--   type = 'condo'                           → Кондоминиум (родитель)
--   type = 'house' без resort_id            → Отдельный дом
--   type = 'house' с resort_id → resort     → Дом внутри резорта
--   type = 'house' с resort_id → condo      → Апартаменты в кондо

-- -----------------------------------------------------------------------------
-- TABLE: bookings
-- Создана в: supabase/migrations/001_create_bookings.sql
-- -----------------------------------------------------------------------------
-- id                               UUID    PK
-- agent_id                         UUID    FK → auth.users
-- property_id                      UUID    FK → properties(id)
-- contact_id                       UUID    FK → contacts(id)
-- passport_id                      TEXT
-- not_my_customer                  BOOLEAN default false
-- check_in                         DATE
-- check_out                        DATE
-- check_in_time                    TEXT                      (добавлен 20250313)
-- check_out_time                   TEXT                      (добавлен 20250313)
-- price_monthly                    NUMERIC
-- total_price                      NUMERIC
-- booking_deposit                  NUMERIC
-- save_deposit                     NUMERIC
-- commission                       NUMERIC
-- owner_commission_one_time        NUMERIC                   (добавлен 20250315)
-- owner_commission_one_time_is_percent BOOLEAN
-- owner_commission_monthly         NUMERIC                   (добавлен 20250315)
-- owner_commission_monthly_is_percent  BOOLEAN
-- adults                           INTEGER
-- children                         INTEGER
-- pets                             BOOLEAN default false
-- comments                         TEXT
-- currency                         TEXT
-- photos                           JSONB   []                (добавлен 20250306)
-- reminder_days                    JSONB   []
-- created_at                       TIMESTAMPTZ               (добавлен 20250317)
-- updated_at                       TIMESTAMPTZ

-- RLS: agent_id = auth.uid()

-- -----------------------------------------------------------------------------
-- TABLE: calendar_events
-- Создана в: supabase_migrations/calendar_events.sql
-- -----------------------------------------------------------------------------
-- id               UUID    PK
-- agent_id         UUID    FK → auth.users
-- event_date       DATE
-- event_time       TIME
-- title            TEXT
-- color            TEXT    default '#64B5F6'
-- comments         TEXT
-- is_completed     BOOLEAN default false
-- reminder_minutes JSONB   []                (добавлен 20250319)
-- repeat_type      TEXT                      (добавлен 20250320) 'daily'|'weekly'|'monthly'|'yearly'
-- created_at       TIMESTAMPTZ

-- RLS: agent_id = auth.uid()
