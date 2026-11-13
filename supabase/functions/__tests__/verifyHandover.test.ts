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
    'profiles:select': (call: DbCall) =>
      eqValue(call, 'id') === 'sterilization-1' ? ('me' in w ? w.me : NURSE) : 'person' in w ? w.person : PERSON,
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

describe('verify-handover: someone the staff import made who still has the initial password', () => {
  it('cannot be the other party: the search leaves them out, so a colleague who knows their username and mobile number gets no signature', async () => {
    await sign();
    expect(personLookup()!.filters).toContainEqual(['eq', 'password_change_required', false]);
    // Left out, they are answered like an unknown code: wrong credentials, no password tried, nothing signed.
    const tried = calls('signIn').length;
    const signed = fake.dbCalls('insert').filter(c => c.table === 'handover_signatures').length;
    world({person: null});
    passwordOk();
    const response = await sign();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({error: 'invalid_credentials'});
    expect(calls('signIn')).toHaveLength(tried);
    expect(fake.dbCalls('insert').filter(c => c.table === 'handover_signatures')).toHaveLength(signed);
  });

  it('cannot witness a handover either, until they have chosen their own password', async () => {
    world({me: {...NURSE, password_change_required: true}});
    passwordOk();
    const response = await sign();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({error: 'password_change_required'});
    expect(calls('signIn')).toHaveLength(0);
    expect(fake.dbCalls('insert').filter(c => c.table === 'handover_signatures')).toHaveLength(0);
  });

  it('is no obstacle to anyone else', async () => {
    world({me: {...NURSE, password_change_required: false}});
    passwordOk();
    expect((await sign()).status).toBe(200);
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

  it('records the signature: who signed, for whom, in which hospital, for no item when none is named', async () => {
    await sign();
    const record = fake.dbCalls('insert').find(c => c.table === 'handover_signatures');
    expect(record?.values).toEqual({
      organization_id: 'org-1',
      signer_id: 'person-2',
      witness_id: 'sterilization-1',
      asset_ids: [],
    });
  });

  it('records what is handed over, and returns the signature for the handover records to cite', async () => {
    const answer = fake.db;
    fake.db = call =>
      call.table === 'handover_signatures' ? {data: {id: 'sig-1'}, error: null} : answer(call);
    const response = await sign({...credentials, asset_ids: ['set-1', 'tool-2', 'set-1', '', 7]});
    const record = fake.dbCalls('insert').find(c => c.table === 'handover_signatures');
    expect((record?.values as {asset_ids: string[]}).asset_ids).toEqual(['set-1', 'tool-2', '7']);
    expect((await response.json()).signature_id).toBe('sig-1');
  });

  it('still answers when the signature could not be recorded (the handover is then unverified)', async () => {
    const answer = fake.db;
    fake.db = call => (call.table === 'handover_signatures' ? {data: null, error: {message: 'down'}} : answer(call));
    expect((await sign()).status).toBe(200);
  });

  it.each([
    ['a wrong password', () => (fake.signIn = () => ({data: {session: null}, error: {message: 'invalid'}}))],
    ['the same person', () => world({person: {...PERSON, id: 'sterilization-1'}})],
    ['a viewer', () => world({person: {...PERSON, role: 'VIEWER'}})],
  ])('records no signature for %s', async (_label, arrange) => {
    arrange();
    await sign();
    expect(fake.dbCalls('insert').some(c => c.table === 'handover_signatures')).toBe(false);
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

describe('verify-handover: the QR of the other party (a one-time pass)', () => {
  /** The pass is taken by the database (consume_handover_pass), which names its person or nobody. */
  const passTaken = (userId: string | null) => {
    fake.rpc = (name: string) => (name === 'consume_handover_pass' ? {data: userId, error: null} : {data: null, error: null});
  };

  it('signs with the person the pass names, without a password or the login limiter', async () => {
    passTaken('person-2');
    const response = await sign({pass: 'p4ss-from-the-qr', asset_ids: ['set-1']});
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({user_id: 'person-2', name: 'ΜΑΡΙΑ ΠΑΠΑ', department: 'Χειρουργείο'});
    const taken = calls('rpc').find(c => c.args[0] === 'consume_handover_pass')!;
    const args = taken.args[1] as {p_token_hash: string; p_organization_id: string};
    // Only the pass's hash travels to the database, for the caller's own hospital.
    expect(args.p_token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(args.p_organization_id).toBe('org-1');
    expect(calls('rpc').some(c => c.args[0] === 'reserve_login_attempt')).toBe(false);
    expect(calls('signIn')).toHaveLength(0);
    const signature = fake.dbCalls('insert').find(c => c.table === 'handover_signatures')!;
    expect(signature.values).toMatchObject({signer_id: 'person-2', witness_id: 'sterilization-1', asset_ids: ['set-1']});
  });

  it('reads the pass whatever the case it was scanned in (a scanner may turn it to capitals or not)', async () => {
    passTaken('person-2');
    await sign({pass: 'abc123'});
    await sign({pass: 'ABC123'});
    const hashes = calls('rpc')
      .filter(c => c.args[0] === 'consume_handover_pass')
      .map(c => (c.args[1] as {p_token_hash: string}).p_token_hash);
    expect(hashes[0]).toBe(hashes[1]);
  });

  it('refuses a pass that is used, expired or of another hospital, no sooner than about 0.5 s', async () => {
    passTaken(null);
    const started = Date.now();
    const response = await sign({pass: 'old-pass'});
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({error: 'invalid_pass'});
    expect(Date.now() - started).toBeGreaterThanOrEqual(450);
    expect(fake.dbCalls('insert')).toHaveLength(0);
  });

  it('refuses a pass whose person may no longer sign (inactive, or the initial password again)', async () => {
    passTaken('person-2');
    world({person: null});
    passTaken('person-2');
    expect((await sign({pass: 'p4ss'})).status).toBe(401);
  });

  it('still refuses the signed-in person’s own QR', async () => {
    passTaken('sterilization-1');
    world({person: {...PERSON, id: 'sterilization-1'}});
    passTaken('sterilization-1');
    expect((await sign({pass: 'p4ss'})).status).toBe(409);
  });
});
