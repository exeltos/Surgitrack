-- STAGED, NOT YET PART OF supabase/migrations. Apply it only together with (or after) the app version that
-- reads emails and usernames through public.profile_contacts() (see staged/README.md).
--
-- After it, a signed-in user can no longer read profiles.email and profiles.user_code straight from the table:
-- no colleague's address to try passwords against, no code to lock out. Everything else in profiles stays
-- readable exactly as before; the staff functions (service role) and the security definer functions are not
-- affected. Reads of those two columns, in a select or in a filter, are refused with "permission denied".
--    NOTE: a column added to profiles later is not readable by signed-in users until it is granted.
revoke select on public.profiles from authenticated;
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'profiles' and column_name not in ('email', 'user_code');
  execute format('grant select (%s) on public.profiles to authenticated', cols);
end $$;
