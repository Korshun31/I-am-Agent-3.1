-- TD-120 фаза B: ежедневный запуск Edge Function sync-currency-rates через
-- pg_cron + pg_net. Время 06:00 UTC выбрано так, чтобы заведомо выпасть после
-- публикации ECB (около 16:00 CET предыдущего рабочего дня).
--
-- ПРЕДВАРИТЕЛЬНЫЕ УСЛОВИЯ (один раз руками в Dashboard):
--   1. Включить расширения pg_cron и pg_net в Database → Extensions.
--   2. Положить service_role_key в Vault через SQL Editor:
--        SELECT vault.create_secret('<JWT-ключ>', 'service_role_key', 'For pg_cron');
--      Vault — встроенный сейф Supabase, ключ хранится зашифрованным,
--      `current_setting`/ALTER DATABASE на managed-плане Supabase запрещены.
--
-- Edge Function URL прошит явно:
--   https://mdxujiuvmondmagfnwob.supabase.co/functions/v1/sync-currency-rates

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
      url     := 'https://mdxujiuvmondmagfnwob.supabase.co/functions/v1/sync-currency-rates',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'service_role_key'
          LIMIT 1
        )
      ),
      body    := '{}'::jsonb
    );
  $cron$
);
