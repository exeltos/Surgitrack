-- A stale write was refused with 40001 (serialization_failure), which the API server retries by itself:
-- a refusal that can never succeed was retried without end, holding the database's connections until every
-- other request timed out (18/11/2026). PT409 is returned to the device as HTTP 409 at once; the app
-- recognises it (code or message) and merges with the saved version as before.
create or replace function public.check_expected_version()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if new.expected_updated_at is not null and old.updated_at is distinct from new.expected_updated_at then
    raise exception 'record % changed on another device', old.id using errcode = 'PT409';
  end if;
  new.expected_updated_at := null;
  return new;
end $function$;
