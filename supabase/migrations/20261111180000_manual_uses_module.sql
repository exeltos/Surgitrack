-- One more module the platform owner switches on for a hospital (see 20261027082127_hospital_modules.sql):
-- «Χειροκίνητη καταγραφή χρήσεων» (MANUAL_USES), adding or correcting by hand the uses already made of an instrument
-- (also when creating it). Who may do it stays who may set the usage limit; the module lets the owner close it later.
--
-- Every hospital that exists keeps it (it already can), and so does every Demo: the default holds all six.
-- A hospital the owner creates from the editor still starts with none, and picks.
alter table public.organizations
  drop constraint if exists organizations_modules_known;
alter table public.organizations
  alter column modules set default
    array['REPLACEMENTS', 'STOCK_MINIMUMS', 'DEVICES', 'SURGICAL_COUNT', 'EQUIPMENT_TESTS', 'MANUAL_USES']::text[];
update public.organizations
  set modules = modules || array(
    select m from unnest(array['MANUAL_USES']::text[]) m where not (m = any (modules)));
alter table public.organizations
  add constraint organizations_modules_known
  check (modules <@ array['REPLACEMENTS', 'STOCK_MINIMUMS', 'DEVICES', 'SURGICAL_COUNT', 'EQUIPMENT_TESTS', 'MANUAL_USES']::text[]);
