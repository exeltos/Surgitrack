// @vitest-environment node
import {beforeEach, describe, expect, it} from 'vitest';
import {loadFunction, post, resetFake} from './harness';
import {fake} from './fakes/supabase';

type Handler = (req: Request) => Response | Promise<Response>;
let handle: Handler;

const session = {access_token: 'access', refresh_token: 'refresh'};
// The limiter answers with the id of the reserved attempt, or null when a limit is reached.
const allowAttempts = () => {
  fake.rpc = () => ({data: 'attempt-1', error: null});
};
const knownUser = () => {
  fake.db = call =>
    call.table === 'profiles'
      ? {data: {id: 'u1', email: 'nurse@hospital.gr', active: true}, error: null}
      : {data: null, error: null};
};

beforeEach(async () => {
  resetFake();
  handle = await loadFunction('login-with-code');
});

describe('login-with-code', () => {
  it('answers the browser preflight and refuses other methods', async () => {
    const preflight = await handle(new Request('http://localhost/fn', {method: 'OPTIONS'}));
    expect(preflight.status).toBe(200);
    const get = await handle(new Request('http://localhost/fn', {method: 'GET'}));
    expect(get.status).toBe(405);
  });

  it.each([{}, {user_code: 'AM8704'}, {user_code: 'AM87', password: 'x'}, {user_code: '1M8704', password: 'x'}])(
    'rejects malformed credentials %j without touching the limiter or the password check',
    async body => {
      const response = await handle(post(body));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({error: 'invalid_credentials'});
      expect(fake.calls.filter(c => c.what === 'rpc' || c.what === 'signIn')).toHaveLength(0);
    },
  );

  it('accepts the code in any letter case and signs in with the password', async () => {
    allowAttempts();
    knownUser();
    fake.signIn = () => ({data: {session}, error: null});
    const response = await handle(post({user_code: ' am8704 ', password: 'secret'}));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(session);
    expect(fake.calls.find(c => c.what === 'rpc')?.args[1]).toMatchObject({p_user_code: 'AM8704'});
    expect(fake.calls.find(c => c.what === 'signIn')?.args[0]).toEqual({email: 'nurse@hospital.gr', password: 'secret'});
  });

  it('marks the reserved attempt as succeeded only after a correct password', async () => {
    allowAttempts();
    knownUser();
    fake.signIn = () => ({data: {session}, error: null});
    await handle(post({user_code: 'AM8704', password: 'secret'}));
    const update = fake.dbCalls('update').find(c => c.table === 'login_attempts');
    expect(update?.values).toEqual({succeeded: true});
    expect(update?.filters).toContainEqual(['eq', 'id', 'attempt-1']);
  });

  it('refuses a wrong password, keeps the attempt counted as failed, and never returns the email', async () => {
    allowAttempts();
    knownUser();
    const response = await handle(post({user_code: 'AM8704', password: 'wrong'}));
    expect(response.status).toBe(401);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({error: 'invalid_credentials'});
    expect(text).not.toContain('nurse@hospital.gr');
    expect(fake.dbCalls('update')).toHaveLength(0);
  });

  it('answers an unknown code like a wrong password, without trying to sign in', async () => {
    allowAttempts();
    fake.db = () => ({data: null, error: null});
    const response = await handle(post({user_code: 'ZZ9999', password: 'x'}));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({error: 'invalid_credentials'});
    expect(fake.calls.filter(c => c.what === 'signIn')).toHaveLength(0);
  });

  it('looks the account up by its code', async () => {
    allowAttempts();
    fake.db = () => ({data: null, error: null});
    await handle(post({user_code: 'AM8704', password: 'x'}));
    const lookup = fake.dbCalls().find(c => c.table === 'profiles');
    expect(lookup?.filters).toContainEqual(['eq', 'user_code', 'AM8704']);
  });

  it('lets an inactive account in only while its signup waits for approval', async () => {
    allowAttempts();
    fake.signIn = () => ({data: {session}, error: null});
    const inactive = (waiting: boolean) => {
      fake.db = call =>
        call.table === 'profiles'
          ? {data: {id: 'u1', email: 'nurse@hospital.gr', active: false}, error: null}
          : call.table === 'staff_access_requests'
            ? {data: waiting ? {id: 'r1'} : null, error: null}
            : {data: null, error: null};
    };
    inactive(false);
    expect((await handle(post({user_code: 'AM8704', password: 'secret'}))).status).toBe(401);
    expect(fake.calls.filter(c => c.what === 'signIn')).toHaveLength(0);
    inactive(true);
    expect((await handle(post({user_code: 'AM8704', password: 'secret'}))).status).toBe(200);
    const request = fake.dbCalls().find(c => c.table === 'staff_access_requests');
    expect(request?.filters).toContainEqual(['eq', 'user_id', 'u1']);
    expect(request?.filters).toContainEqual(['eq', 'status', 'PENDING']);
  });

  it('stops with 429 when a limit is reached, before checking the password', async () => {
    fake.rpc = () => ({data: null, error: null});
    const response = await handle(post({user_code: 'AM8704', password: 'secret'}));
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({error: 'too_many_attempts', retry_after_minutes: 15});
    expect(fake.calls.filter(c => c.what === 'signIn')).toHaveLength(0);
  });

  it('fails closed when the limiter is unavailable', async () => {
    fake.rpc = () => ({data: null, error: {message: 'down'}});
    const response = await handle(post({user_code: 'AM8704', password: 'secret'}));
    expect(response.status).toBe(503);
    expect(fake.calls.filter(c => c.what === 'signIn')).toHaveLength(0);
  });

  it('fails closed when the profile lookup fails', async () => {
    allowAttempts();
    fake.db = () => ({data: null, error: {message: 'down'}});
    const response = await handle(post({user_code: 'AM8704', password: 'secret'}));
    expect(response.status).toBe(503);
    expect(fake.calls.filter(c => c.what === 'signIn')).toHaveLength(0);
  });

  it('limits per the address Cloudflare reports, not the one the client claims', async () => {
    allowAttempts();
    await handle(post({user_code: 'AM8704', password: 'x'}, {'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': '6.6.6.6'}));
    expect(fake.calls.find(c => c.what === 'rpc')?.args[1]).toMatchObject({p_ip: '203.0.113.9'});
  });

  it('answers a failure no faster than about 0.6 s, so timing does not reveal whether a code exists', async () => {
    allowAttempts();
    fake.db = () => ({data: null, error: null});
    const started = Date.now();
    await handle(post({user_code: 'ZZ9999', password: 'x'}));
    expect(Date.now() - started).toBeGreaterThanOrEqual(550);
  });

  it('reports an unexpected error as login_failed, not its details', async () => {
    allowAttempts();
    fake.db = () => {
      throw new Error('secret internals');
    };
    const response = await handle(post({user_code: 'AM8704', password: 'x'}));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({error: 'login_failed'});
  });
});
