-- The recycle bin also keeps problem reports deleted by the hospital admin (a duplicate or a mistake), so they can
-- be put back. (Applied to the live project as «recycle_bin_issue_kind».)
alter table public.recycle_bin drop constraint if exists recycle_bin_kind_check;
alter table public.recycle_bin add constraint recycle_bin_kind_check
  check (kind in ('SET','TOOL','LIBRARY','COLOR_TAPE','DEVICE','ISSUE'));
