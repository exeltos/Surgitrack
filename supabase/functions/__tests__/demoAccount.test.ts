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
    expect((await send(handle, {action: 'delete', demo_account_id: 'demo-1'})).status).toBe(400);
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
