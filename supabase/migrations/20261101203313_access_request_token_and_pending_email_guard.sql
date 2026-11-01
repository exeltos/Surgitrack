-- Two ways a hospital admin could skip the "the applicant proved their email" step of a signup by link:
--
-- 1. staff_access_requests.confirm_token is the one-time secret in the emailed confirmation link. The
--    admin's read policy returned every column, so an admin could read it and confirm the address for the
--    applicant (staff-signup, action "confirm"). The column is no longer readable by signed-in users: the
--    staff functions (service role) are the only readers. Every other column stays readable as before, and
--    no screen of the app selects confirm_token.
--    NOTE: a column added to this table later is not readable by signed-in users until it is granted.
revoke select on public.staff_access_requests from authenticated;
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'staff_access_requests' and column_name <> 'confirm_token';
  execute format('grant select (%s) on public.staff_access_requests to authenticated', cols);
end $$;

-- 2. An admin may update profiles of their hospital directly, so they could set active = true on the account
--    of an applicant whose request still waits for the email confirmation (update-staff refuses this, a
--    direct write did not). A direct write through the API can no longer activate such an account; the
--    request moves on by itself once the email is confirmed (staff_request_email_confirmed).
create or replace function public.profiles_pending_email_guard() returns trigger language plpgsql
  set search_path = public as $$
begin
  if current_user = 'authenticated'
     and new.active
     and (tg_op = 'INSERT' or not old.active)
     and exists (select 1 from public.staff_access_requests r
                  where r.user_id = new.id and r.status = 'PENDING_EMAIL') then
    raise exception 'The email of this signup is not confirmed yet'
      using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function public.profiles_pending_email_guard() from public, anon, authenticated;

drop trigger if exists profiles_pending_email_guard on public.profiles;
create trigger profiles_pending_email_guard before insert or update on public.profiles
  for each row execute function public.profiles_pending_email_guard();
