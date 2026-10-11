-- One signature per handover: a receipt or delivery is verified only by the signature given for it.
--
-- verify-handover recorded who signed for whom, and every receipt or delivery between the two in the next
-- 24 hours counted as signed. Now the signature also records what was handed over (the Sets and instruments
-- on screen when the other party signed), the app keeps the signature's id on each record of that handover
-- (extra.handoverSignatureId), and a record is verified only when its signature:
--   - is for the two people of the record, was given to the signed-in user, less than 24 hours ago (a device
--     may sync late);
--   - covers the record's Set or instrument;
--   - has not already verified another receipt or delivery of that same item.
-- So one signature covers everything of one handover, once; the next handover needs its own. Records are still
-- never refused: an unverified one is marked as such. Records without a signature id (an app from before this
-- change) are not verified.

alter table public.handover_signatures add column if not exists asset_ids text[] not null default '{}';

create index if not exists receipts_handover_signature_idx
  on public.receipts ((extra->>'handoverSignatureId')) where extra ? 'handoverSignatureId';
create index if not exists deliveries_handover_signature_idx
  on public.deliveries ((extra->>'handoverSignatureId')) where extra ? 'handoverSignatureId';

create or replace function public.handover_counterparty_stamp() returns trigger language plpgsql
  security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  sig text := new.extra->>'handoverSignatureId';
begin
  -- Not a signed-in user (a restore, the service role): the stamp is kept as given.
  if me is null then
    return new;
  end if;
  if sig is null or sig !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    new.counterparty_verified := false;
    return new;
  end if;
  new.counterparty_verified := exists (
    select 1 from public.handover_signatures s
     where s.id = sig::uuid
       and s.organization_id = new.organization_id
       and s.witness_id = me
       and s.signed_at > now() - interval '24 hours'
       and new.asset_id = any (s.asset_ids)
       and ((new.delivered_by_user_id = me::text and s.signer_id::text = new.received_by_user_id)
         or (new.received_by_user_id = me::text and s.signer_id::text = new.delivered_by_user_id)))
    -- Used once per item: not already the signature of another receipt or delivery of it.
    and not exists (
      select 1 from public.receipts r
       where r.extra->>'handoverSignatureId' = sig and r.asset_id = new.asset_id
         and (tg_table_name <> 'receipts' or r.id <> new.id))
    and not exists (
      select 1 from public.deliveries d
       where d.extra->>'handoverSignatureId' = sig and d.asset_id = new.asset_id
         and (tg_table_name <> 'deliveries' or d.id <> new.id));
  return new;
end $$;
revoke execute on function public.handover_counterparty_stamp() from public, anon, authenticated;
