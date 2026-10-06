-- The recycle bin also keeps Studio library records, colour tapes and connected devices.
-- (Applied to the live project as «recycle_bin_more_kinds».)
alter table public.recycle_bin drop constraint if exists recycle_bin_kind_check;
alter table public.recycle_bin add constraint recycle_bin_kind_check
  check (kind in ('SET','TOOL','LIBRARY','COLOR_TAPE','DEVICE'));
