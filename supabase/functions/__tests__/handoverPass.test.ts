// @vitest-environment node
import {beforeEach, describe, expect, it} from 'vitest';
import {loadFunction, post, resetFake} from './harness';
import {fake, type DbCall} from './fakes/supabase';

type Handler = (req: Request) => Response | Promise<Response>;
type Row = Record<string, unknown> | null;

const NURSE = {id: 'user-1', organization_id: 'org-1', role: 'DEPARTMENT', active: true, password_change_required: false};
const profile = (row: Row) => {
  fake.db = (call: DbCall) =>
    call.table === 'profiles' && call.op === 'select' ? {data: row, error: null} : {data: null, error: null};
};

let handle: Handler;
beforeEach(async () => {
  resetFake();
  fake.user = {id: 'user-1'};
  profile(NURSE);
  handle = await loadFunction('handover-pass');
});

describe('handover-pass', () => {
  it('makes a one-time pass for the signed-in person, storing only its hash, for 45 seconds', async () => {
    const started = Date.now();
    const response = await handle(post({}));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.pass).toMatch(/^[0-9A-F]{40}$/);
    const insert = fake.dbCalls('insert').find(c => c.table === 'handover_passes')!;
    const row = insert.values as Record<string, string>;
    expect(row.user_id).toBe('user-1');
    expect(row.organization_id).toBe('org-1');
    expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.token_hash).not.toContain(body.pass);
    const lives = new Date(row.expires_at).getTime() - started;
    expect(lives).toBeGreaterThan(40_000);
    expect(lives).toBeLessThan(50_000);
  });

  it('drops the person’s earlier unused passes: only the QR on screen works', async () => {
    await handle(post({}));
    const cleared = fake.dbCalls('delete').find(c => c.table === 'handover_passes')!;
    expect(cleared.filters).toContainEqual(['eq', 'user_id', 'user-1']);
    expect(cleared.filters).toContainEqual(['is', 'used_at', null]);
  });

  it('refuses a caller who is not signed in', async () => {
    fake.user = null;
    expect((await handle(post({}))).status).toBe(401);
  });

  it.each([
    ['no profile', null],
    ['an inactive account', {...NURSE, active: false}],
    ['a read-only viewer', {...NURSE, role: 'VIEWER'}],
    ['someone who still has the initial password', {...NURSE, password_change_required: true}],
    ['no hospital', {...NURSE, organization_id: null}],
  ])('gives no pass to %s', async (_label, row) => {
    profile(row);
    expect((await handle(post({}))).status).toBe(403);
    expect(fake.dbCalls('insert')).toHaveLength(0);
  });
});
