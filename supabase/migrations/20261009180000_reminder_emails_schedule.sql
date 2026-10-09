-- Morning reminder emails (edge function `reminders`), for the hospitals that turned them on in Studio →
-- Settings. Called by the database scheduler with the same Vault secret as the Demo round
-- (demo_cron_secret, checked by demo_cron_secret_ok). Every day at 04:47 UTC: 07:47 in Athens in summer,
-- 06:47 in winter, before the morning shift.
select cron.schedule(
  'reminder-emails-daily',
  '47 4 * * *',
  $$
  select net.http_post(
    url := 'https://oklyqnoqzbhjudqbkulq.supabase.co/functions/v1/reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'demo_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
