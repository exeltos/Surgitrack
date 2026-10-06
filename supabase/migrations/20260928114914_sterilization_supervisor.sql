alter table public.profiles add column if not exists supervisor boolean not null default false;
comment on column public.profiles.supervisor is 'Sterilization supervisor, named by the hospital admin. Only meaningful for the STERILIZATION role.';

create or replace function public.admin_profile_without_department()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if new.role = 'ADMIN' then
    new.department_id := null;
  end if;
  -- Only Sterilization staff can be supervisors.
  if new.role <> 'STERILIZATION' then
    new.supervisor := false;
  end if;
  return new;
end $function$;
