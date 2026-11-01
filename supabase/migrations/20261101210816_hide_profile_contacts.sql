-- A signed-in user can no longer read profiles.email and profiles.user_code straight from the table: no
-- colleague's address to try passwords against, no code to lock out. Everything else in profiles stays readable
-- exactly as before; the staff functions (service role) and the security definer functions are not affected.
-- Reads of those two columns, in a select or in a filter, are refused with "permission denied". The app reads
-- them through public.profile_contacts() (migration 20261101203352).
--    NOTE: a column added to profiles later is not readable by signed-in users until it is granted.
--
-- History: this SQL was first run by hand in the Dashboard SQL Editor on 01/11/2026 at 15:29 UTC, before the app
-- that reads contacts through profile_contacts() was published (19:44 UTC), so in between the old sign-in screen
-- and users list (which selected email) were refused: the logs show one "permission denied for table profiles" at
-- 16:43 UTC. It was applied again as a migration at 21:08 UTC, which changed nothing and recorded the version.
revoke select on public.profiles from authenticated;
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'profiles' and column_name not in ('email', 'user_code');
  execute format('grant select (%s) on public.profiles to authenticated', cols);
end $$;
