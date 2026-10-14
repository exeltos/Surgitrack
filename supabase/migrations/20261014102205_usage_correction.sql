-- Uses can be corrected by who may set the usage limit.
--
-- usage_never_decreases (20261010120000_handover_and_usage_integrity.sql) keeps a Set's or instrument's uses from
-- going down through the API: a lower number from a device is an old copy or a way around the usage limit.
-- The hospital admin, the Sterilization supervisor and the platform owner (asset.usage.configure) may now
-- correct the count both ways from the Set or instrument card, for a use counted by mistake; the app records
-- every correction as a movement. Everyone else is kept as before. Sterilizations still never go down.

create or replace function public.usage_never_decreases() returns trigger language plpgsql
  set search_path = public as $$
begin
  -- Only direct writes through the API (role authenticated); imports and restores run as other roles.
  if current_user = 'authenticated' then
    if old.uses is not null and (new.uses is null or new.uses < old.uses)
      and not public.role_has_permission('asset.usage.configure') then
      new.uses := old.uses;
    end if;
    -- Nested: only instruments have the column, and the expression is read when first reached.
    if tg_table_name = 'instruments' then
      if new.sterilizations < old.sterilizations then
        new.sterilizations := old.sterilizations;
      end if;
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.usage_never_decreases() from public, anon, authenticated;
