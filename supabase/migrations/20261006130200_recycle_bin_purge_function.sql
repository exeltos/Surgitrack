-- Entries older than 30 days are removed by the app when the bin is opened; this does the same for
-- hospitals nobody opens it in (call it from a scheduled job, or by hand from the SQL editor).
create or replace function public.purge_recycle_bin() returns integer
language plpgsql security definer set search_path to 'public' as $function$
declare n integer;
begin
  delete from public.recycle_bin where created_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end $function$;
revoke all on function public.purge_recycle_bin() from public, anon, authenticated;
