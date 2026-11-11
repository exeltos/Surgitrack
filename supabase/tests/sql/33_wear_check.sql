-- An instrument "with a wear check" has no usage limit but its uses are counted: the department's dispatch adds one
-- (never more), only who may set the usage limit sets the flag or corrects the count.
begin;
\ir ../local/fixtures.sql

reset role;
insert into public.instruments (organization_id, id, barcode, name, department, mode, state, uses, wear_check)
  values (tests.org('A'), 'tool-wear', 'T000960', 'Wear scissors', 'Theatre', 'STANDALONE', 'IN_DEPARTMENT', 7, true);

select tests.login('dept_a');
select tests.eq(tests.rows($$update public.instruments set state = 'PENDING_STERILIZATION', uses = 8
  where id = 'tool-wear'$$), 1, 'a department dispatches a wear-check instrument');
reset role;
select tests.eq((select state || '|' || uses from public.instruments where id = 'tool-wear'), 'PENDING_STERILIZATION|8',
  '... and its use is counted');

select tests.login('dept_a');
select tests.eq(tests.rows($$update public.instruments set uses = 20 where id = 'tool-wear'$$), 1,
  'a jump of many uses is accepted…');
reset role;
select tests.eq((select uses from public.instruments where id = 'tool-wear'), 8, '… but not saved');

select tests.login('dept_a');
select tests.eq(tests.rows($$update public.instruments set wear_check = false where id = 'tool-wear'$$), 1, 'the flag change is accepted…');
reset role;
select tests.ok((select wear_check from public.instruments where id = 'tool-wear'), '… but a department cannot turn it off');

select tests.login('ster_a');
select tests.eq(tests.rows($$update public.instruments set wear_check = false where id = 'tool-wear'$$), 1, 'a Sterilization user''s flag change is accepted…');
reset role;
select tests.ok((select wear_check from public.instruments where id = 'tool-wear'), '… but not saved');

select tests.login('admin_a');
select tests.eq(tests.rows($$update public.instruments set uses = 30 where id = 'tool-wear'$$), 1,
  'the hospital admin adds the uses already made');
reset role;
select tests.eq((select uses from public.instruments where id = 'tool-wear'), 30, '... saved, with no upper limit');

rollback;
