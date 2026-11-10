-- A test device (a Bowie-Dick or leak tester, a spore incubator and reader) is a connected device like a sterilizer:
-- it sends its results with the same device key, file or cable. It says which sterilizer it tests, so its results
-- show among that sterilizer's tests.
alter table public.devices drop constraint if exists devices_kind_check;
alter table public.devices
  add constraint devices_kind_check check (kind in ('STERILIZER', 'WASHER', 'SEALER', 'TEST', 'OTHER'));
alter table public.devices
  add column if not exists tests_equipment text check (tests_equipment is null or length(btrim(tests_equipment)) between 1 and 200);
