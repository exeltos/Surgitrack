// @vitest-environment node
import {beforeEach, describe, expect, it} from 'vitest';
import {eqValue, loadFunction, post, resetFake} from './harness';
import {fake, type DbCall} from './fakes/supabase';
import {phonePassword, placeholderEmail} from '../_shared/staffImport';

type Handler = (req: Request) => Response | Promise<Response>;
type Row = Record<string, unknown> | null;

const OWNER = {id: 'owner-1', role: 'ADMIN', active: true, organization_id: null};
const HOSPITAL_ADMIN = {id: 'admin-1', role: 'ADMIN', active: true, organization_id: 'org-1'};
const DEPARTMENTS = [{id: 'dept-1'}, {id: 'dept-2'}];

type World = {caller?: Row; org?: Row; sameName?: Row[]; sameEmail?: Row[]};
const world = (w: World = {}) => {
  fake.db = (call: DbCall) => {
    if (call.table === 'profiles' && call.op === 'select') {
      if (eqValue(call, 'id')) return {data: 'caller' in w ? w.caller : OWNER, error: null};
      return call.filters.some(([, column]) => column === 'name') ? {data: w.sameName ?? [], error: null} : {data: w.sameEmail ?? [], error: null};
    }
    if (call.table === 'organizations') return {data: 'org' in w ? w.org : {id: 'org-1', active: true, is_demo: false}, error: null};
    if (call.table === 'departments') return {data: DEPARTMENTS, error: null};
    return {data: null, error: null};
  };
  let n = 0;
  fake.rpc = () => ({data: `AB${String(1000 + n++)}`, error: null});
};
const person = (extra: Record<string, unknown> = {}) => ({full_name: 'Μαρία Παπαδοπούλου', department_id: 'dept-1', phone: '6912345678', ...extra});
const importing = (rows: unknown[], extra: Record<string, unknown> = {}) =>
  handle(post({organization_id: 'org-1', rows, ...extra}));
const answer = async (response: Response) => (await response.json()) as {results: Array<Record<string, unknown>>; deadline?: string; error?: string};
const profileInserts = () => fake.dbCalls('insert').filter(c => c.table === 'profiles').map(c => c.values as Record<string, unknown>);

let handle: Handler;
beforeEach(async () => {
  resetFake();
  fake.user = {id: 'owner-1'};
  world();
  handle = await loadFunction('import-staff');
});

describe('import-staff: who may import', () => {
  it('refuses a caller who is not signed in', async () => {
    fake.user = null;
    expect((await importing([person()])).status).toBe(401);
  });

  it.each([
    ['a hospital admin', HOSPITAL_ADMIN],
    ['a department user', {id: 'u', role: 'DEPARTMENT', active: true, organization_id: 'org-1'}],
    ['an inactive owner', {...OWNER, active: false}],
    ['someone with no profile', null],
  ])('refuses %s, creating nothing', async (_who, caller) => {
    world({caller});
    const response = await importing([person()]);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({error: 'owner_only'});
    expect(fake.calls.some(c => c.what === 'createUser')).toBe(false);
    expect(fake.dbCalls().filter(c => c.op !== 'select')).toHaveLength(0);
  });

  it('refuses a hospital that is not active, or is a Demo', async () => {
    world({org: {id: 'org-1', active: false, is_demo: false}});
    expect((await importing([person()])).status).toBe(400);
    world({org: {id: 'org-1', active: true, is_demo: true}});
    expect((await importing([person()])).status).toBe(400);
    expect(fake.calls.some(c => c.what === 'createUser')).toBe(false);
  });

  it('answers 400 with no hospital or no rows, and 413 above 50 people', async () => {
    expect((await handle(post({rows: [person()]}))).status).toBe(400);
    expect((await importing([])).status).toBe(400);
    const tooMany = await importing(Array.from({length: 51}, () => person()));
    expect(tooMany.status).toBe(413);
    expect(await tooMany.json()).toEqual({error: 'too_many_rows', max: 50});
  });
});

describe('import-staff: making the people', () => {
  it('makes an active account with the mobile number as password, to be changed at the first sign-in', async () => {
    const response = await importing([person()]);
    const body = await answer(response);
    expect(body.results).toEqual([{index: 0, ok: true, user_code: 'AB1000'}]);
    const created = fake.calls.find(c => c.what === 'createUser')?.args[0] as Record<string, unknown>;
    expect(created).toMatchObject({password: '6912345678', email_confirm: true, email: 'ab1000@staff.surgitrack.invalid'});
    expect(profileInserts()[0]).toMatchObject({
      id: 'new-user',
      organization_id: 'org-1',
      department_id: 'dept-1',
      name: 'ΜΑΡΙΑ ΠΑΠΑΔΟΠΟΥΛΟΥ',
      role: 'DEPARTMENT',
      user_code: 'AB1000',
      active: true,
      supervisor: false,
      demo_enabled: false,
      password_change_required: true,
    });
  });

  it('gives the deadline asked for, a week by default, between 1 and 30 days', async () => {
    const days = (iso: string) => Math.round((Date.parse(iso) - Date.now()) / 864e5);
    expect(days((await answer(await importing([person()]))).deadline!)).toBe(7);
    expect(days((await answer(await importing([person()], {deadline_days: 3}))).deadline!)).toBe(3);
    expect(days((await answer(await importing([person()], {deadline_days: 400}))).deadline!)).toBe(30);
    expect(days((await answer(await importing([person()], {deadline_days: 0}))).deadline!)).toBe(7);
    expect(new Date(profileInserts()[0].password_change_deadline as string).getTime()).toBeGreaterThan(Date.now());
  });

  it('never returns or keeps the number: not in the answer, not in the profile, not in the record', async () => {
    const response = await importing([person()]);
    const text = JSON.stringify(await response.json());
    expect(text).not.toContain('6912345678');
    expect(JSON.stringify(profileInserts())).not.toContain('6912345678');
    expect(JSON.stringify(fake.dbCalls('insert').filter(c => c.table === 'account_events'))).not.toContain('6912345678');
  });

  it("uses the person's own email when the list has one, else one that can never receive mail", async () => {
    await importing([person({email: ' Maria@Hospital.GR '}), person({full_name: 'Γιώργος Νικολάου'})]);
    const emails = fake.calls.filter(c => c.what === 'createUser').map(c => (c.args[0] as {email: string}).email);
    expect(emails).toEqual(['maria@hospital.gr', 'ab1001@staff.surgitrack.invalid']);
    expect(placeholderEmail('AB1001')).toMatch(/\.invalid$/);
  });

  it('records each import before making the account, and makes nothing when it cannot be recorded', async () => {
    const db = fake.db;
    fake.db = call => (call.table === 'account_events' ? {data: null, error: {message: 'down'}} : db(call));
    const body = await answer(await importing([person()]));
    expect(body.results).toEqual([{index: 0, ok: false, error: 'audit_failed'}]);
    expect(profileInserts()).toHaveLength(0);
    expect(fake.calls.filter(c => c.what === 'deleteUser').map(c => c.args[0])).toEqual(['new-user']);
  });

  it('removes the sign-in again when the profile cannot be made', async () => {
    const db = fake.db;
    fake.db = call => (call.table === 'profiles' && call.op === 'insert' ? {data: null, error: {message: 'nope'}} : db(call));
    const body = await answer(await importing([person()]));
    expect(body.results[0]).toEqual({index: 0, ok: false, error: 'create_failed'});
    expect(fake.calls.filter(c => c.what === 'deleteUser')).toHaveLength(1);
  });

  it('gives each person their own result, one failing not stopping the others', async () => {
    const body = await answer(
      await importing([person(), person({full_name: '1234'}), person({phone: 'abc'}), person({department_id: 'dept-9'}), person({role: 'ADMIN'}), person({full_name: 'Ελένη Κωνσταντίνου', role: 'VIEWER', department_id: ''})]),
    );
    expect(body.results.map(r => [r.index, r.ok, r.error])).toEqual([
      [0, true, undefined],
      [1, false, 'invalid_name'],
      [2, false, 'invalid_phone'],
      [3, false, 'invalid_department'],
      [4, false, 'invalid_role'],
      [5, true, undefined],
    ]);
    expect(profileInserts().map(p => [p.role, p.department_id])).toEqual([['DEPARTMENT', 'dept-1'], ['VIEWER', null]]);
  });

  it('never makes an administrator, whatever the list says', async () => {
    const body = await answer(await importing([person({role: 'ADMIN'})]));
    expect(body.results[0]).toEqual({index: 0, ok: false, error: 'invalid_role'});
    expect(fake.calls.some(c => c.what === 'createUser')).toBe(false);
  });

  it('skips someone already in the hospital by name, telling their username, and an email already used', async () => {
    world({sameName: [{id: 'u1', user_code: 'MP4321'}]});
    expect((await answer(await importing([person()]))).results[0]).toEqual({index: 0, ok: false, error: 'already_exists', user_code: 'MP4321'});
    world({sameEmail: [{id: 'u2'}]});
    expect((await answer(await importing([person({email: 'x@y.gr'})]))).results[0]).toEqual({index: 0, ok: false, error: 'email_taken'});
    expect(fake.calls.some(c => c.what === 'createUser')).toBe(false);
  });

  it('reports an email the sign-in service already has', async () => {
    fake.admin.createUser = () => ({data: null, error: {message: 'User already registered'}});
    expect((await answer(await importing([person()]))).results[0]).toEqual({index: 0, ok: false, error: 'email_taken'});
  });
});

describe('the initial password', () => {
  it.each([
    ['6912345678', '6912345678'],
    ['691 234 5678', '6912345678'],
    ['691-234-5678', '6912345678'],
    ['+30 691 234 5678', '6912345678'],
    ['0030 691 234 5678', '6912345678'],
    ['306912345678', '6912345678'],
    ['2310 123456', '2310123456'],
    [6912345678, '6912345678'],
  ])('reads %s as %s', (given, wanted) => expect(phonePassword(given)).toBe(wanted));

  it.each(['', 'abc', '12345', '1234567', '1'.repeat(16), null, undefined])('refuses %s', given => expect(phonePassword(given)).toBeNull());
});
