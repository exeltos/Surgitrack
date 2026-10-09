// @vitest-environment node
import {beforeEach, describe, expect, it} from 'vitest';
import {answerTables, env, eqValue, loadFunction, mailState, post, resetFake} from './harness';
import {fake, type DbCall} from './fakes/supabase';

type Handler = (req: Request) => Response | Promise<Response>;
type Row = Record<string, unknown> | null;

const OWNER = {id: 'owner-1', role: 'ADMIN', active: true, organization_id: null};
const IN_TEN_DAYS = new Date(Date.now() + 10 * 864e5).toISOString();
const DEMO = {
  id: 'demo-1',
  organization_id: 'org-demo',
  hospital_name: 'Γ.Ν. Λάρισας',
  contact_name: 'Μαρία Παππά',
  contact_email: 'maria@hospital.gr',
  seeded_at: '2026-10-09T08:00:00Z',
  evaluator_id: null,
};
const ORG = {
  id: 'org-demo',
  name: 'Γ.Ν. Λάρισας · Demo',
  active: true,
  is_demo: true,
  evaluation: true,
  trial_ends_at: IN_TEN_DAYS,
};

const tables = (o: {caller?: Row; demo?: Row; org?: Row; invitedProfile?: Row} = {}) =>
  answerTables({
    'profiles:select': (call: DbCall) =>
      eqValue(call, 'id') === 'owner-1'
        ? o.caller === undefined
          ? OWNER
          : o.caller
        : eqValue(call, 'id') === 'evaluator-1'
          ? o.invitedProfile
          : null,
    'demo_accounts:select': o.demo === undefined ? DEMO : o.demo,
    'organizations:select': o.org === undefined ? ORG : o.org,
  });
const mailOn = () =>
  Object.assign(env, {SMTP_HOST: 'smtp.example', SMTP_USER: 'u', SMTP_PASS: 'p', MAIL_FROM: 'SurgiTrack <no-reply@example.gr>'});
const send = (handle: Handler, body: Record<string, unknown> = {action: 'invite', demo_account_id: 'demo-1'}) =>
  handle(post(body));
const writes = () => fake.dbCalls().filter(c => c.op !== 'select');

let handle: Handler;
beforeEach(async () => {
  resetFake();
  fake.user = {id: 'owner-1'};
  fake.rpc = () => ({data: 'MP1234', error: null});
  fake.admin.generateLink = () => ({data: {user: {id: 'evaluator-1'}, properties: {hashed_token: 'tok-1'}}, error: null});
  tables();
  mailOn();
  handle = await loadFunction('demo-account');
});

describe('demo-account: who may send', () => {
  it('refuses a caller who is not signed in', async () => {
    fake.user = null;
    expect((await send(handle)).status).toBe(401);
  });

  it.each([
    {...OWNER, organization_id: 'org-1'},
    {...OWNER, role: 'STERILIZATION'},
    {...OWNER, active: false},
  ])('refuses %j (only the platform owner)', async caller => {
    tables({caller});
    expect((await send(handle)).status).toBe(403);
    expect(writes()).toHaveLength(0);
  });

  it('refuses an unknown action', async () => {
    expect((await send(handle, {action: 'destroy', demo_account_id: 'demo-1'})).status).toBe(400);
  });
});

describe('demo-account: when it may be sent', () => {
  it('waits for the sample data', async () => {
    tables({demo: {...DEMO, seeded_at: null}});
    const res = await send(handle);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({error: 'Sample data not ready'});
    expect(mailState.outbox).toHaveLength(0);
    expect(writes()).toHaveLength(0);
  });

  it.each([
    [{...ORG, is_demo: false}, 'Not an evaluation Demo'],
    [{...ORG, evaluation: false}, 'Not an evaluation Demo'],
    [{...ORG, active: false}, 'Demo is not active'],
    [{...ORG, trial_ends_at: new Date(Date.now() - 1000).toISOString()}, 'Demo has ended'],
  ])('refuses %j', async (org, error) => {
    tables({org});
    const res = await send(handle);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({error});
    expect(mailState.outbox).toHaveLength(0);
  });

  it('does not send again once the prospect has signed in', async () => {
    tables({demo: {...DEMO, evaluator_id: 'evaluator-1'}, invitedProfile: {active: true}});
    const res = await send(handle);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({error: 'Already signed in'});
  });

  it('answers 404 for an unknown Demo', async () => {
    tables({demo: null});
    expect((await send(handle)).status).toBe(404);
  });
});

describe('demo-account: the invitation', () => {
  it("makes the prospect the Demo's admin and emails the Demo invitation", async () => {
    const res = await send(handle);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ok: true, user_code: 'MP1234', emailed: true});
    const profile = fake.dbCalls('upsert').find(c => c.table === 'profiles')!.values as Record<string, unknown>;
    expect(profile).toMatchObject({
      organization_id: 'org-demo',
      role: 'ADMIN',
      department_id: null,
      email: 'maria@hospital.gr',
      name: 'ΜΑΡΙΑ ΠΑΠΠΑ',
      active: false,
    });
    const mail = mailState.outbox[0] as {to: string; subject: string; html: string};
    expect(mail.to).toBe('maria@hospital.gr');
    expect(mail.subject).toContain('Demo');
    expect(mail.html).toContain('MP1234');
    expect(mail.html).toContain('st_token=tok-1');
    expect(mail.html).toContain('Γ.Ν. Λάρισας');
    const update = fake.dbCalls('update').find(c => c.table === 'demo_accounts')!;
    expect(update.values).toMatchObject({status: 'SENT', evaluator_id: 'evaluator-1'});
    expect(eqValue(update, 'id')).toBe('demo-1');
  });

  it('escapes the names it puts in the email', async () => {
    tables({demo: {...DEMO, contact_name: '<b>x</b>', hospital_name: 'A & <i>B</i>'}});
    await send(handle);
    const mail = mailState.outbox[0] as {html: string};
    expect(mail.html).not.toContain('<i>B</i>');
    expect(mail.html).not.toContain('<b>x</b>');
  });
});

describe('demo-account: a request from someone in a Demo', () => {
  const REQUEST = {
    id: 'req-1',
    organization_id: 'org-demo',
    user_id: 'person-1',
    kind: 'PURCHASE',
    contact_name: 'Νίκος <b>Ιωάννου</b>',
    phone: '2410 000000',
    message: 'Καλέστε με',
    created_at: new Date().toISOString(),
  };
  const routes = (o: {request?: Row; recent?: number; contactEmail?: string | null} = {}) => {
    fake.db = (call: DbCall) => {
      if (call.table === 'demo_requests' && call.filters.some(([op]) => op === 'gte'))
        return {data: null, count: o.recent ?? 1, error: null};
      const answer: Record<string, unknown> = {
        demo_requests: o.request === undefined ? REQUEST : o.request,
        organizations: ORG,
        profiles: {name: 'ΝΙΚΟΣ ΙΩΑΝΝΟΥ', email: 'nikos@hospital.gr'},
        platform_settings: o.contactEmail === null ? null : {contact_email: o.contactEmail ?? 'owner@exeltos.com'},
      };
      return {data: answer[call.table] ?? null, error: null};
    };
  };
  const notify = () => send(handle, {action: 'notify_request', request_id: 'req-1'});
  beforeEach(() => {
    fake.user = {id: 'person-1'};
    routes();
  });

  it('emails the platform owner, escaping what the person wrote', async () => {
    const res = await notify();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ok: true, emailed: true});
    const mail = mailState.outbox[0] as {to: string; subject: string; html: string};
    expect(mail.to).toBe('owner@exeltos.com');
    expect(mail.subject).toContain('Θέλει την εφαρμογή');
    expect(mail.html).toContain('nikos@hospital.gr');
    expect(mail.html).not.toContain('<b>Ιωάννου</b>');
    expect(writes()).toHaveLength(0);
  });

  it('falls back to the default address and tells an extension apart', async () => {
    routes({request: {...REQUEST, kind: 'EXTENSION'}, contactEmail: null});
    await notify();
    const mail = mailState.outbox[0] as {to: string; subject: string};
    expect(mail.to).toBe('info@exeltos.com');
    expect(mail.subject).toContain('παράταση');
  });

  it("refuses someone else's request (and needs no owner rights)", async () => {
    routes({request: {...REQUEST, user_id: 'someone-else'}});
    expect((await notify()).status).toBe(404);
    expect(mailState.outbox).toHaveLength(0);
  });

  it('does not email for an old request, or past three in an hour', async () => {
    routes({request: {...REQUEST, created_at: new Date(Date.now() - 11 * 60_000).toISOString()}});
    expect(await (await notify()).json()).toMatchObject({ok: true, emailed: false});
    routes({recent: 4});
    expect(await (await notify()).json()).toMatchObject({ok: true, emailed: false});
    expect(mailState.outbox).toHaveLength(0);
  });
});

describe('demo-account: deleting a Demo', () => {
  const remove = () => send(handle, {action: 'delete', demo_account_id: 'demo-1'});
  const routes = (o: {demo?: Row; org?: Row} = {}) => {
    fake.db = (call: DbCall) => {
      if (call.table === 'profiles' && call.op === 'select')
        return {data: eqValue(call, 'id') === 'owner-1' ? OWNER : [{id: 'u1'}, {id: 'u2'}], error: null};
      if (call.table === 'demo_accounts' && call.op === 'select')
        return {data: o.demo === undefined ? {id: 'demo-1', organization_id: 'org-demo', status: 'SENT'} : o.demo, error: null};
      if (call.table === 'organizations' && call.op === 'select')
        return {data: o.org === undefined ? {is_demo: true, evaluation: true} : o.org, error: null};
      return {data: null, error: null};
    };
  };
  beforeEach(() => routes());

  it("deletes the invitations, then its people's accounts, then the hospital", async () => {
    const res = await remove();
    expect(res.status).toBe(200);
    const order = fake.calls
      .filter(c => c.what === 'deleteUser' || (c.what === 'db' && (c.args[0] as DbCall).op === 'delete'))
      .map(c => (c.what === 'deleteUser' ? `user:${c.args[0]}` : (c.args[0] as DbCall).table));
    expect(order).toEqual(['user_invitations', 'user:u1', 'user:u2', 'profiles', 'organizations']);
    const org = fake.dbCalls('delete').find(c => c.table === 'organizations')!;
    expect(eqValue(org, 'id')).toBe('org-demo');
    expect(eqValue(org, 'is_demo')).toBe(true);
  });

  it.each([
    ['a customer now', {demo: {id: 'demo-1', organization_id: 'org-demo', status: 'CONVERTED'}}],
    ['a real hospital', {org: {is_demo: false, evaluation: false}}],
  ])('never deletes %s', async (_label, o) => {
    routes(o);
    expect((await remove()).status).toBe(409);
    expect(fake.dbCalls('delete')).toHaveLength(0);
    expect(fake.calls.filter(c => c.what === 'deleteUser')).toHaveLength(0);
  });

  it('is for the platform owner only', async () => {
    fake.user = {id: 'someone'};
    expect((await remove()).status).toBe(403);
    expect(fake.dbCalls('delete')).toHaveLength(0);
  });
});
