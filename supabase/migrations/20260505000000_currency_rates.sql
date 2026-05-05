-- TD-120 фаза B: архив курсов валют для статистики.
-- Заполняется ежедневно Edge Function sync-currency-rates (источник ECB через
-- api.frankfurter.app). Никогда не очищается — нужен исторический срез по
-- датам, чтобы конвертировать прошлые брони по курсу их даты.
--
-- Поддерживаемые валюты: USD, EUR, THB, RUB. Кросс-курсы (например THB→RUB)
-- вычисляются на клиенте через USD как опорную базу.
--
-- Read: любой авторизованный (курсы общие для всей системы, не привязаны к
-- юзеру/компании). Write: только service_role (Edge Function).

CREATE TABLE IF NOT EXISTS public.currency_rates (
  rate_date       DATE        NOT NULL,
  base_currency   TEXT        NOT NULL CHECK (base_currency  IN ('USD','EUR','THB','RUB')),
  quote_currency  TEXT        NOT NULL CHECK (quote_currency IN ('USD','EUR','THB','RUB')),
  rate            NUMERIC(18,8) NOT NULL CHECK (rate > 0),
  source          TEXT        NOT NULL DEFAULT 'frankfurter',
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (rate_date, base_currency, quote_currency)
);

CREATE INDEX IF NOT EXISTS currency_rates_date_idx
  ON public.currency_rates (rate_date DESC);

ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "currency_rates_read" ON public.currency_rates;
CREATE POLICY "currency_rates_read"
  ON public.currency_rates
  FOR SELECT
  TO authenticated
  USING (true);
