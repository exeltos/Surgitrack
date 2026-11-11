-- Two more modules the platform owner switches on for a hospital (see 20261027082127_hospital_modules.sql):
-- «Καταμέτρηση στο χειρουργείο» (SURGICAL_COUNT), the instrument count the operating theatre signs when it sends a Set or
-- instrument to Sterilization, and «Δοκιμές εξοπλισμού» (EQUIPMENT_TESTS), the daily and weekly tests of sterilizers
-- and washers that block loading when one fails. Not every hospital has them.
--
-- Every hospital that exists now keeps both (it already has them), and so does every Demo: the default holds all five.
-- A hospital the owner creates from the editor still starts with none, and picks.
alter table public.organizations
  drop constraint if exists organizations_modules_known;
alter table public.organizations
  alter column modules set default
    array['REPLACEMENTS', 'STOCK_MINIMUMS', 'DEVICES', 'SURGICAL_COUNT', 'EQUIPMENT_TESTS']::text[];
update public.organizations
  set modules = modules || array(
    select m from unnest(array['SURGICAL_COUNT', 'EQUIPMENT_TESTS']::text[]) m where not (m = any (modules)));
alter table public.organizations
  add constraint organizations_modules_known
  check (modules <@ array['REPLACEMENTS', 'STOCK_MINIMUMS', 'DEVICES', 'SURGICAL_COUNT', 'EQUIPMENT_TESTS']::text[]);
