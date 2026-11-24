-- «Αντικαταστάσεις & Παραγγελίες» becomes two modules (see 20261027082127_hospital_modules.sql):
-- REPLACEMENTS, the instruments to withdraw or replace (and replacing them from Stock), and ORDERS, the purchase
-- orders to the supplier and receiving them into Stock. Each shows its own tab in Issues.
--
-- A hospital that had the old module keeps both: nothing it sees disappears; the platform owner can switch off
-- either. Every new hospital (and Demo) starts with all modules on, as before.
alter table public.organizations
  drop constraint if exists organizations_modules_known;
alter table public.organizations
  alter column modules set default
    array['REPLACEMENTS', 'ORDERS', 'STOCK_MINIMUMS', 'DEVICES', 'SURGICAL_COUNT', 'EQUIPMENT_TESTS', 'MANUAL_USES']::text[];
update public.organizations
  set modules = modules || array['ORDERS']::text[]
  where 'REPLACEMENTS' = any (modules) and not ('ORDERS' = any (modules));
alter table public.organizations
  add constraint organizations_modules_known
  check (modules <@ array['REPLACEMENTS', 'ORDERS', 'STOCK_MINIMUMS', 'DEVICES', 'SURGICAL_COUNT', 'EQUIPMENT_TESTS', 'MANUAL_USES']::text[]);
