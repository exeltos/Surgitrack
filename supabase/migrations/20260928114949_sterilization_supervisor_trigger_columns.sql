drop trigger if exists surgitrack_admin_without_department on public.profiles;
create trigger surgitrack_admin_without_department before insert or update of role, department_id, supervisor on public.profiles for each row execute function public.admin_profile_without_department();
