-- The configuration history is kept by the database: every new entry of the settings row's history
-- arrays is copied to configuration_audit, which nobody signed in can change or empty.
begin;
\ir ../local/fixtures.sql

-- The migration copied what the arrays held; the fixtures' row is newer, so its entry came with the insert.
select tests.eq((select count(*)::int from public.configuration_audit where organization_id = tests.org('A')), 1,
  'the existing entry of A is in the history');

select tests.login('admin_a');
select tests.eq(tests.rows($$update public.hospital_settings set
    configuration_audit = '[{"id":"cfg-2","entityType":"WORKFLOW","entityId":"p","action":"UPDATE","at":"2026-10-09T08:00:00Z","by":"Admin"},
                            {"id":"cfg-1","entityType":"LIBRARY","entityId":"x","action":"UPDATE","at":"2026-10-01T10:00:00Z","by":"Admin"}]',
    role_permission_audit = '[{"id":"rpa-1","role":"STERILIZATION","at":"2026-10-09T08:00:00Z","by":"Admin","permissions":[]}]',
    workflow_versions = '[{"id":"wf-2","version":2,"profileName":"p","effectiveFrom":"2026-10-09T08:00:00Z","changedBy":"Admin","snapshot":{}}]'
  where organization_id = tests.org('A')$$), 1, 'admin saves the settings with new history entries');
select tests.eq(tests.count('select * from public.configuration_audit'), 4, 'admin reads 4 entries');
select tests.eq(tests.count($$select * from public.configuration_audit where kind = 'role_permission' and entry_id = 'rpa-1'
  and recorded_by = tests.uid('admin_a')$$), 1, 'the role settings entry is recorded, by the admin');
select tests.eq(tests.count($$select * from public.configuration_audit where kind = 'workflow_version' and entry_id = 'wf-2'$$), 1,
  'the workflow version is recorded');

-- A device empties the arrays: the history stays.
select tests.eq(tests.rows($$update public.hospital_settings set configuration_audit = '[]', role_permission_audit = '[]',
  workflow_versions = '[]' where organization_id = tests.org('A')$$), 1, 'admin empties the history arrays');
select tests.eq(tests.count('select * from public.configuration_audit'), 4, '... and the 4 entries are still there');
-- Re-sending an entry adds nothing; an edited copy of an entry does not replace it.
select tests.eq(tests.rows($$update public.hospital_settings set
  configuration_audit = '[{"id":"cfg-2","entityType":"WORKFLOW","entityId":"forged","action":"DELETE","at":"2020-01-01","by":"Someone"}]'
  where organization_id = tests.org('A')$$), 1, 'admin sends a rewritten entry');
select tests.eq((select payload->>'entityId' from public.configuration_audit where entry_id = 'cfg-2'), 'p',
  '... the first version of the entry is kept');

-- Append-only for signed-in users.
select tests.throws('update public.configuration_audit set payload = ''{}''', '42501', 'admin changes no entry');
select tests.throws('delete from public.configuration_audit', '42501', 'admin deletes no entry');
select tests.throws('truncate public.configuration_audit', '42501', 'admin cannot empty the table');
select tests.eq(tests.rows($$insert into public.configuration_audit (organization_id, kind, entry_id, payload, recorded_by, recorded_at)
  values (tests.org('A'), 'configuration', 'manual-1', '{"note":"by hand"}', tests.uid('sup_a'), '2001-01-01')$$), 1,
  'admin adds an entry by hand');
select tests.eq((select (recorded_by = tests.uid('admin_a') and recorded_at > '2026-01-01')
  from public.configuration_audit where entry_id = 'manual-1'), true, '... stamped with the admin and the real time');
select tests.throws($$insert into public.configuration_audit (organization_id, kind, entry_id, payload)
  values (tests.org('B'), 'configuration', 'manual-2', '{}')$$, '42501', 'admin of A adds nothing to B''s history');

-- Who reads.
select tests.login('ster_a');
select tests.eq(tests.count('select * from public.configuration_audit'), 0, 'a Sterilization user reads no history');
select tests.login('admin_b');
select tests.eq(tests.count('select * from public.configuration_audit'), 0, 'B''s admin reads none of A''s history');
select tests.login('platform');
select tests.eq(tests.count('select * from public.configuration_audit where organization_id = tests.org(''A'')'), 5,
  'the platform owner reads A''s history');
select tests.anon();
select tests.throws('select * from public.configuration_audit', '42501', 'anon reads no history');
reset role;

-- A hospital that is deleted takes its history with it, and a deleted account leaves its entries.
delete from public.profiles where id = tests.uid('admin_a');
delete from auth.users where id = tests.uid('admin_a');
select tests.eq((select count(*)::int from public.configuration_audit where organization_id = tests.org('A') and recorded_by is null), 5,
  'a deleted account''s entries stay, without the account');

rollback;
