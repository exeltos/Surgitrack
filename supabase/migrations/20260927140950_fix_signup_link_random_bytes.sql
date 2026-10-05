-- pgcrypto lives in the "extensions" schema on Supabase; the function's search_path is public only.
create or replace function public.hospital_create_signup_link(p_org uuid)
returns table(token text, expires_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare v_token text := encode(extensions.gen_random_bytes(18), 'hex');
begin
  if not public.is_org_admin(p_org) then raise exception 'forbidden'; end if;
  if exists (select 1 from public.organizations o where o.id = p_org and o.is_demo) then
    raise exception 'demo hospitals have no signup link';
  end if;
  update public.signup_links set revoked_at = now()
   where organization_id = p_org and revoked_at is null and signup_links.expires_at > now();
  insert into public.signup_links(organization_id, token, expires_at, created_by)
  values (p_org, v_token, now() + interval '10 days', auth.uid());
  return query select v_token, now() + interval '10 days';
end $$;
