-- Only the platform owner makes a hospital administrator. A hospital admin already could not change or remove another
-- admin's account (20261101203835); this closes the other side: giving someone the Admin role. It was still open
-- through a direct write to profiles (the insert and update policies allow a hospital admin to write any role in their
-- hospital) and through hospital_decide_access_request (p_role = 'ADMIN'). A trigger covers both, because it sees
-- the signed-in caller even inside a security definer function. The staff functions (service role, no signed-in
-- caller) check the same rule themselves: update-staff and invite-staff.
-- Not affected: the platform owner, the service role, signup (no signed-in caller), and an account with no hospital
-- (claim_platform_admin).
create or replace function public.admin_role_owner_only() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.role = 'ADMIN'
     and new.organization_id is not null
     and (tg_op = 'INSERT' or old.role is distinct from 'ADMIN' or old.organization_id is distinct from new.organization_id)
     and auth.uid() is not null
     and not public.is_platform_admin() then
    raise exception 'only the platform owner makes an administrator' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function public.admin_role_owner_only() from public, anon, authenticated;

drop trigger if exists surgitrack_admin_role_owner_only on public.profiles;
create trigger surgitrack_admin_role_owner_only before insert or update of role, organization_id on public.profiles
  for each row execute function public.admin_role_owner_only();
