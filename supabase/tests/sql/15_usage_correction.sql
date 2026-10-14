-- Uses never go down through the API, except for who may set the usage limit (a correction).
begin;
\ir ../local/fixtures.sql

reset role;
insert into public.instruments (organization_id, id, barcode, name, department, mode, state, max_uses, uses)
  values (tests.org('A'), 'tool-lim', 'T000950', 'Limited scissors', 'Theatre', 'STANDALONE', 'IN_STORAGE', 10, 5);

select tests.login('ster_a');
select tests.eq(tests.rows($$update public.instruments set uses = 4 where id = 'tool-lim'$$), 1,
  'a Sterilization user''s lower count is accepted…');
reset role;
select tests.eq((select uses from public.instruments where id = 'tool-lim'), 5, '… but not saved');

select tests.login('sup_a');
select tests.eq(tests.rows($$update public.instruments set uses = 4 where id = 'tool-lim'$$), 1,
  'the Sterilization supervisor corrects the count down');
reset role;
select tests.eq((select uses from public.instruments where id = 'tool-lim'), 4, '... and it is saved');

select tests.login('admin_a');
select tests.eq(tests.rows($$update public.instruments set uses = 3, sterilizations = 0 where id = 'tool-lim'$$), 1,
  'the hospital admin corrects it too');
reset role;
select tests.eq((select uses from public.instruments where id = 'tool-lim'), 3, '... saved');

rollback;
