// @vitest-environment node
import {beforeEach, describe, expect, it} from 'vitest';
import {eqValue, loadFunction, post, resetFake} from './harness';
import {fake, type DbCall} from './fakes/supabase';

type Handler = (req: Request) => Response | Promise<Response>;
type Row = Record<string, unknown> | null;

const OWNER = {role: 'ADMIN', active: true, organization_id: null};
const HOSPITAL = {id: 'org-1', name: 'TEST Hospital', is_demo: false};

let caller: Row = OWNER;
let hospital: Row = HOSPITAL;
const routes = () => {
  fake.db = (call: DbCall) => {
    if (call.table === 'profiles' && call.op === 'select')
      return {data: eqValue(call, 'id') ? caller : [{id: 'u1'}, {id: 'u2'}], error: null};
    if (call.table === 'organizations' && call.op === 'select')
      return {data: eqValue(call, 'demo_of') ? [{id: 'org-1-demo'}] : hospital, error: null};
    return {data: null, error: null};
  };
};
const remove = (body: Record<string, unknown> = {organization_id: 'org-1', confirm_name: 'TEST Hospital'}) =>
  handle(post(body));
const deletes = () => fake.dbCalls('delete');

let handle: Handler;
beforeEach(async () => {
  resetFake();
  fake.user = {id: 'owner-1'};
  caller = OWNER;
  hospital = HOSPITAL;
  routes();
  handle = await loadFunction('delete-hospital');
});

describe('delete-hospital', () => {
  it('deletes the invitations, the accounts, then the hospital with its Demo copies', async () => {
    const res = await remove();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ok: true, accounts: 2});
    const order = fake.calls
      .filter(c => c.what === 'deleteUser' || (c.what === 'db' && (c.args[0] as DbCall).op === 'delete'))
      .map(c => (c.what === 'deleteUser' ? `user:${c.args[0]}` : (c.args[0] as DbCall).table));
    expect(order).toEqual(['user_invitations', 'user:u1', 'user:u2', 'profiles', 'organizations']);
    const invitations = deletes().find(c => c.table === 'user_invitations')!;
    expect(invitations.filters).toContainEqual(['in', 'organization_id', ['org-1', 'org-1-demo']]);
    const org = deletes().find(c => c.table === 'organizations')!;
    expect(eqValue(org, 'id')).toBe('org-1');
    expect(eqValue(org, 'is_demo')).toBe(false);
  });

  it('needs the hospital name typed exactly', async () => {
    const res = await remove({organization_id: 'org-1', confirm_name: 'TEST'});
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({error: 'Name does not match'});
    expect(deletes()).toHaveLength(0);
  });

  it.each([
    ['not signed in', () => (fake.user = null), 401],
    ['a hospital admin', () => (caller = {...OWNER, organization_id: 'org-1'}), 403],
    ['an inactive admin', () => (caller = {...OWNER, active: false}), 403],
  ])('refuses %s', async (_label, setup, status) => {
    setup();
    expect((await remove()).status).toBe(status);
    expect(deletes()).toHaveLength(0);
  });

  it('never deletes a Demo hospital, nor an unknown one', async () => {
    hospital = {...HOSPITAL, is_demo: true};
    expect((await remove()).status).toBe(409);
    hospital = null;
    expect((await remove()).status).toBe(404);
    expect(deletes()).toHaveLength(0);
    expect(fake.calls.filter(c => c.what === 'deleteUser')).toHaveLength(0);
  });
});
