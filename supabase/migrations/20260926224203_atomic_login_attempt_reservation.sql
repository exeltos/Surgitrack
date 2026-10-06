-- Atomically checks the failure limits and records a pending (failed) attempt.
-- Concurrent requests for the same code or IP are serialized by transaction-scoped
-- advisory locks (always code first, then IP, so they cannot deadlock).
-- Returns the attempt id, or null when the caller is rate limited.
create or replace function public.reserve_login_attempt(
  p_user_code text, p_ip text, p_window_minutes int, p_max_code_fails int, p_max_ip_fails int
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
      where ip = p_ip and not succeeded and attempted_at >= v_since) >= p_max_ip_fails then
    return null;
  end if;
  insert into public.login_attempts(user_code, ip, succeeded) values (p_user_code, p_ip, false)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.reserve_login_attempt(text, text, int, int, int) from public, anon, authenticated;
grant execute on function public.reserve_login_attempt(text, text, int, int, int) to service_role;
grant select, insert, update on public.login_attempts to service_role;
