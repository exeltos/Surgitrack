-- Deleting a whole hospital failed once it had records.
--
-- Deleting a hospital (delete-hospital, or a prospect's evaluation Demo through demo-account and the daily round)
-- removes its organizations row, and the database takes every record in it along (on delete cascade). Each of
-- those records then ran record_deletion (20261008150000_realtime_and_deleted_records.sql), which wrote a deletion
-- mark for a hospital that was no longer there: deleted_records.organization_id refused it and the whole delete
-- was undone ("violates foreign key constraint deleted_records_organization_id_fkey").
--
-- Now a record deleted while its hospital goes leaves no mark: no device of that hospital is left to tell, and the
-- hospital's own marks go with it. A record deleted on its own still leaves its mark, as before.

create or replace function public.record_deletion() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if exists (select 1 from public.organizations where id = old.organization_id) then
    insert into public.deleted_records (organization_id, collection, id) values (old.organization_id, tg_argv[0], old.id);
  end if;
  return old;
end $fn$;
revoke execute on function public.record_deletion() from public, anon, authenticated;
