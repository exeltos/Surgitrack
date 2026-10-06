create or replace function public.resolve_login_email(p_user_code text)
returns text
language sql
security definer
set search_path = public
as $$
  select email
  from public.profiles
  where upper(user_code) = upper(trim(p_user_code))
    and active = true
  limit 1;
$$;
revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;
