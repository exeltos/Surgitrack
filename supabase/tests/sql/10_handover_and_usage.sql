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

-- dept_a confirmed to ster_a; nobody confirmed to sup_a.
select tests.service();
insert into public.handover_signatures (organization_id, signer_id, witness_id) values
  (tests.org('A'), tests.uid('dept_a'), tests.uid('ster_a'));
insert into public.handover_signatures (organization_id, signer_id, witness_id, signed_at) values
  (tests.org('A'), tests.uid('viewer_a'), tests.uid('ster_a'), now() - interval '25 hours');

select tests.login('ster_a');
select tests.throws($q$insert into public.handover_signatures (organization_id, signer_id, witness_id) values
  ((select organization_id from public.profiles limit 1), auth.uid(), auth.uid())$q$, '42501', 'nobody signed in records a signature');
select tests.eq(tests.count('select 1 from public.handover_signatures'), 0, 'a Sterilization user reads none');
insert into public.deliveries (organization_id, id, delivered_by_user_id, received_by_user_id, counterparty_verified) values
  (tests.org('A'), 'd-ok', tests.uid('ster_a')::text, tests.uid('dept_a')::text, false),
  (tests.org('A'), 'd-nosig', tests.uid('ster_a')::text, tests.uid('sup_a')::text, true),
  (tests.org('A'), 'd-old', tests.uid('ster_a')::text, tests.uid('viewer_a')::text, true),
  (tests.org('A'), 'd-notme', tests.uid('sup_a')::text, tests.uid('dept_a')::text, true);
insert into public.receipts (organization_id, id, delivered_by_user_id, received_by_user_id) values
  (tests.org('A'), 'r-ok', tests.uid('dept_a')::text, tests.uid('ster_a')::text);
reset role;
select tests.eq((select counterparty_verified from public.deliveries where id = 'd-ok'), true,
  'a delivery the other party confirmed is verified');
select tests.eq((select counterparty_verified from public.receipts where id = 'r-ok'), true, 'so is such a receipt');
select tests.eq((select counterparty_verified from public.deliveries where id = 'd-nosig'), false,
  'a party who never confirmed is not, whatever the device says');
select tests.eq((select counterparty_verified from public.deliveries where id = 'd-old'), false,
  'nor one who confirmed more than a day ago');
select tests.eq((select counterparty_verified from public.deliveries where id = 'd-notme'), false,
  'nor a record in which the signed-in user is not a party');

select tests.login('admin_a');
select tests.eq(tests.count('select 1 from public.handover_signatures'), 2, 'the hospital admin reads the signatures');
select tests.login('admin_b');
select tests.eq(tests.count('select 1 from public.handover_signatures'), 0, 'another hospital''s admin reads none');

rollback;
