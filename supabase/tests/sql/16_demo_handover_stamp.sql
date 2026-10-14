-- In the platform's Demo hospital a handover signed by a sample person keeps the app's stamp; elsewhere it does not.
begin;
\ir ../local/fixtures.sql

reset role;
update public.organizations set is_demo = true where id = tests.org('B');

select tests.login('ster_b');
insert into public.receipts (organization_id, id, asset_id, delivered_by_user_id, received_by_user_id, counterparty_verified)
  values (tests.org('B'), 'r-demo', 'set-b1', 'demo-or1001', tests.uid('ster_b')::text, true);
select tests.login('ster_a');
insert into public.receipts (organization_id, id, asset_id, delivered_by_user_id, received_by_user_id, counterparty_verified)
  values (tests.org('A'), 'r-real', 'set-a1', 'demo-or1001', tests.uid('ster_a')::text, true);
reset role;
select tests.eq((select counterparty_verified from public.receipts where id = 'r-demo'), true,
  'in the Demo hospital, a sample person''s signature counts as confirmed');
select tests.eq((select counterparty_verified from public.receipts where id = 'r-real'), false,
  'in a real hospital the same record is not, without a server signature');

update public.organizations set evaluation = true where id = tests.org('B');
select tests.login('ster_b');
insert into public.receipts (organization_id, id, asset_id, delivered_by_user_id, received_by_user_id, counterparty_verified)
  values (tests.org('B'), 'r-eval', 'set-b1', 'demo-or1001', tests.uid('ster_b')::text, true);
reset role;
select tests.eq((select counterparty_verified from public.receipts where id = 'r-eval'), false,
  'nor in an evaluation Demo, where real accounts sign');

rollback;
