-- A hospital admin manages the whole hospital and belongs to no department, whichever path
-- creates or changes the profile (Studio invite, signup approval, role change).
create or replace function public.admin_profile_without_department() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.role = 'ADMIN' then
    new.department_id := null;
  end if;
  return new;
end $$;
revoke execute on function public.admin_profile_without_department() from public, anon, authenticated;
drop trigger if exists surgitrack_admin_without_department on public.profiles;
create trigger surgitrack_admin_without_department
  before insert or update of role, department_id on public.profiles
  for each row execute function public.admin_profile_without_department();
