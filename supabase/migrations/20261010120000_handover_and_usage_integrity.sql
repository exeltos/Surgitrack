-- Two parts of the sterilization chain that were trusted from the device:
--
-- 1. Usage counts never go down. A Set's or instrument's uses (and an instrument's sterilizations) only
--    ever grow in the app; a lower number from a device is either an old copy (two devices, one behind)
--    or someone working around the usage limit. A direct write through the API keeps the higher number,
--    silently, like the supervisor guards (refusing would make the device retry for ever).
--
-- 2. A handover's other party is checked by the server. verify-handover records each confirmed signature
--    in handover_signatures (who signed, for whom, when). Every receipt and delivery is stamped with
--    counterparty_verified: true only when the signed-in user is one party and the other party confirmed
--    with their own password to that user in the last 24 hours (devices may sync late). The record is
--    never refused, so no history is lost; an unverified one is marked as such. Records from before this
--    change have no stamp (null).

-- 1 -----------------------------------------------------------------------------------------------
create or replace function public.usage_never_decreases() returns trigger language plpgsql
  set search_path = public as $$
begin
  -- Only direct writes through the API (role authenticated); imports and restores run as other roles.
  if current_user = 'authenticated' then
    if old.uses is not null and (new.uses is null or new.uses < old.uses) then
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

drop trigger if exists instrument_sets_usage_never_decreases on public.instrument_sets;
create trigger instrument_sets_usage_never_decreases before update on public.instrument_sets
  for each row execute function public.usage_never_decreases();
drop trigger if exists instruments_usage_never_decreases on public.instruments;
create trigger instruments_usage_never_decreases before update on public.instruments
  for each row execute function public.usage_never_decreases();

-- 2 -----------------------------------------------------------------------------------------------
create table if not exists public.handover_signatures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  signer_id uuid not null references auth.users(id) on delete cascade,
  witness_id uuid not null references auth.users(id) on delete cascade,
  signed_at timestamptz not null default now()
);
create index if not exists handover_signatures_witness_idx
  on public.handover_signatures (witness_id, signer_id, signed_at desc);
create index if not exists handover_signatures_org_idx on public.handover_signatures (organization_id, signed_at desc);
create index if not exists handover_signatures_signer_idx on public.handover_signatures (signer_id);
alter table public.handover_signatures enable row level security;

-- The hospital's admins and the platform owner read them; only verify-handover (service role) writes.
drop policy if exists handover_signatures_read on public.handover_signatures;
create policy handover_signatures_read on public.handover_signatures for select to authenticated
  using ((organization_id = (select public.current_org_id()) and (select public."current_role"()) = 'ADMIN')
    or (select public.is_platform_admin()));
revoke all on public.handover_signatures from public, anon, authenticated;
grant select on public.handover_signatures to authenticated;
grant all on public.handover_signatures to service_role;

alter table public.receipts add column if not exists counterparty_verified boolean;
alter table public.deliveries add column if not exists counterparty_verified boolean;

-- Reads handover_signatures, which the person writing the record may not read: owner's rights.
create or replace function public.handover_counterparty_stamp() returns trigger language plpgsql
  security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  -- Not a signed-in user (a restore, the service role): the stamp is kept as given.
  if me is null then
    return new;
  end if;
  new.counterparty_verified := exists (
    select 1 from public.handover_signatures s
     where s.organization_id = new.organization_id
       and s.witness_id = me
       and s.signed_at > now() - interval '24 hours'
       and ((new.delivered_by_user_id = me::text and s.signer_id::text = new.received_by_user_id)
         or (new.received_by_user_id = me::text and s.signer_id::text = new.delivered_by_user_id)));
  return new;
end $$;
revoke execute on function public.handover_counterparty_stamp() from public, anon, authenticated;

drop trigger if exists receipts_counterparty_stamp on public.receipts;
create trigger receipts_counterparty_stamp before insert on public.receipts
  for each row execute function public.handover_counterparty_stamp();
drop trigger if exists deliveries_counterparty_stamp on public.deliveries;
create trigger deliveries_counterparty_stamp before insert on public.deliveries
  for each row execute function public.handover_counterparty_stamp();
