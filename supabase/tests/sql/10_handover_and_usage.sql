-- Usage counts never go down through the API; receipts and deliveries are stamped with whether the other
-- party confirmed to the signed-in user (verify-handover's handover_signatures), never refused.
begin;
\ir ../local/fixtures.sql

update public.instrument_sets set uses = 3 where id = 'set-a1';
update public.instruments set uses = 2, sterilizations = 5 where id = 'tool-a1';

select tests.login('ster_a');
select tests.rows($q$update public.instrument_sets set uses = 1 where id = 'set-a1'$q$);
select tests.eq((select uses from public.instrument_sets where id = 'set-a1'), 3, 'a Set''s uses do not go down');
select tests.rows($q$update public.instrument_sets set uses = 4 where id = 'set-a1'$q$);
select tests.eq((select uses from public.instrument_sets where id = 'set-a1'), 4, 'they go up');
select tests.rows($q$update public.instruments set uses = 0, sterilizations = 1 where id = 'tool-a1'$q$);
select tests.eq((select uses from public.instruments where id = 'tool-a1'), 2, 'an instrument''s uses do not go down');
select tests.eq((select sterilizations from public.instruments where id = 'tool-a1'), 5, 'nor its sterilizations');
select tests.login('admin_a');
select tests.rows($q$update public.instruments set uses = 0 where id = 'tool-a1'$q$);
select tests.eq((select uses from public.instruments where id = 'tool-a1'), 2, 'not even for a hospital admin');
reset role;
update public.instruments set uses = 0 where id = 'tool-a1';
select tests.eq((select uses from public.instruments where id = 'tool-a1'), 0, 'a restore or the service role still sets them');

-- dept_a signed to ster_a for set-a1 and tool-a1 (one handover); viewer_a signed too long ago.
select tests.service();
insert into public.handover_signatures (id, organization_id, signer_id, witness_id, asset_ids) values
  ('00000000-0000-4000-8000-0000000000a1', tests.org('A'), tests.uid('dept_a'), tests.uid('ster_a'), '{set-a1,tool-a1}');
insert into public.handover_signatures (id, organization_id, signer_id, witness_id, signed_at, asset_ids) values
  ('00000000-0000-4000-8000-0000000000a2', tests.org('A'), tests.uid('viewer_a'), tests.uid('ster_a'),
   now() - interval '25 hours', '{set-a2}');

select tests.login('ster_a');
select tests.throws($q$insert into public.handover_signatures (organization_id, signer_id, witness_id) values
  ((select organization_id from public.profiles limit 1), auth.uid(), auth.uid())$q$, '42501', 'nobody signed in records a signature');
select tests.eq(tests.count('select 1 from public.handover_signatures'), 0, 'a Sterilization user reads none');
-- One handover: the receipt of set-a1 and the delivery of tool-a1, both citing the signature.
insert into public.receipts (organization_id, id, asset_id, delivered_by_user_id, received_by_user_id, extra) values
  (tests.org('A'), 'r-ok', 'set-a1', tests.uid('dept_a')::text, tests.uid('ster_a')::text,
   '{"handoverSignatureId":"00000000-0000-4000-8000-0000000000a1"}');
insert into public.deliveries (organization_id, id, asset_id, delivered_by_user_id, received_by_user_id, counterparty_verified, extra) values
  (tests.org('A'), 'd-ok', 'tool-a1', tests.uid('ster_a')::text, tests.uid('dept_a')::text, false,
   '{"handoverSignatureId":"00000000-0000-4000-8000-0000000000a1"}'),
  (tests.org('A'), 'd-nosig', 'set-a2', tests.uid('ster_a')::text, tests.uid('dept_a')::text, true, null),
  (tests.org('A'), 'd-other', 'set-a2', tests.uid('ster_a')::text, tests.uid('dept_a')::text, true,
   '{"handoverSignatureId":"00000000-0000-4000-8000-0000000000a1"}'),
  (tests.org('A'), 'd-again', 'set-a1', tests.uid('ster_a')::text, tests.uid('dept_a')::text, true,
   '{"handoverSignatureId":"00000000-0000-4000-8000-0000000000a1"}'),
  (tests.org('A'), 'd-old', 'set-a2', tests.uid('ster_a')::text, tests.uid('viewer_a')::text, true,
   '{"handoverSignatureId":"00000000-0000-4000-8000-0000000000a2"}'),
  (tests.org('A'), 'd-notme', 'set-a1', tests.uid('sup_a')::text, tests.uid('dept_a')::text, true,
   '{"handoverSignatureId":"00000000-0000-4000-8000-0000000000a1"}'),
  (tests.org('A'), 'd-wrong', 'set-a1', tests.uid('ster_a')::text, tests.uid('sup_a')::text, true,
   '{"handoverSignatureId":"00000000-0000-4000-8000-0000000000a1"}');
-- The same record sent again by a device (a batch sync) keeps its stamp.
insert into public.receipts (organization_id, id, asset_id, delivered_by_user_id, received_by_user_id, extra) values
  (tests.org('A'), 'r-ok', 'set-a1', tests.uid('dept_a')::text, tests.uid('ster_a')::text,
   '{"handoverSignatureId":"00000000-0000-4000-8000-0000000000a1"}')
  on conflict (organization_id, id) do nothing;
reset role;
select tests.eq((select counterparty_verified from public.receipts where id = 'r-ok'), true,
  'a receipt the other party signed for is verified, and stays so when sent again');
select tests.eq((select counterparty_verified from public.deliveries where id = 'd-ok'), true,
  'so is the other item of the same handover');
select tests.eq((select counterparty_verified from public.deliveries where id = 'd-nosig'), false,
  'a record citing no signature is not, whatever the device says');
select tests.eq((select counterparty_verified from public.deliveries where id = 'd-other'), false,
  'nor one for an item the signature does not cover');
select tests.eq((select counterparty_verified from public.deliveries where id = 'd-again'), false,
  'nor a second handover of an item with the same signature');
select tests.eq((select counterparty_verified from public.deliveries where id = 'd-old'), false,
  'nor one signed more than a day ago');
select tests.eq((select counterparty_verified from public.deliveries where id = 'd-notme'), false,
  'nor a record in which the signed-in user is not a party');
select tests.eq((select counterparty_verified from public.deliveries where id = 'd-wrong'), false,
  'nor a record whose other party is not the signer');

select tests.login('admin_a');
select tests.eq(tests.count('select 1 from public.handover_signatures'), 2, 'the hospital admin reads the signatures');
select tests.login('admin_b');
select tests.eq(tests.count('select 1 from public.handover_signatures'), 0, 'another hospital''s admin reads none');

rollback;
