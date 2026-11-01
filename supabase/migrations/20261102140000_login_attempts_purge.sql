-- login_attempts is the table of the rate limiter (sign-in, signup, and now the device and device-key limits of
-- device-ingest). Nothing ever removed its rows, and device-ingest adds one per request, so it would grow for
-- good. The limits look back an hour at most, so a day is plenty to keep; the nightly job now clears the rest.
create or replace function public.purge_login_attempts() returns void language sql security definer
  set search_path = public as $$
  delete from public.login_attempts where attempted_at < now() - interval '1 day'
$$;
revoke execute on function public.purge_login_attempts() from public, anon, authenticated;

-- The same nightly job as before (errors older than 90 days, recycle bin entries older than 30), plus this.
select cron.schedule('nightly-purge', '41 2 * * *',
  $$select public.purge_client_errors(); select public.purge_recycle_bin(); select public.purge_login_attempts();$$);
