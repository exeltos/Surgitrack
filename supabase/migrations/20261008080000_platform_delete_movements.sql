-- History (movements) is append-only for everyone. Only the platform owner can remove chosen entries
-- of a hospital (e.g. test or setup noise); the app records the clean-up itself as a new movement.
-- For anyone else the function deletes nothing and returns 0.
create or replace function public.platform_delete_movements(p_org uuid, p_ids text[])
returns integer
language sql security definer set search_path = public as $fn$
  with d as (
    delete from public.movements
     where public.is_platform_admin() and organization_id = p_org and id = any(p_ids)
    returning 1
  )
  select count(*)::integer from d
$fn$;
revoke execute on function public.platform_delete_movements(uuid, text[]) from public, anon;
grant execute on function public.platform_delete_movements(uuid, text[]) to authenticated;
