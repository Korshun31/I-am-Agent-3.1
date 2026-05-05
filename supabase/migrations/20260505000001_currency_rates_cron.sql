-- TD-120 фаза B: ежедневный запуск Edge Function sync-currency-rates через
-- pg_cron + pg_net. Время 06:00 UTC выбрано так, чтобы заведомо выпасть после
-- публикации ECB (около 16:00 CET предыдущего рабочего дня).
--
-- ВАЖНО: значения `<PROJECT_REF>` и `service_role_key` нужно подставить вручную
-- в Supabase Dashboard перед накаткой этой миграции на prod. Для sandbox/dev
-- те же действия. Edge Function URL имеет вид:
--   https://<PROJECT_REF>.supabase.co/functions/v1/sync-currency-rates
--
-- Расширения должны быть включены в проекте (Dashboard → Database → Extensions):
--   - pg_cron
--   - pg_net

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- На случай повторной накатки — снимаем старый job, чтобы не было дубля.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-currency-rates-daily') THEN
    PERFORM cron.unschedule('sync-currency-rates-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'sync-currency-rates-daily',
  '0 6 * * *',
  $cron$
    SELECT net.http_post(
      url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/sync-currency-rates',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body    := '{}'::jsonb
    );
  $cron$
);
