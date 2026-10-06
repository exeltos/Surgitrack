// @vitest-environment node
import {beforeEach, describe, expect, it} from 'vitest';
import {answerTables, eqValue, loadFunction, post, resetFake} from './harness';
import {fake, type DbCall} from './fakes/supabase';

type Handler = (req: Request) => Response | Promise<Response>;
type Row = Record<string, unknown> | null;

const NURSE = {id: 'sterilization-1', organization_id: 'org-1', role: 'STERILIZATION', active: true};
const PERSON = {
  id: 'person-2',
  name: 'ΜΑΡΙΑ ΠΑΠΑ',
  email: 'maria@hospital.gr',
  role: 'DEPARTMENT',
  user_code: 'MP1234',
  department: {name: 'Χειρουργείο'},
};
const credentials = {user_code: 'MP1234', password: 'secret'};

/** The signed-in caller's profile and the person who confirms (found by user code). */
const world = (w: {me?: Row; person?: Row} = {}) => {
  answerTables({
    'profiles:select': (call: DbCall) => (eqValue(call, 'id') ? ('me' in w ? w.me : NURSE) : 'person' in w ? w.person : PERSON),
  });
  fake.rpc = () => ({data: 'attempt-1', error: null});
};
const passwordOk = () => {
  fake.signIn = () => ({data: {session: {access_token: 'handover-token', refresh_token: 'r'}}, error: null});
};
const calls = (what: string) => fake.calls.filter(c => c.what === what);
const personLookup = () => fake.dbCalls().find(c => c.table === 'profiles' && eqValue(c, 'user_code'));

let handle: Handler;
const sign = (body: Record<string, unknown> = credentials) => handle(post(body));
beforeEach(async () => {
  resetFake();
  fake.user = {id: 'sterilization-1'};
  world();
  handle = await loadFunction('verify-handover');
});

describe('verify-handover: who may ask', () => {
  it('answers the browser preflight and refuses other methods', async () => {
    expect((await handle(new Request('http://localhost/fn', {method: 'OPTIONS'}))).status).toBe(200);
    expect((await handle(new Request('http://localhost/fn', {method: 'GET'}))).status).toBe(405);
  });

  it('refuses a caller who is not signed in', async () => {
    fake.user = null;
    expect((await sign()).status).toBe(401);
    expect(calls('rpc')).toHaveLength(0);
  });

  it.each([
    ['no profile', null],
    ['an inactive account', {...NURSE, active: false}],
  ])('refuses a caller with %s', async (_label, me) => {
    world({me});
    const response = await sign();
    expect(response.status).toBe(401);
    expect(calls('rpc')).toHaveLength(0);
    expect(calls('signIn')).toHaveLength(0);
  });

  it('needs a hospital: a caller without one who is not the platform admin gets 400', async () => {
    world({me: {...NURSE, organization_id: null}});
    const response = await sign();
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({error: 'no_organization'});
  });

  it('lets the platform admin name the hospital, and asks for it', async () => {
    world({me: {...NURSE, organization_id: null, role: 'ADMIN'}});
    passwordOk();
    expect((await sign()).status).toBe(400);
    expect((await sign({...credentials, organization_id: 'org-5'})).status).toBe(200);
    expect(eqValue(personLookup()!, 'organization_id')).toBe('org-5');
  });

  it('keeps hospital staff in their own hospital, whatever the request names', async () => {
    passwordOk();
    await sign({...credentials, organization_id: 'org-2'});
    expect(eqValue(personLookup()!, 'organization_id')).toBe('org-1');
  });
});

describe('verify-handover: the other party', () => {
  it.each([
    ['no code', {password: 'x'}],
    ['no password', {user_code: 'MP1234'}],
    ['a code of the wrong shape', {user_code: 'M1234', password: 'x'}],
  ])('rejects %s before the limiter, no sooner than about 0.5 s', async (_label, body) => {
    const started = Date.now();
    const response = await sign(body);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({error: 'invalid_credentials'});
    expect(Date.now() - started).toBeGreaterThanOrEqual(450);
    expect(calls('rpc')).toHaveLength(0);
  });

  it('counts attempts per code and per signed-in caller', async () => {
    await sign({user_code: ' mp1234 ', password: 'x'});
    expect(calls('rpc')[0].args[1]).toEqual({
      p_user_code: 'MP1234',
      p_ip: 'handover:sterilization-1',
      p_window_minutes: 15,
      p_max_code_fails: 5,
      p_max_ip_fails: 20,
    });
  });

  it('stops with 429 at the limit, and with 503 (failing closed) when the limiter is down, before any password check', async () => {
    fake.rpc = () => ({data: null, error: null});
    const limited = await sign();
    expect(limited.status).toBe(429);
    expect(await limited.json()).toMatchObject({error: 'too_many_attempts', retry_after_minutes: 15});
    fake.rpc = () => ({data: null, error: {message: 'down'}});
    expect((await sign()).status).toBe(503);
    expect(calls('signIn')).toHaveLength(0);
  });

  it('looks only for an active person of that hospital with that code', async () => {
    await sign();
    const lookup = personLookup()!;
    expect(eqValue(lookup, 'user_code')).toBe('MP1234');
    expect(eqValue(lookup, 'organization_id')).toBe('org-1');
    expect(eqValue(lookup, 'active')).toBe(true);
  });

  it.each([
    ['an unknown code', {person: null}],
    ['a person with no email', {person: {...PERSON, email: null}}],
  ])('answers %s like a wrong password, without trying to sign in', async (_label, setup) => {
    world(setup);
    const response = await sign();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({error: 'invalid_credentials'});
    expect(calls('signIn')).toHaveLength(0);
  });

  it('refuses a wrong password, and the attempt stays counted as failed', async () => {
    const response = await sign();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({error: 'invalid_credentials'});
    expect(fake.dbCalls('update')).toHaveLength(0);
  });
});

describe('verify-handover: a confirmed handover', () => {
  beforeEach(passwordOk);

  it('returns who signed, and nothing that could be used to sign in as them', async () => {
    const response = await sign();
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({
      user_id: 'person-2',
      name: 'ΜΑΡΙΑ ΠΑΠΑ',
      user_code: 'MP1234',
      role: 'Χρήστης Τμήματος',
      department: 'Χειρουργείο',
    });
    for (const secret of ['maria@hospital.gr', 'handover-token', 'access_token', 'refresh_token']) expect(text).not.toContain(secret);
  });

  it('revokes the session the password check made, at once', async () => {
    await sign();
    expect(calls('signOut')).toHaveLength(1);
    expect(calls('signOut')[0].args).toEqual(['handover-token', 'local']);
  });

  it('still answers when revoking that session fails', async () => {
    fake.admin.signOut = () => {
      throw new Error('revoke failed');
    };
    expect((await sign()).status).toBe(200);
  });

  it('marks the attempt as succeeded', async () => {
    await sign();
    const update = fake.dbCalls('update').find(c => c.table === 'login_attempts');
    expect(update?.values).toEqual({succeeded: true});
    expect(eqValue(update!, 'id')).toBe('attempt-1');
  });

  it.each([
    ['STERILIZATION', 'Αποστείρωση'],
    ['DEPARTMENT', 'Χρήστης Τμήματος'],
    ['ADMIN', 'Διαχειριστής'],
  ])('names the role %s as %s', async (role, label) => {
    world({person: {...PERSON, role}});
    expect(await (await sign()).json()).toMatchObject({role: label});
  });

  it.each([
    ['an object', {name: 'Μονάδα'}, 'Μονάδα'],
    ['a list', [{name: 'Θάλαμος'}], 'Θάλαμος'],
    ['nothing', null, ''],
  ])('reads the department given as %s', async (_label, department, expected) => {
    world({person: {...PERSON, department}});
    expect(await (await sign()).json()).toMatchObject({department: expected});
  });

  it('refuses a handover signed by the same person who is signed in', async () => {
    world({person: {...PERSON, id: 'sterilization-1'}});
    const response = await sign();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({error: 'same_user'});
  });

  it('does not let a read-only viewer take part, even with the right password', async () => {
    world({person: {...PERSON, role: 'VIEWER'}});
    const response = await sign();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({error: 'invalid_credentials'});
  });

  it('reports an unexpected error as failed, without details', async () => {
    fake.db = () => {
      throw new Error('secret internals');
    };
    const response = await sign();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({error: 'failed'});
  });
});
