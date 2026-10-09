-- Evaluation Demos, phase 6: the daily round (demo-lifecycle) is run by the database scheduler.
-- The call carries a secret kept in the Vault (named demo_cron_secret, created outside the
-- migrations so it never sits in the repository); the function checks it through
-- demo_cron_secret_ok, which only the service role may call.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.demo_cron_secret_ok(p_secret text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(length(p_secret) >= 32 and exists (
    select 1 from vault.decrypted_secrets where name = 'demo_cron_secret' and decrypted_secret = p_secret
  ), false)
$$;
revoke all on function public.demo_cron_secret_ok(text) from public, anon, authenticated;
grant execute on function public.demo_cron_secret_ok(text) to service_role;

-- Every day at 06:17 UTC (09:17 in Athens in summer, 08:17 in winter).
select cron.schedule(
  'demo-lifecycle-daily',
  '17 6 * * *',
  $$
  select net.http_post(
    url := 'https://oklyqnoqzbhjudqbkulq.supabase.co/functions/v1/demo-lifecycle',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'demo_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
