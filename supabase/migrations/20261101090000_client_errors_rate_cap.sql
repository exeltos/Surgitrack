-- client_errors accepts a report from anyone signed in (viewers and applicants without a hospital included),
-- with no limit: one account in a loop could fill the table until the nightly 90-day purge. A signed-in
-- user may now report at most 60 errors an hour; the rest are refused (the app's reporter ignores a refusal,
-- see errorReporting.ts, so a crash loop on a screen stops flooding instead of failing visibly).
create index if not exists client_errors_user_time_idx on public.client_errors (user_id, occurred_at desc);

-- Security definer, because the reporter may not read the table (only the platform owner does), so the count
-- would see nothing as the caller. The service role and the owner have no auth.uid(): they are not limited.
create or replace function public.client_errors_rate_cap() returns trigger language plpgsql
  security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and (select count(*) from public.client_errors
           where user_id = new.user_id and occurred_at > now() - interval '1 hour') >= 60 then
    raise exception 'Too many error reports from this account; try again later'
      using errcode = '54000';
  end if;
  return new;
end $$;
revoke execute on function public.client_errors_rate_cap() from public, anon, authenticated;

drop trigger if exists client_errors_rate_cap on public.client_errors;
create trigger client_errors_rate_cap before insert on public.client_errors
  for each row execute function public.client_errors_rate_cap();
