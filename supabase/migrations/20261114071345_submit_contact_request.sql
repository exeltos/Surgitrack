-- «Ζητήστε παρουσίαση»: the limits (per address, and for the whole form, in the last hour) are checked and the
-- request stored in one step, under a lock, so a burst of simultaneous requests cannot all see «none yet» and
-- slip past them. Only the contact-request edge function (service role) calls it.
create or replace function public.submit_contact_request(
  p_name text,
  p_organization text,
  p_role text,
  p_email text,
  p_phone text,
  p_message text,
  p_ip_hash text,
  p_per_address integer,
  p_per_hour integer
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_since timestamptz := now() - interval '1 hour';
begin
  -- One request at a time: the next waits until this one is counted (released at the end of the transaction).
  perform pg_advisory_xact_lock(hashtext('public.contact_requests'));
  if (select count(*) from public.contact_requests where created_at >= v_since) >= p_per_hour
     or (select count(*) from public.contact_requests where ip_hash = p_ip_hash and created_at >= v_since) >= p_per_address
  then
    return 'too_many';
  end if;
  insert into public.contact_requests (name, organization, role, email, phone, message, ip_hash)
  values (p_name, p_organization, p_role, p_email, p_phone, p_message, p_ip_hash);
  return 'ok';
end $$;
revoke all on function public.submit_contact_request(text, text, text, text, text, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.submit_contact_request(text, text, text, text, text, text, text, integer, integer)
  to service_role;
