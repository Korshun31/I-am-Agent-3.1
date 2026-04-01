DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='properties' AND column_name='owner_commission_one_time_is_from'
  ) THEN
    ALTER TABLE public.properties DROP COLUMN owner_commission_one_time_is_from;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='properties' AND column_name='owner_commission_monthly_is_from'
  ) THEN
    ALTER TABLE public.properties DROP COLUMN owner_commission_monthly_is_from;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bookings' AND column_name='owner_commission_one_time_is_from'
  ) THEN
    ALTER TABLE public.bookings DROP COLUMN owner_commission_one_time_is_from;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bookings' AND column_name='owner_commission_monthly_is_from'
  ) THEN
    ALTER TABLE public.bookings DROP COLUMN owner_commission_monthly_is_from;
  END IF;
END $$;
