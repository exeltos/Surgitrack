-- An instrument used several times in one operation (a clip applier): the department's dispatch records all the
-- uses it was told (never past the limit); any other limited instrument still takes one. Only who may set the
-- usage limit sets the flag.
begin;
\ir ../local/fixtures.sql

reset role;
insert into public.instruments (organization_id, id, barcode, name, department, mode, state, uses, max_uses, multi_use)
  values (tests.org('A'), 'tool-clip', 'T000970', 'Clip applier', 'Theatre', 'STANDALONE', 'IN_DEPARTMENT', 17, 100, true),
         (tests.org('A'), 'tool-one', 'T000971', 'Robotic grasper', 'Theatre', 'STANDALONE', 'IN_DEPARTMENT', 3, 10, null),
         (tests.org('A'), 'tool-end', 'T000972', 'Clip applier 2', 'Theatre', 'STANDALONE', 'IN_DEPARTMENT', 95, 100, true);

select tests.login('dept_a');
select tests.eq(tests.rows($$update public.instruments set state = 'PENDING_STERILIZATION', uses = 29
  where id = 'tool-clip'$$), 1, 'a department dispatches a clip applier with 12 clips used');
reset role;
select tests.eq((select state || '|' || uses from public.instruments where id = 'tool-clip'), 'PENDING_STERILIZATION|29',
  '... and all 12 uses are counted');

select tests.login('dept_a');
select tests.eq(tests.rows($$update public.instruments set state = 'PENDING_STERILIZATION', uses = 8
  where id = 'tool-one'$$), 1, 'an instrument of one use per operation is dispatched with 5 uses…');
reset role;
select tests.eq((select uses from public.instruments where id = 'tool-one'), 3, '… which are not saved');

select tests.login('dept_a');
select tests.eq(tests.rows($$update public.instruments set state = 'RETIRED', uses = 100, retired_at = 'now',
  retired_reason = 'Συμπλήρωση ορίου χρήσεων' where id = 'tool-end'$$), 1, 'the last 5 clips of a clip applier…');
reset role;
select tests.eq((select state || '|' || uses from public.instruments where id = 'tool-end'), 'RETIRED|100',
  '… use it up and take it out of use');

select tests.login('dept_a');
select tests.eq(tests.rows($$update public.instruments set multi_use = false where id = 'tool-clip'$$), 1,
  'the flag change is accepted…');
reset role;
select tests.ok((select multi_use from public.instruments where id = 'tool-clip'), '… but a department cannot turn it off');

select tests.login('ster_a');
select tests.eq(tests.rows($$update public.instruments set multi_use = false where id = 'tool-clip'$$), 1,
  'a Sterilization user''s flag change is accepted…');
reset role;
select tests.ok((select multi_use from public.instruments where id = 'tool-clip'), '… but not saved');

rollback;
