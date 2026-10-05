-- While a browser still runs a build from before phases 2–3, it writes movements, problem reports
-- and handover records to app_records. Each such write is forwarded to the new tables at once, so
-- the current build sees it too (history is added; a report keeps the newer of its two versions).
create or replace function public.forward_legacy_records() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.copy_legacy_records();
  return null;
end $$;
revoke execute on function public.forward_legacy_records() from public, anon, authenticated;

create trigger app_records_forward after insert or update on public.app_records
  for each statement execute function public.forward_legacy_records();
