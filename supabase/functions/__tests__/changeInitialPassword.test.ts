// @vitest-environment node
import {beforeEach, describe, expect, it} from 'vitest';
import {loadFunction, post, resetFake} from './harness';
import {fake, type DbCall} from './fakes/supabase';

type Handler = (req: Request) => Response | Promise<Response>;
type Row = Record<string, unknown> | null;

const MUST_CHANGE = {id: 'user-1', active: true, password_change_required: true};
const profile = (row: Row) => {
  fake.db = (call: DbCall) => (call.table === 'profiles' && call.op === 'select' ? {data: row, error: null} : {data: null, error: null});
};
const change = (password: unknown) => handle(post({password}));

let handle: Handler;
beforeEach(async () => {
  resetFake();
  fake.user = {id: 'user-1'};
  profile(MUST_CHANGE);
  handle = await loadFunction('change-initial-password');
});

describe('change-initial-password', () => {
  it('sets the new password, then lifts the requirement', async () => {
    const response = await change('Nea-kodikos-7');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ok: true});
    expect(fake.calls.find(c => c.what === 'updateUserById')?.args).toEqual(['user-1', {password: 'Nea-kodikos-7'}]);
    const update = fake.dbCalls('update').find(c => c.table === 'profiles');
    expect(update?.values).toEqual({password_change_required: false, password_change_deadline: null});
    expect(update?.filters).toContainEqual(['eq', 'id', 'user-1']);
  });

  it('keeps the requirement when the password could not be changed', async () => {
    fake.admin.updateUserById = () => ({error: {message: 'weak'}});
    const response = await change('Nea-kodikos-7');
    expect(response.status).toBe(500);
    expect(fake.dbCalls('update')).toHaveLength(0);
  });

  it('refuses a caller who is not signed in', async () => {
    fake.user = null;
    expect((await change('Nea-kodikos-7')).status).toBe(401);
  });

  it.each([
    ['with no profile', null],
    ['whose account is inactive', {...MUST_CHANGE, active: false}],
  ])('refuses someone %s', async (_who, row) => {
    profile(row);
    expect((await change('Nea-kodikos-7')).status).toBe(403);
    expect(fake.calls.some(c => c.what === 'updateUserById')).toBe(false);
  });

  it('is not a way for anyone else to change a password: only those still held to the first one', async () => {
    profile({...MUST_CHANGE, password_change_required: false});
    const response = await change('Nea-kodikos-7');
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({error: 'not_required'});
    expect(fake.calls.some(c => c.what === 'updateUserById')).toBe(false);
  });

  it.each([
    ['6912345678'], // the mobile number itself: digits only
    ['abcdefgh'],
    ['Ab1'],
    [''],
    ['a1'.repeat(40)],
    [123456789],
    [undefined],
  ])('refuses the password %s', async password => {
    const response = await change(password);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({error: 'password_invalid'});
    expect(fake.calls.some(c => c.what === 'updateUserById')).toBe(false);
  });

  it('only ever changes the password of the signed-in person, never one named in the request', async () => {
    await handle(post({password: 'Nea-kodikos-7', user_id: 'someone-else'}));
    expect(fake.calls.find(c => c.what === 'updateUserById')?.args[0]).toBe('user-1');
  });
});
