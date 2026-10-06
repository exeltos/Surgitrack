// @vitest-environment node
import {beforeEach, describe, expect, it} from 'vitest';
import {answerTables, env, eqValue, loadFunction, mailState, post, resetFake} from './harness';
import {fake, type DbCall} from './fakes/supabase';

type Handler = (req: Request) => Response | Promise<Response>;
type Row = Record<string, unknown> | null;

const SITE = 'https://surgitrack-med.netlify.app';
const ME = {role: 'ADMIN', active: true, organization_id: 'org-1'};

const NOTIFY_ADMINS_REQUEST = {
  id: 'req-1',
  organization_id: 'org-1',
  full_name: 'ΓΙΩΡΓΟΣ ΝΙΚΟΛΑΟΥ',
  email: 'giorgos@hospital.gr',
  status: 'PENDING',
  admin_notified_at: null,
  department: {name: 'Χειρουργείο'},
  organization: {name: 'ΙΑΣΩ Θεσσαλίας'},
};
const DECISION_REQUEST = {
  id: 'req-1',
  organization_id: 'org-1',
  user_id: 'user-9',
  full_name: 'ΓΙΩΡΓΟΣ ΝΙΚΟΛΑΟΥ',
  email: 'giorgos@hospital.gr',
  status: 'APPROVED',
  decision_note: null,
  decision_notified_at: null,
  organization: {name: 'ΙΑΣΩ Θεσσαλίας'},
};
const INVITATION = {id: 'req-1', organization_id: 'org-1', status: 'PENDING_EMAIL', user_id: null};

type World = {request?: Row; me?: Row; admins?: Array<{email: string}>; userCode?: string};
/** The request the caller names, the caller's own profile, the hospital's admins, and the applicant's profile. */
const world = (w: World = {}) => {
  answerTables({
    'staff_access_requests:select': 'request' in w ? w.request : null,
    'profiles:select': (call: DbCall) => {
      if (eqValue(call, 'role')) return w.admins ?? [{email: 'admin@hospital.gr'}];
      if (eqValue(call, 'id') === 'admin-1') return 'me' in w ? w.me : ME;
      return {user_code: w.userCode ?? 'GN1234'};
    },
  });
};
const mailOn = () => {
  Object.assign(env, {SMTP_HOST: 'smtp.example', SMTP_USER: 'u', SMTP_PASS: 'p', MAIL_FROM: 'SurgiTrack <no-reply@example.gr>'});
};
const writes = (op: 'update' | 'delete') => fake.dbCalls(op).filter(c => c.table === 'staff_access_requests');
const nothingWritten = () => expect(fake.dbCalls().filter(c => c.op !== 'select')).toHaveLength(0);

let handle: Handler;
const act = (body: Record<string, unknown>) => handle(post(body));
beforeEach(async () => {
  resetFake();
  fake.user = {id: 'admin-1'};
  world();
  handle = await loadFunction('access-requests');
});

describe('access-requests: every call', () => {
  it('answers the browser preflight and refuses other methods', async () => {
    expect((await handle(new Request('http://localhost/fn', {method: 'OPTIONS'}))).status).toBe(200);
    expect((await handle(new Request('http://localhost/fn', {method: 'GET'}))).status).toBe(405);
  });

  it('refuses a caller who is not signed in', async () => {
    fake.user = null;
    world({request: INVITATION});
    for (const action of ['notify-admins', 'notify-decision', 'cancel-invite']) {
      expect((await act({action, request_id: 'req-1'})).status).toBe(401);
    }
    nothingWritten();
  });

  it('answers 400 for an unknown or missing action', async () => {
    expect((await act({action: 'delete-everything'})).status).toBe(400);
    expect((await act({})).status).toBe(400);
  });

  it('reports an unexpected error as "failed", without details', async () => {
    fake.db = () => {
      throw new Error('secret internals');
    };
    const response = await act({action: 'cancel-invite', request_id: 'req-1'});
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({error: 'failed'});
  });
});

describe('access-requests: notify-admins (the applicant tells the hospital admins)', () => {
  beforeEach(() => {
    mailOn();
    fake.user = {id: 'user-9'};
    world({request: NOTIFY_ADMINS_REQUEST, admins: [{email: 'a1@hospital.gr'}, {email: 'a2@hospital.gr'}]});
  });

  it("looks only for the caller's own request", async () => {
    await act({action: 'notify-admins', request_id: 'someone-elses'});
    const lookup = fake.dbCalls().find(c => c.table === 'staff_access_requests');
    expect(eqValue(lookup!, 'user_id')).toBe('user-9');
    expect(lookup?.filters.some(([, column]) => column === 'id')).toBe(false);
  });

  it('emails the hospital active admins, naming the applicant, hospital and department', async () => {
    const response = await act({action: 'notify-admins'});
    expect(await response.json()).toEqual({ok: true, emailed: true});
    const mail = mailState.outbox[0];
    expect(mail.to).toBe('a1@hospital.gr, a2@hospital.gr');
    expect(mail.subject).toBe('Νέα αίτηση πρόσβασης: ΓΙΩΡΓΟΣ ΝΙΚΟΛΑΟΥ');
    for (const text of ['giorgos@hospital.gr', 'ΙΑΣΩ Θεσσαλίας', 'Χειρουργείο', `${SITE}/#/hospital`]) expect(mail.html).toContain(text);
    const lookup = fake.dbCalls().find(c => c.table === 'profiles');
    expect(lookup?.filters).toContainEqual(['eq', 'organization_id', 'org-1']);
    expect(lookup?.filters).toContainEqual(['eq', 'role', 'ADMIN']);
    expect(lookup?.filters).toContainEqual(['eq', 'active', true]);
  });

  it('notes the alert on the request, once', async () => {
    await act({action: 'notify-admins'});
    expect(writes('update')[0].values).toEqual({admin_notified_at: expect.any(String)});
    expect(eqValue(writes('update')[0], 'id')).toBe('req-1');
  });

  it.each([
    ['there is no request', {request: null}],
    ['the request is no longer pending', {request: {...NOTIFY_ADMINS_REQUEST, status: 'APPROVED'}}],
    ['the admins were already told', {request: {...NOTIFY_ADMINS_REQUEST, admin_notified_at: '2026-10-05T10:00:00Z'}}],
  ])('sends nothing when %s', async (_label, setup) => {
    world(setup);
    expect(await (await act({action: 'notify-admins'})).json()).toEqual({ok: true, emailed: false});
    expect(mailState.outbox).toHaveLength(0);
    nothingWritten();
  });

  it('does not note the alert when the mail could not be sent', async () => {
    mailState.fail = true;
    expect(await (await act({action: 'notify-admins'})).json()).toEqual({ok: true, emailed: false});
    nothingWritten();
  });

  it('escapes what the applicant typed, and shows a dash when there is no department', async () => {
    world({request: {...NOTIFY_ADMINS_REQUEST, full_name: '<img src=x onerror=1>', department: null, organization: {name: '<b>X</b>'}}});
    await act({action: 'notify-admins'});
    const html = mailState.outbox[0].html;
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>X</b>');
    expect(html).toContain('τμήμα <b>—</b>');
  });

  it('points the link at APP_URL when it is set', async () => {
    env.APP_URL = 'https://app.example.gr/';
    await act({action: 'notify-admins'});
    expect(mailState.outbox[0].html).toContain('https://app.example.gr/#/hospital');
  });
});

describe('access-requests: notify-decision (an admin tells the applicant)', () => {
  const decide = (extra: Record<string, unknown> = {}) => act({action: 'notify-decision', request_id: 'req-1', ...extra});
  beforeEach(() => {
    mailOn();
    world({request: DECISION_REQUEST});
  });

  it('answers 404 for a request that does not exist', async () => {
    world({request: null});
    expect((await decide()).status).toBe(404);
  });

  it.each([
    ['a department user', {...ME, role: 'DEPARTMENT'}],
    ['a viewer', {...ME, role: 'VIEWER'}],
    ['an inactive admin', {...ME, active: false}],
    ["an admin of another hospital", {...ME, organization_id: 'org-2'}],
    ['no profile at all', null],
  ])('refuses %s, sending and writing nothing', async (_label, me) => {
    world({request: DECISION_REQUEST, me});
    expect((await decide()).status).toBe(403);
    expect(mailState.outbox).toHaveLength(0);
    nothingWritten();
  });

  it('lets the platform admin (no hospital) decide for any hospital', async () => {
    world({request: DECISION_REQUEST, me: {...ME, organization_id: null}});
    expect(await (await decide()).json()).toEqual({ok: true, emailed: true});
  });

  it.each([
    ['still pending', {...DECISION_REQUEST, status: 'PENDING'}],
    ['waiting for the form', {...DECISION_REQUEST, status: 'PENDING_EMAIL'}],
    ['already announced', {...DECISION_REQUEST, decision_notified_at: '2026-10-05T10:00:00Z'}],
  ])('sends nothing for a request that is %s', async (_label, request) => {
    world({request});
    expect(await (await decide()).json()).toEqual({ok: true, emailed: false});
    expect(mailState.outbox).toHaveLength(0);
    nothingWritten();
  });

  it('tells an approved applicant their username and where to sign in', async () => {
    world({request: DECISION_REQUEST, userCode: 'GN1234'});
    expect(await (await decide()).json()).toEqual({ok: true, emailed: true});
    const mail = mailState.outbox[0];
    expect(mail.to).toBe('giorgos@hospital.gr');
    expect(mail.subject).toBe('Η πρόσβασή σας στο SurgiTrack εγκρίθηκε');
    expect(mail.html).toContain('GN1234');
    expect(mail.html).toContain('ΙΑΣΩ Θεσσαλίας');
    expect(mail.html).toContain(`href="${SITE}"`);
    const lookup = fake.dbCalls().find(c => c.table === 'profiles' && eqValue(c, 'id') === 'user-9');
    expect(lookup).toBeDefined();
  });

  it('tells a rejected applicant, with the admin comment when there is one, escaped', async () => {
    world({request: {...DECISION_REQUEST, status: 'REJECTED', decision_note: '<script>x</script> όχι τώρα'}});
    await decide();
    const mail = mailState.outbox[0];
    expect(mail.subject).toBe('Η αίτησή σας στο SurgiTrack δεν εγκρίθηκε');
    expect(mail.html).toContain('Σχόλιο του διαχειριστή');
    expect(mail.html).toContain('όχι τώρα');
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).not.toContain('GN1234');
  });

  it('leaves out the comment line when there is no comment', async () => {
    world({request: {...DECISION_REQUEST, status: 'REJECTED'}});
    await decide();
    expect(mailState.outbox[0].html).not.toContain('Σχόλιο του διαχειριστή');
  });

  it('notes that the applicant was told only when the mail went out', async () => {
    await decide();
    expect(writes('update')[0].values).toEqual({decision_notified_at: expect.any(String)});
    expect(eqValue(writes('update')[0], 'id')).toBe('req-1');

    fake.calls = [];
    mailState.fail = true;
    expect(await (await decide()).json()).toEqual({ok: true, emailed: false});
    expect(writes('update')).toHaveLength(0);
  });
});

describe('access-requests: cancel-invite (an admin withdraws an invitation)', () => {
  const cancel = () => act({action: 'cancel-invite', request_id: 'req-1'});
  beforeEach(() => world({request: INVITATION}));

  it('deletes an invitation nobody has filled in', async () => {
    expect(await (await cancel()).json()).toEqual({ok: true});
    expect(writes('delete')).toHaveLength(1);
    expect(eqValue(writes('delete')[0], 'id')).toBe('req-1');
  });

  it('answers 404 for a request that does not exist', async () => {
    world({request: null});
    expect((await cancel()).status).toBe(404);
    nothingWritten();
  });

  it.each([
    ['a department user', {...ME, role: 'DEPARTMENT'}],
    ['an inactive admin', {...ME, active: false}],
    ['an admin of another hospital', {...ME, organization_id: 'org-2'}],
    ['no profile at all', null],
  ])('refuses %s, deleting nothing', async (_label, me) => {
    world({request: INVITATION, me});
    expect((await cancel()).status).toBe(403);
    nothingWritten();
  });

  it('lets the platform admin (no hospital) withdraw any hospital invitation', async () => {
    world({request: INVITATION, me: {...ME, organization_id: null}});
    expect((await cancel()).status).toBe(200);
  });

  it.each([
    ['one already filled in and awaiting approval', {...INVITATION, status: 'PENDING'}],
    ['an approved request', {...INVITATION, status: 'APPROVED'}],
    ['a request that already has an account', {...INVITATION, user_id: 'user-9'}],
  ])('never deletes %s', async (_label, request) => {
    world({request});
    const response = await cancel();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({error: 'not_an_invitation'});
    nothingWritten();
  });

  it('reports a failed delete as "failed"', async () => {
    const answers = fake.db;
    fake.db = call => (call.op === 'delete' ? {data: null, error: {message: 'secret internals'}} : answers(call));
    const response = await cancel();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({error: 'failed'});
  });
});
