-- A username is two letters and four digits, and «DEMO» for the one account the owner gives it to: nobody else can
-- take it, and nothing else outside that shape is accepted.
begin;
\ir ../local/fixtures.sql

select tests.service();
select tests.eq(tests.rows($$update public.profiles set user_code = 'DEMO' where id = tests.uid('ster_a')$$), 1,
  'the owner gives «DEMO» to an account');
select tests.throws($$update public.profiles set user_code = 'DEMO' where id = tests.uid('dept_a')$$, '23505',
  '«DEMO» is held by one account only');
select tests.throws($$update public.profiles set user_code = 'demo' where id = tests.uid('dept_a')$$, '23505',
  'in capitals or not: it is the same name');
select tests.throws($$update public.profiles set user_code = 'DEMOS' where id = tests.uid('dept_a')$$, '23514',
  'a username of another shape is refused');
select tests.throws($$update public.profiles set user_code = 'ABC123' where id = tests.uid('dept_a')$$, '23514',
  '... three letters too');

-- Whoever signs in changes nobody's username, theirs included: the change is refused or does not reach the row.
select tests.login('admin_a');
do $$ begin
  begin update public.profiles set user_code = 'DEMO' where id = tests.uid('admin_a'); exception when others then null; end;
  begin update public.profiles set user_code = 'AB1234' where id = tests.uid('admin_a'); exception when others then null; end;
end $$;
select tests.login('dept_a');
do $$ begin
  begin update public.profiles set user_code = 'AB1234' where id = tests.uid('dept_a'); exception when others then null; end;
end $$;
select tests.service();
select tests.ok((select user_code from public.profiles where id = tests.uid('admin_a')) is distinct from 'DEMO'
  and (select user_code from public.profiles where id = tests.uid('admin_a')) is distinct from 'AB1234',
  'an administrator can neither take «DEMO» nor change their own username');
select tests.ok((select user_code from public.profiles where id = tests.uid('dept_a')) is distinct from 'AB1234',
  'nor can a department user');
select tests.eq((select count(*)::int from public.profiles where user_code = 'DEMO'), 1, '«DEMO» stays with the one account');

rollback;
