-- Modules the platform owner switches on for a hospital.
--
-- «Αντικαταστάσεις & Παραγγελίες» (REPLACEMENTS) and «Ελάχιστα αποθέματα» (STOCK_MINIMUMS) are not for every
-- hospital: the platform owner opens them for the hospitals that want them, in Studio → Hospitals. The hospital's
-- users read which modules are on (their own hospital's row) to show or hide them; only the platform owner
-- changes the list (org_update is the platform admin's: 20260928101439_only_platform_admin_updates_organizations.sql).
--
-- Every hospital that exists now, and every Demo, keeps both modules on (the column's default), so nothing
-- disappears when this is applied. A hospital the owner creates from the editor starts with none, and picks.
alter table public.organizations
  add column if not exists modules text[] not null default array['REPLACEMENTS', 'STOCK_MINIMUMS']::text[];

alter table public.organizations
  drop constraint if exists organizations_modules_known;
alter table public.organizations
  add constraint organizations_modules_known check (modules <@ array['REPLACEMENTS', 'STOCK_MINIMUMS']::text[]);
