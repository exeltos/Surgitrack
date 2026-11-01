-- Sign-in locked an account after 5 wrong passwords in 15 minutes from ANYWHERE, so anyone who knew a username
-- (two letters and four digits) could keep that person out for good with five requests every quarter of an hour.
-- The limiter now also counts per username AND address (p_max_pair_fails): a few wrong passwords from one address
-- stop that address, not the person, who can still sign in from theirs. The limit per username alone stays as a
-- higher ceiling against a guess spread over many addresses (login-with-code: 5 per username and address, 30 per
-- username, 20 per address). Callers that do not pass the new limit (signup, device-ingest, verify-handover)
-- behave exactly as before.
drop function if exists public.reserve_login_attempt(text, text, int, int, int);

create or replace function public.reserve_login_attempt(
  p_user_code text, p_ip text, p_window_minutes int, p_max_code_fails int, p_max_ip_fails int,
  p_max_pair_fails int default null
) returns bigint
language plpgsql security definer set search_path=public as $$
declare
  v_since timestamptz := now() - make_interval(mins => p_window_minutes);
  v_id bigint;
begin
  perform pg_advisory_xact_lock(hashtext('login-code:' || p_user_code));
  perform pg_advisory_xact_lock(hashtext('login-ip:' || p_ip));
  if (select count(*) from public.login_attempts
      where user_code = p_user_code and not succeeded and attempted_at >= v_since) >= p_max_code_fails
     or (select count(*) from public.login_attempts
      where ip = p_ip and not succeeded and attempted_at >= v_since) >= p_max_ip_fails
     or (p_max_pair_fails is not null and (select count(*) from public.login_attempts
      where user_code = p_user_code and ip = p_ip and not succeeded and attempted_at >= v_since) >= p_max_pair_fails) then
    return null;
  end if;
  insert into public.login_attempts(user_code, ip, succeeded) values (p_user_code, p_ip, false)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.reserve_login_attempt(text, text, int, int, int, int) from public, anon, authenticated;
grant execute on function public.reserve_login_attempt(text, text, int, int, int, int) to service_role;
