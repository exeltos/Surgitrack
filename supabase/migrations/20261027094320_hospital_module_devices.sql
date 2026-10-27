-- A third module the platform owner switches on for a hospital: «Συσκευές» (DEVICES), the connection of
-- sterilizers and washers and the cycles they send (see 20261027082127_hospital_modules.sql).
--
-- Every hospital that exists now keeps it (it already has the Devices screen), and so does every Demo: the new
-- default holds all three modules. A hospital the owner creates from the editor still starts with none.
alter table public.organizations
  drop constraint if exists organizations_modules_known;
alter table public.organizations
  alter column modules set default array['REPLACEMENTS', 'STOCK_MINIMUMS', 'DEVICES']::text[];
update public.organizations
  set modules = array_append(modules, 'DEVICES')
  where not ('DEVICES' = any (modules));
alter table public.organizations
  add constraint organizations_modules_known
  check (modules <@ array['REPLACEMENTS', 'STOCK_MINIMUMS', 'DEVICES']::text[]);
