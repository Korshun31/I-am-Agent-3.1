-- Add extra_telegrams and extra_whatsapps arrays for multiple Telegram/WhatsApp entries
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS extra_telegrams jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS extra_whatsapps jsonb DEFAULT '[]'::jsonb;
