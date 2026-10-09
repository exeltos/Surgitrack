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
