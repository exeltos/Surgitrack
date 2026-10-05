-- Records name their department (the app's model), so a department rename must carry over to the
-- current-state records of that hospital. History (movements, workflow records) keeps the name that
-- applied when it was written.
create or replace function public.rename_department_references() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.name is distinct from old.name then
    update public.app_records
       set data = jsonb_set(data, '{department}', to_jsonb(new.name)),
           updated_at = now()
     where organization_id = new.organization_id
       and collection in ('sets','tools','issues')
       and data->>'department' = old.name;
  end if;
  return new;
end $$;
revoke execute on function public.rename_department_references() from public, anon, authenticated;

drop trigger if exists departments_rename_references on public.departments;
create trigger departments_rename_references
  after update of name on public.departments
  for each row execute function public.rename_department_references();
