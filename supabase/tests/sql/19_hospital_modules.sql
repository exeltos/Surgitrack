-- The modules of a hospital: all six on by default, read by its users, changed only by the platform owner.
begin;
\ir ../local/fixtures.sql

select tests.login('platform');
select tests.eq(
  (select modules from public.organizations where id = tests.org('A')),
  array['REPLACEMENTS', 'STOCK_MINIMUMS', 'DEVICES', 'SURGICAL_COUNT', 'EQUIPMENT_TESTS', 'MANUAL_USES']::text[], 'a hospital starts with every module on (nothing disappears)');
select tests.eq(tests.rows($q$update public.organizations set modules = '{}' where id = tests.org('A')$q$), 1,
  'the platform owner switches the modules off for a hospital');
select tests.eq(tests.rows($q$update public.organizations set modules = array['STOCK_MINIMUMS'] where id = tests.org('A')$q$),
  1, '... or on one by one');
select tests.eq(tests.rows($q$update public.organizations set modules = array['DEVICES'] where id = tests.org('A')$q$), 1,
  'Devices is a module like the others');
select tests.eq(tests.rows($q$update public.organizations set modules = array['SURGICAL_COUNT', 'EQUIPMENT_TESTS'] where id = tests.org('A')$q$),
  1, 'the count and the equipment tests are modules too');
select tests.eq(tests.rows($q$update public.organizations set modules = array['MANUAL_USES'] where id = tests.org('A')$q$),
  1, 'and so are the manual use records');
select tests.eq(tests.rows($q$update public.organizations set modules = array['STOCK_MINIMUMS'] where id = tests.org('A')$q$),
  1, '... and off again');
select tests.throws($q$update public.organizations set modules = array['SOMETHING'] where id = tests.org('A')$q$, '23514',
  'a module that does not exist is refused');

select tests.login('admin_a');
select tests.eq((select modules from public.organizations where id = tests.org('A')), array['STOCK_MINIMUMS']::text[],
  'the hospital admin reads which modules are on');
select tests.eq(tests.rows($q$update public.organizations set modules = array['REPLACEMENTS', 'STOCK_MINIMUMS'] where id = tests.org('A')$q$),
  0, 'but changes none: it is the platform owner''s');
select tests.login('dept_a');
select tests.eq(tests.rows($q$update public.organizations set modules = '{}' where id = tests.org('A')$q$), 0,
  'a department user changes none either');
reset role;
select tests.eq((select modules from public.organizations where id = tests.org('A')), array['STOCK_MINIMUMS']::text[],
  'the list is as the platform owner left it');

rollback;
