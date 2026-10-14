-- Handovers in the platform's Demo hospital count as signed when one of its sample people signed.
--
-- handover_counterparty_stamp (20261011190000_handover_signature_per_handover.sql) confirms the other party of a
-- receipt or delivery only from a server signature (verify-handover). In the platform's Demo the sample people
-- (user ids «demo-…», codes such as ST1001) sign in the app instead, so every Demo handover read «unconfirmed».
-- In a Demo hospital that is not a prospect's evaluation, such a record now keeps the stamp the app gave it.
-- Real hospitals and evaluation Demos are checked exactly as before.

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
  -- The platform's own Demo hospital: its sample people (ids «demo-…») sign in the app, which checks their code;
  -- there is no server signature to look up, so the device's stamp is kept. Evaluation Demos sign as real hospitals.
  if sig is null and (new.delivered_by_user_id like 'demo-%' or new.received_by_user_id like 'demo-%')
    and exists (select 1 from public.organizations o
                 where o.id = new.organization_id and o.is_demo and not coalesce(o.evaluation, false)) then
    new.counterparty_verified := coalesce(new.counterparty_verified, false);
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
