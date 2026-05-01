-- TD-082: помесячная разбивка стоимости бронирования.
-- Хранится как массив объектов { month: 'YYYY-MM', amount: number }.
-- Пустой массив = используется автоматический расчёт по price_monthly.
-- Заполненный массив = индивидуальная схема платежей юзера.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS monthly_breakdown JSONB DEFAULT '[]'::jsonb NOT NULL;

COMMENT ON COLUMN bookings.monthly_breakdown IS
  'TD-082: помесячная разбивка стоимости. Массив { month: "YYYY-MM", amount: number }. Пустой = авто-расчёт по price_monthly.';
