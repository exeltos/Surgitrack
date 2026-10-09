// @vitest-environment node
import {beforeEach, describe, expect, it} from 'vitest';
import {env, eqValue, loadFunction, mailState, post, resetFake} from './harness';
import {fake, type DbCall} from './fakes/supabase';

type Handler = (req: Request) => Response | Promise<Response>;

const DAY = 864e5;
const at = (days: number) => new Date(Date.now() + days * DAY).toISOString();
const demo = (patch: Record<string, unknown> = {}, org: Record<string, unknown> = {}) => ({
  id: 'demo-1',
  organization_id: 'org-demo',
  status: 'SENT',
  auto_delete: true,
  ending_notice_for: null,
  ended_notice_for: null,
  ...patch,
  organizations: {name: 'Γ.Ν. Λάρισας · Demo', is_demo: true, evaluation: true, trial_ends_at: at(10), ...org},
});

let demos: unknown[] = [];
let caller: Record<string, unknown> | null = {role: 'ADMIN', active: true, organization_id: null};
const routes = () => {
  fake.db = (call: DbCall) => {
    if (call.table === 'demo_accounts' && call.op === 'select') return {data: demos, error: null};
    if (call.table === 'profiles' && call.op === 'select') {
      if (eqValue(call, 'id')) return {data: caller, error: null};
      if (call.filters.some(([op, name]) => op === 'eq' && name === 'active'))
        return {data: [{email: 'maria@hospital.gr'}, {email: 'nikos@hospital.gr'}, {email: null}], error: null};
      return {data: [{id: 'u1'}, {id: 'u2'}], error: null};
    }
    return {data: null, error: null};
  };
};
const mailOn = () =>
  Object.assign(env, {SMTP_HOST: 'smtp.example', SMTP_USER: 'u', SMTP_PASS: 'p', MAIL_FROM: 'SurgiTrack <no-reply@example.gr>'});
const run = (headers: Record<string, string> = {}) => handle(post({}, headers));
const updates = () => fake.dbCalls('update').filter(c => c.table === 'demo_accounts');

let handle: Handler;
beforeEach(async () => {
  resetFake();
  fake.user = {id: 'owner-1'};
  caller = {role: 'ADMIN', active: true, organization_id: null};
  demos = [];
  routes();
  mailOn();
  fake.rpc = (name, args) => ({
    data: name === 'demo_cron_secret_ok' && (args as {p_secret: string}).p_secret === 'cron-secret-123',
    error: null,
  });
  handle = await loadFunction('demo-lifecycle');
});

describe('demo-lifecycle: who may run it', () => {
  it('runs for the scheduler with the secret, without a signed-in user', async () => {
    fake.user = null;
    expect((await run({'x-cron-secret': 'cron-secret-123'})).status).toBe(200);
  });

  it('refuses a wrong secret and anyone but the platform owner', async () => {
    fake.user = null;
    expect((await run({'x-cron-secret': 'wrong'})).status).toBe(401);
    fake.user = {id: 'someone'};
    caller = {role: 'ADMIN', active: true, organization_id: 'org-1'};
    expect((await run()).status).toBe(403);
  });

  it('runs for the platform owner', async () => {
    expect(await (await run()).json()).toMatchObject({ok: true, ending: 0, ended: 0, deleted: 0});
  });
});

describe('demo-lifecycle: the round', () => {
  it('tells everyone in the Demo, one by one, that it ends in 3 days, once per end date', async () => {
    const endsAt = at(2.5);
    demos = [demo({}, {trial_ends_at: endsAt})];
    expect(await (await run()).json()).toMatchObject({ending: 1});
    const outbox = mailState.outbox as Array<{to: string; subject: string; html: string}>;
    expect(outbox.map(m => m.to)).toEqual(['maria@hospital.gr', 'nikos@hospital.gr']);
    expect(outbox[0].subject).toContain('σε 3 ημέρες');
    expect(outbox[0].html).toContain('Ζητώ παράταση');
    expect(updates()[0].values).toEqual({ending_notice_for: endsAt});

    mailState.outbox.length = 0;
    demos = [demo({ending_notice_for: endsAt}, {trial_ends_at: endsAt})];
    expect(await (await run()).json()).toMatchObject({ending: 0});
    expect(mailState.outbox).toHaveLength(0);
  });

  it('warns again after an extension that ends soon again', async () => {
    demos = [demo({ending_notice_for: at(-5)}, {trial_ends_at: at(1)})];
    expect(await (await run()).json()).toMatchObject({ending: 1});
  });

  it('thanks them once it has ended, but not for an old end', async () => {
    const endsAt = at(-0.5);
    demos = [demo({ending_notice_for: endsAt}, {trial_ends_at: endsAt})];
    expect(await (await run()).json()).toMatchObject({ended: 1});
    expect((mailState.outbox[0] as {subject: string}).subject).toContain('έληξε');
    expect(updates()[0].values).toEqual({ended_notice_for: endsAt});

    mailState.outbox.length = 0;
    demos = [demo({}, {trial_ends_at: at(-10)})];
    expect(await (await run()).json()).toMatchObject({ended: 0});
    expect(mailState.outbox).toHaveLength(0);
  });

  it('sends nothing for a Demo whose email never went out', async () => {
    demos = [demo({status: 'PREPARING'}, {trial_ends_at: at(1)})];
    expect(await (await run()).json()).toMatchObject({ending: 0});
  });

  it('deletes a Demo 30 days after its end, with its accounts', async () => {
    demos = [demo({}, {trial_ends_at: at(-31)})];
    expect(await (await run()).json()).toMatchObject({deleted: 1});
    const deleted = fake.calls.filter(c => c.what === 'deleteUser').map(c => c.args[0]);
    expect(deleted).toEqual(['u1', 'u2']);
    const org = fake.dbCalls('delete').find(c => c.table === 'organizations')!;
    expect(eqValue(org, 'id')).toBe('org-demo');
    expect(eqValue(org, 'is_demo')).toBe(true);
  });

  it.each([
    ['kept by the owner', demo({auto_delete: false}, {trial_ends_at: at(-60)})],
    ['a customer now', demo({status: 'CONVERTED'}, {trial_ends_at: at(-60)})],
    ['no longer a Demo', demo({}, {trial_ends_at: at(-60), is_demo: false})],
    ['only 29 days ended', demo({ended_notice_for: at(-29)}, {trial_ends_at: at(-29)})],
  ])('never deletes a Demo %s', async (_label, row) => {
    demos = [row];
    expect(await (await run()).json()).toMatchObject({deleted: 0});
    expect(fake.calls.filter(c => c.what === 'deleteUser')).toHaveLength(0);
    expect(fake.dbCalls('delete')).toHaveLength(0);
  });

  it('carries on with the other Demos when one fails', async () => {
    fake.admin.deleteUser = () => ({error: {message: 'boom'}});
    demos = [demo({}, {trial_ends_at: at(-40)}), demo({id: 'demo-2', organization_id: 'org-2'}, {trial_ends_at: at(2)})];
    expect(await (await run()).json()).toMatchObject({failed: 1, ending: 1});
  });
});
