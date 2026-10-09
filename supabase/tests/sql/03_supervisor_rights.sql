-- The Sterilization supervisor's rights are enforced by the database: a Sterilization user (not
-- supervisor) does the ordinary work but registers, deletes, re-barcodes, edits and recomposes
-- nothing; the supervisor, the hospital admin, the platform owner and the service role do.
-- The Studio role settings are honoured for stock.manage and asset.photos.manage.
begin;
\ir ../local/fixtures.sql

-- What the app computes (src/core/permissions.ts).
select tests.login('ster_a');
select tests.ok(not public.role_has_permission('asset.create') and not public.role_has_permission('asset.delete')
  and not public.role_has_permission('asset.barcode.reissue') and not public.role_has_permission('asset.composition.manage'),
  'Sterilization user: no supervisor-only permission');
select tests.ok(public.role_has_permission('stock.manage') and public.role_has_permission('asset.photos.manage')
  and public.role_has_permission('sterilization.cycle') and not public.role_has_permission('studio.manage'),
  'Sterilization user: the role''s defaults');
select tests.ok(not public.is_asset_manager(), 'Sterilization user is not an asset manager');
select tests.login('sup_a');
select tests.ok(public.role_has_permission('asset.create') and public.role_has_permission('asset.composition.manage')
  and public.is_asset_manager(), 'supervisor: supervisor-only permissions');
select tests.login('admin_a');
select tests.ok(public.role_has_permission('studio.manage') and public.is_asset_manager(), 'admin: everything');
select tests.login('dept_a');
select tests.ok(public.role_has_permission('department.dispatch') and not public.role_has_permission('stock.manage'),
  'department user: own permissions only');
select tests.login('viewer_a');
select tests.ok(not public.role_has_permission('issue.create') and public.role_has_permission('history.view'),
  'viewer: read permissions only');

-- Sterilization user: registering.
select tests.login('ster_a');
select tests.throws($$insert into public.instrument_sets (organization_id, id, barcode, name, state)
  values (tests.org('A'), 'set-n', 'S000100', 'New', 'IN_DEPARTMENT')$$, '42501', 'Sterilization user registers no Set');
select tests.throws($$insert into public.instruments (organization_id, id, barcode, name, department, mode, state)
  values (tests.org('A'), 'tool-n', 'T000100', 'New', 'Theatre', 'STANDALONE', 'IN_DEPARTMENT')$$, '42501',
  'Sterilization user registers no instrument in use');
select tests.eq(tests.rows($$insert into public.instruments (organization_id, id, barcode, name, mode, state)
  values (tests.org('A'), 'tool-po', 'T000101', 'From order', 'STOCK', 'IN_STOCK')$$), 1,
  'Sterilization user with stock.manage receives a Stock instrument (purchase order)');
-- The app's batch upsert of existing rows still works (it is checked as an insert first).
select tests.eq(tests.rows($$insert into public.instrument_sets (organization_id, id, barcode, name, state)
  values (tests.org('A'), 'set-a1', 'S000001', 'Laparoscopy', 'PENDING_STERILIZATION')
  on conflict (organization_id, id) do update set state = excluded.state$$), 1,
  'Sterilization user: upsert of an existing Set saves the change');
select tests.eq((select state from public.instrument_sets where id = 'set-a1' and organization_id = tests.org('A')),
  'PENDING_STERILIZATION', 'the state change went through');

-- Sterilization user: changing.
select tests.eq(tests.rows($$update public.instrument_sets set state = 'IN_WASHING', actual = 1, barcode = 'S777777',
  name = 'Renamed', composition_template = '[]', expected = 9, max_uses = 3
  where organization_id = tests.org('A') and id = 'set-a1'$$), 1, 'Sterilization user saves a Set');
select tests.eq((select row(state, barcode, name, composition_template::text, expected, max_uses)::text
  from public.instrument_sets where id = 'set-a1' and organization_id = tests.org('A')),
  row('IN_WASHING', 'S000001', 'Laparoscopy', '[{"code": "T1", "quantity": 1}]', 1, null::int)::text,
  'workflow state changes; barcode, name, composition, expected and usage limit keep their values');
select tests.eq(tests.rows($$update public.instruments set barcode = 'T888888', legacy_barcodes = array['T000001'],
  name = 'Other', serial_number = 'SN', max_uses = 5, color_tapes = array['red']
  where organization_id = tests.org('A') and id = 'tool-a1'$$), 1, 'Sterilization user saves an instrument');
select tests.eq((select row(barcode, legacy_barcodes, name, serial_number, max_uses, color_tapes)::text
  from public.instruments where id = 'tool-a1' and organization_id = tests.org('A')),
  row('T000001', null::text[], 'Scissors', null::text, null::int, null::text[])::text,
  'barcode, name, serial, usage limit and colour keep their values');
select tests.eq(tests.rows($$update public.instruments set mode = 'STOCK', set_id = null, state = 'IN_STOCK', department = null
  where organization_id = tests.org('A') and id = 'tool-a1'$$), 1, 'Sterilization user moves an instrument out of its Set');
select tests.eq((select row(mode, set_id, state, department)::text
  from public.instruments where id = 'tool-a1' and organization_id = tests.org('A')),
  row('SET_MEMBER', 'set-a1', 'IN_DEPARTMENT', 'Theatre')::text, '... and it stays in its Set');
select tests.eq(tests.rows($$update public.instruments set mode = 'SET_MEMBER', set_id = 'set-a2', state = 'IN_DEPARTMENT',
  department = 'Theatre' where organization_id = tests.org('A') and id = 'tool-a2'$$), 1,
  'Sterilization user replaces from Stock (stock.manage)');
select tests.eq((select set_id from public.instruments where id = 'tool-a2' and organization_id = tests.org('A')),
  'set-a2', '... the Stock instrument joined the Set');
select tests.eq(tests.rows($$update public.instruments set mode = 'STOCK', state = 'IN_STOCK', department = null
  where organization_id = tests.org('A') and id = 'tool-a3'$$), 1, 'Sterilization user returns one from Service');
select tests.eq((select mode from public.instruments where id = 'tool-a3' and organization_id = tests.org('A')),
  'STOCK', '... it is back in Stock');
select tests.eq(tests.rows($$update public.instruments set photos = '[{"id":"p1"}]'
  where organization_id = tests.org('A') and id = 'tool-a1'$$), 1, 'Sterilization user adds a photo');
select tests.eq((select photos::text from public.instruments where id = 'tool-a1' and organization_id = tests.org('A')),
  '[{"id": "p1"}]', '... it is kept (asset.photos.manage by default)');
select tests.eq(tests.rows('delete from public.instruments where organization_id = tests.org(''A'')'), 0,
  'Sterilization user deletes no instrument');
select tests.eq(tests.rows('delete from public.instrument_sets where organization_id = tests.org(''A'')'), 0,
  'Sterilization user deletes no Set');

-- The hospital takes stock.manage and asset.photos.manage away from Sterilization in Studio.
reset role;
update public.hospital_settings set role_permissions = jsonb_build_object('STERILIZATION',
  jsonb_build_array('asset.registry.view', 'asset.detail.view', 'sterilization.workspace', 'sterilization.receive',
    'sterilization.cycle', 'sterilization.deliver', 'history.view', 'traceability.view'))
 where organization_id = tests.org('A');
select tests.login('ster_a');
select tests.ok(not public.role_has_permission('stock.manage') and public.role_has_permission('sterilization.cycle'),
  'Studio settings: stock.manage removed, protected ones kept');
select tests.throws($$insert into public.instruments (organization_id, id, barcode, name, mode, state)
  values (tests.org('A'), 'tool-po2', 'T000102', 'From order', 'STOCK', 'IN_STOCK')$$, '42501',
  'without stock.manage no Stock instrument is added');
select tests.eq(tests.rows($$update public.instruments set photos = '[]'
  where organization_id = tests.org('A') and id = 'tool-a1'$$), 1, 'without asset.photos.manage a photo change is sent');
select tests.eq((select photos::text from public.instruments where id = 'tool-a1' and organization_id = tests.org('A')),
  '[{"id": "p1"}]', '... and the photos keep their value');
select tests.login('sup_a');
select tests.ok(public.role_has_permission('asset.create') and not public.role_has_permission('stock.manage'),
  'supervisor: supervisor-only rights do not follow the Studio settings; stock.manage does');

-- Supervisor: everything on Sets and instruments.
select tests.eq(tests.rows($$insert into public.instrument_sets (organization_id, id, barcode, name, state)
  values (tests.org('A'), 'set-s', 'S000200', 'By supervisor', 'IN_DEPARTMENT')$$), 1, 'supervisor registers a Set');
select tests.eq(tests.rows($$insert into public.instruments (organization_id, id, barcode, name, department, mode, state)
  values (tests.org('A'), 'tool-s', 'T000200', 'By supervisor', 'Theatre', 'STANDALONE', 'IN_DEPARTMENT')$$), 1,
  'supervisor registers an instrument');
select tests.eq(tests.rows($$update public.instruments set barcode = 'T000201', legacy_barcodes = array['T000200'],
  mode = 'SET_MEMBER', set_id = 'set-s' where organization_id = tests.org('A') and id = 'tool-s'$$), 1,
  'supervisor reissues a barcode and recomposes');
select tests.eq((select barcode || ' ' || set_id from public.instruments where id = 'tool-s' and organization_id = tests.org('A')),
  'T000201 set-s', '... both changes kept');
select tests.eq(tests.rows($$update public.instrument_sets set composition_template = '[]', expected = 2, name = 'Renamed'
  where organization_id = tests.org('A') and id = 'set-s'$$), 1, 'supervisor edits a Set');
select tests.eq((select name from public.instrument_sets where id = 'set-s' and organization_id = tests.org('A')),
  'Renamed', '... kept');
select tests.eq(tests.rows('delete from public.instruments where organization_id = tests.org(''A'') and id = ''tool-s'''), 1,
  'supervisor deletes an instrument');

-- Hospital admin, platform owner, service role.
select tests.login('admin_a');
select tests.eq(tests.rows($$update public.instruments set name = 'By admin', max_uses = 10
  where organization_id = tests.org('A') and id = 'tool-a1'$$), 1, 'admin edits an instrument');
select tests.eq((select name from public.instruments where id = 'tool-a1' and organization_id = tests.org('A')),
  'By admin', '... kept');
select tests.eq(tests.rows('delete from public.instrument_sets where organization_id = tests.org(''A'') and id = ''set-s'''), 1,
  'admin deletes a Set');
select tests.login('platform');
select tests.eq(tests.rows($$insert into public.instrument_sets (organization_id, id, barcode, name, state)
  values (tests.org('B'), 'set-p', 'S000300', 'By owner', 'IN_DEPARTMENT')$$), 1, 'platform owner registers a Set anywhere');
select tests.service();
select tests.eq(tests.rows($$update public.instruments set barcode = 'T000999'
  where organization_id = tests.org('B') and id = 'tool-b1'$$), 1, 'service role changes a barcode');
select tests.eq((select barcode from public.instruments where id = 'tool-b1' and organization_id = tests.org('B')),
  'T000999', '... kept');

-- A Sterilization user of B is bound the same way, and A's settings do not apply to B.
select tests.login('ster_b');
select tests.ok(public.role_has_permission('stock.manage'), 'B''s Sterilization user keeps the defaults of B');
select tests.eq(tests.rows($$update public.instruments set name = 'x' where organization_id = tests.org('B')$$), 1,
  'B''s Sterilization user saves an instrument');
select tests.eq((select name from public.instruments where id = 'tool-b1' and organization_id = tests.org('B')),
  'Scissors B', '... its name keeps its value');
reset role;

rollback;
