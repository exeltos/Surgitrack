-- supabase/integrity.sql (the nightly integrity checks) finds nothing in sound data and names each kind of
-- problem when there is one.
begin;
\ir ../local/fixtures.sql
\set checks `sed 's/;[[:space:]]*$//' "$SURGITRACK_REPO/supabase/integrity.sql"`

-- A view runs the checks afresh each time it is read.
create temp view found as :checks;

select tests.eq((select count(*)::int from found), 0, 'sound data: no problem found');

-- Break the data in each way the checks look for.
update public.instruments set set_id = 'set-gone' where id = 'tool-a1';
update public.instruments set mode = 'SET_MEMBER' where id = 'tool-a2';
update public.instruments set set_id = 'set-a2' where id = 'tool-a3';

select tests.eq((select string_agg(check_name, ', ' order by check_name) from found where hospital = 'Hospital A'),
  'Set count differs from its instruments, Set member without a Set, '
  'Set on an instrument that is not a Set member, instrument in a Set that does not exist',
  'each problem is named');
select tests.eq((select count(*)::int from found where hospital = 'Hospital B'), 0,
  'another hospital is not blamed');

rollback;
