// @vitest-environment node
import {beforeEach, describe, expect, it} from 'vitest';
import {answerTables, env, eqValue, loadFunction, mailState, post, resetFake} from './harness';
import {fake} from './fakes/supabase';

type Handler = (req: Request) => Response | Promise<Response>;
type Row = Record<string, unknown> | null;

const SITE = 'https://surgitrack-med.netlify.app';
const IN_AN_HOUR = () => new Date(Date.now() + 3_600_000).toISOString();
const AN_HOUR_AGO = () => new Date(Date.now() - 3_600_000).toISOString();
const LINK = {id: 'link-1', organization_id: 'org-1', expires_at: IN_AN_HOUR(), revoked_at: null};
const ORG = {name: 'ΙΑΣΩ Θεσσαλίας', active: true, is_demo: false};
const DEPARTMENT = {id: 'dept-1', name: 'Χειρουργείο', code: 'XR'};
const INVITATION = {id: 'req-1', organization_id: 'org-1', email: 'invited@hospital.gr', invited_role: 'DEPARTMENT', department_id: null};

type World = {
  link?: Row;
  invitation?: Row;
  open?: Row;
  org?: Row;
  department?: Row;
  account?: Row;
  admins?: Array<{email: string}>;
  /** An earlier hospital-link signup with this email, never confirmed. */
  unconfirmed?: Row;
  /** The request an emailed confirmation link points at. */
  waiting?: Row;
};
/** The database as the form sees it: one signup link, no invitation, no earlier request, nobody registered. */
const world = (w: World = {}) => {
  const has = (key: keyof World) => key in w;
  answerTables({
    'signup_links:select': has('link') ? w.link : LINK,
    'organizations:select': has('org') ? w.org : ORG,
    'staff_access_requests:select': (call: {filters: Array<[string, string, unknown]>}) =>
      call.filters.some(([, column]) => column === 'invite_token')
        ? (w.invitation ?? null)
        : call.filters.some(([op, column]) => op === 'eq' && column === 'confirm_token')
          ? (w.waiting ?? null)
          : call.filters.some(([, column]) => column === 'user_id')
            ? (w.unconfirmed ?? null)
            : (w.open ?? null),
    'departments:select': (call: {filters: Array<[string, string, unknown]>}) =>
      call.filters.some(([, column]) => column === 'id') ? (has('department') ? w.department : DEPARTMENT) : [DEPARTMENT],
    'profiles:select': (call: {filters: Array<[string, string, unknown]>}) =>
      call.filters.some(([, column]) => column === 'role')
        ? (w.admins ?? [{email: 'admin@hospital.gr'}])
        : fake.dbCalls('delete').some(c => c.table === 'profiles')
          ? null
          : (w.account ?? null),
  });
  fake.rpc = name => ({data: name === 'generate_user_code' ? 'GN1234' : 'attempt-1', error: null});
};
const mailOn = () => {
  Object.assign(env, {SMTP_HOST: 'smtp.example', SMTP_USER: 'u', SMTP_PASS: 'p', MAIL_FROM: 'SurgiTrack <no-reply@example.gr>'});
};
const form = {
  token: 'link-token',
  first_name: 'Γιώργος',
  last_name: 'Νικολάου',
  email: 'Giorgos@Hospital.GR',
  department_id: 'dept-1',
  password: 'secret-123',
};
const requests = (op: 'insert' | 'update') => fake.dbCalls(op).filter(c => c.table === 'staff_access_requests');

let handle: Handler;
beforeEach(async () => {
  resetFake();
  world();
  handle = await loadFunction('staff-signup');
});

describe('staff-signup: the link', () => {
  it('answers the browser preflight and refuses other methods', async () => {
    expect((await handle(new Request('http://localhost/fn', {method: 'OPTIONS'}))).status).toBe(200);
    expect((await handle(new Request('http://localhost/fn', {method: 'GET'}))).status).toBe(405);
  });

  it.each([
    ['no token', {token: ''}, {}],
    ['an unknown token', {}, {link: null}],
    ['an expired link', {}, {link: {...LINK, expires_at: AN_HOUR_AGO()}}],
    ['a revoked link', {}, {link: {...LINK, revoked_at: AN_HOUR_AGO()}}],
    ['an inactive hospital', {}, {org: {...ORG, active: false}}],
    ['a demo hospital', {}, {org: {...ORG, is_demo: true}}],
    ['a hospital that is not there', {}, {org: null}],
  ])('answers 410 for %s, and writes nothing', async (_label, override, setup) => {
    world(setup as World);
    const response = await handle(post({...form, ...override}));
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({error: 'link_invalid'});
    expect(fake.dbCalls().filter(c => c.op !== 'select')).toHaveLength(0);
    expect(fake.calls.filter(c => c.what === 'rpc')).toHaveLength(0);
  });

  it('answers 503 when the link cannot be looked up, not "invalid"', async () => {
    fake.db = () => ({data: null, error: {message: 'down'}});
    expect((await handle(post(form))).status).toBe(503);
  });

  it('accepts a personal invitation token, only while it still waits for the form', async () => {
    world({link: null, invitation: INVITATION});
    expect((await handle(post({...form, action: 'info'}))).status).toBe(200);
    const lookup = fake.dbCalls().find(c => c.table === 'staff_access_requests');
    expect(eqValue(lookup!, 'invite_token')).toBe('link-token');
    expect(eqValue(lookup!, 'status')).toBe('PENDING_EMAIL');
    expect(lookup?.filters).toContainEqual(['is', 'user_id', null]);
  });
});

describe('staff-signup: what the form shows', () => {
  it('lists the hospital name and its active departments', async () => {
    const body = await (await handle(post({token: 'link-token', action: 'info'}))).json();
    expect(body).toMatchObject({
      organization_name: 'ΙΑΣΩ Θεσσαλίας',
      expires_at: LINK.expires_at,
      email: null,
      needs_department: true,
      departments: [DEPARTMENT],
    });
    const lookup = fake.dbCalls().find(c => c.table === 'departments');
    expect(lookup?.filters).toContainEqual(['eq', 'organization_id', 'org-1']);
    expect(lookup?.filters).toContainEqual(['eq', 'active', true]);
  });

  it('shows the invited email, and no department for an admin or viewer', async () => {
    world({link: null, invitation: {...INVITATION, invited_role: 'VIEWER'}});
    const body = await (await handle(post({token: 'link-token', action: 'info'}))).json();
    expect(body).toMatchObject({email: 'invited@hospital.gr', expires_at: null, needs_department: false});
  });

  it('asks an invited department user for a department', async () => {
    world({link: null, invitation: INVITATION});
    expect(await (await handle(post({token: 'link-token', action: 'info'}))).json()).toMatchObject({needs_department: true});
  });

  it('only reads: no limiter, no writes', async () => {
    await handle(post({token: 'link-token', action: 'info'}));
    expect(fake.calls.filter(c => c.what === 'rpc')).toHaveLength(0);
    expect(fake.dbCalls().filter(c => c.op !== 'select')).toHaveLength(0);
  });
});

describe('staff-signup: checking the form', () => {
  it.each([
    ['a first name with a digit', {first_name: 'Γιώργος3'}],
    ['a last name with a symbol', {last_name: 'Νικολάου!'}],
    ['an empty first name', {first_name: '  '}],
    ['a missing last name', {last_name: undefined}],
    ['a name with markup', {first_name: '<b>Γιώργος</b>'}],
    ['an email without a domain', {email: 'giorgos@'}],
    ['no email', {email: ''}],
    ['no department', {department_id: ''}],
  ])('rejects %s before the limiter or any write', async (_label, override) => {
    const response = await handle(post({...form, ...override}));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({error: 'invalid_input'});
    expect(fake.calls.filter(c => c.what === 'rpc')).toHaveLength(0);
    expect(fake.dbCalls().filter(c => c.op !== 'select')).toHaveLength(0);
  });

  it.each([
    ['a short password', {password: 'short'}],
    ['no password', {password: undefined}],
    ['an overlong password', {password: 'x'.repeat(73)}],
  ])('rejects %s before the limiter or any write', async (_label, override) => {
    const response = await handle(post({...form, ...override}));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({error: 'password_invalid'});
    expect(fake.calls.filter(c => ['rpc', 'createUser'].includes(c.what))).toHaveLength(0);
  });

  it.each(['ΜΑΡΙΑ-ΕΛΕΝΗ', 'ΜΑΡΙΑ ΕΛΕΝΗ', 'MARIA'])('accepts the name %s', async first => {
    expect((await handle(post({...form, first_name: first}))).status).toBe(200);
  });

  it('stores names in capitals, Greek style, with single spaces', async () => {
    await handle(post({...form, first_name: ' μαρία   ελένη ', last_name: 'παπαδοπούλου'}));
    expect(requests('insert')[0].values).toMatchObject({full_name: 'ΜΑΡΙΑ ΕΛΕΝΗ ΠΑΠΑΔΟΠΟΥΛΟΥ'});
  });
});

describe('staff-signup: throttling', () => {
  it('stops with 429 when the limit is reached, writing nothing', async () => {
    fake.rpc = () => ({data: null, error: null});
    const response = await handle(post(form));
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({error: 'too_many_attempts'});
    expect(fake.dbCalls().filter(c => c.op !== 'select')).toHaveLength(0);
  });

  it('fails closed when the limiter is unavailable', async () => {
    fake.rpc = () => ({data: null, error: {message: 'down'}});
    expect((await handle(post(form))).status).toBe(503);
    expect(fake.dbCalls().filter(c => c.op !== 'select')).toHaveLength(0);
  });

  it('allows 10 signups an hour per address, counted by the address Cloudflare reports', async () => {
    await handle(post(form, {'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': '6.6.6.6'}));
    expect(fake.calls.find(c => c.what === 'rpc')?.args[1]).toMatchObject({
      p_user_code: 'SIGNUP',
      p_ip: 'signup:203.0.113.9',
      p_window_minutes: 60,
      p_max_ip_fails: 10,
    });
  });
});

describe('staff-signup: signing up through the hospital link', () => {
  it('records a request awaiting approval, for the hospital the link belongs to', async () => {
    const response = await handle(post(form));
    expect(response.status).toBe(200);
    // Without mail settings nothing can be confirmed by email: straight to the admin, as before.
    expect(await response.json()).toEqual({ok: true, user_code: 'GN1234', confirm: false});
    expect(requests('insert')).toHaveLength(1);
    expect(requests('insert')[0].values).toMatchObject({
      organization_id: 'org-1',
      email: 'giorgos@hospital.gr',
      full_name: 'ΓΙΩΡΓΟΣ ΝΙΚΟΛΑΟΥ',
      department_id: 'dept-1',
      status: 'PENDING',
      signup_link_id: 'link-1',
    });
  });

  it('never takes the hospital from the request body', async () => {
    await handle(post({...form, organization_id: 'org-2'}));
    expect(requests('insert')[0].values).toMatchObject({organization_id: 'org-1'});
  });

  it('marks the throttle attempt as succeeded', async () => {
    await handle(post(form));
    const update = fake.dbCalls('update').find(c => c.table === 'login_attempts');
    expect(update?.values).toEqual({succeeded: true});
    expect(eqValue(update!, 'id')).toBe('attempt-1');
  });

  it('only accepts an active department of the same hospital', async () => {
    world({department: null});
    const response = await handle(post(form));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({error: 'department_invalid'});
    expect(requests('insert')).toHaveLength(0);
    const lookup = fake.dbCalls().find(c => c.table === 'departments' && eqValue(c, 'id'));
    expect(lookup?.filters).toContainEqual(['eq', 'organization_id', 'org-1']);
    expect(lookup?.filters).toContainEqual(['eq', 'active', true]);
  });

  it('refuses an email that already has an account', async () => {
    world({account: {id: 'u1'}});
    const response = await handle(post(form));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({error: 'email_exists'});
    expect(requests('insert')).toHaveLength(0);
  });

  it('refuses a second request while one waits for approval', async () => {
    world({open: {id: 'r9', status: 'PENDING'}});
    const response = await handle(post(form));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({error: 'already_pending'});
    expect(requests('insert')).toHaveLength(0);
    expect(requests('update')).toHaveLength(0);
  });

  it('fills in the open invitation for that email instead of adding a second request', async () => {
    world({open: {id: 'r9', status: 'PENDING_EMAIL'}});
    await handle(post(form));
    expect(requests('insert')).toHaveLength(0);
    expect(requests('update')[0].values).toMatchObject({status: 'PENDING', full_name: 'ΓΙΩΡΓΟΣ ΝΙΚΟΛΑΟΥ'});
    expect(eqValue(requests('update')[0], 'id')).toBe('r9');
  });

  it('reports a failed write as signup_failed, without details', async () => {
    const answers = fake.db;
    fake.db = call => (call.op === 'insert' ? {data: null, error: {message: 'secret internals'}} : answers(call));
    const response = await handle(post(form));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({error: 'signup_failed'});
  });

  it('reports an unexpected error as signup_failed, without details', async () => {
    fake.db = () => {
      throw new Error('secret internals');
    };
    const response = await handle(post(form));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({error: 'signup_failed'});
  });
});

describe('staff-signup: signing up from a personal invitation', () => {
  beforeEach(() => world({link: null, invitation: INVITATION}));

  it('fills in the invited request, and keeps the invited email whatever the form says', async () => {
    const response = await handle(post({...form, email: 'someone-else@evil.example'}));
    expect(response.status).toBe(200);
    expect(requests('insert')).toHaveLength(0);
    const update = requests('update')[0];
    expect(update.values).toMatchObject({status: 'PENDING', full_name: 'ΓΙΩΡΓΟΣ ΝΙΚΟΛΑΟΥ', department_id: 'dept-1'});
    expect(eqValue(update, 'id')).toBe('req-1');
    expect(eqValue(update, 'status')).toBe('PENDING_EMAIL');
    const lookup = fake.dbCalls().find(c => c.table === 'profiles' && eqValue(c, 'email'));
    expect(eqValue(lookup!, 'email')).toBe('invited@hospital.gr');
  });

  it('needs no email on the form', async () => {
    expect((await handle(post({...form, email: undefined}))).status).toBe(200);
  });

  it('gives an invited admin or viewer no department, and does not ask for one', async () => {
    world({link: null, invitation: {...INVITATION, invited_role: 'ADMIN'}});
    const response = await handle(post({...form, department_id: undefined}));
    expect(response.status).toBe(200);
    expect(requests('update')[0].values).toMatchObject({department_id: null});
    expect(fake.dbCalls().filter(c => c.table === 'departments')).toHaveLength(0);
  });

  it('refuses an invited email that has an account by now', async () => {
    world({link: null, invitation: INVITATION, account: {id: 'u1'}});
    expect((await handle(post(form))).status).toBe(409);
    expect(requests('update')).toHaveLength(0);
  });
});

describe('staff-signup: the account and username', () => {
  beforeEach(mailOn);

  it('makes the account with the chosen password, inactive and unconfirmed, and returns its username', async () => {
    const response = await handle(post(form));
    expect(await response.json()).toEqual({ok: true, user_code: 'GN1234', confirm: true});
    expect(fake.calls.find(c => c.what === 'rpc' && c.args[0] === 'generate_user_code')?.args[1]).toEqual({
      p_name: 'ΓΙΩΡΓΟΣ ΝΙΚΟΛΑΟΥ',
    });
    expect(fake.calls.find(c => c.what === 'createUser')?.args[0]).toMatchObject({
      email: 'giorgos@hospital.gr',
      password: 'secret-123',
      email_confirm: false,
    });
    const profile = fake.dbCalls('insert').find(c => c.table === 'profiles');
    expect(profile?.values).toMatchObject({
      id: 'new-user',
      organization_id: 'org-1',
      department_id: 'dept-1',
      email: 'giorgos@hospital.gr',
      user_code: 'GN1234',
      active: false,
    });
    expect(requests('insert')[0].values).toMatchObject({user_id: 'new-user', user_code: 'GN1234'});
  });

  it('takes the role the admin invited with', async () => {
    world({link: null, invitation: {...INVITATION, invited_role: 'STERILIZATION'}});
    await handle(post(form));
    expect(fake.dbCalls('insert').find(c => c.table === 'profiles')?.values).toMatchObject({role: 'STERILIZATION'});
  });

  it('emails only the person who signed up, to confirm; never the admins', async () => {
    await handle(post(form));
    expect(mailState.outbox.map(m => m.to)).toEqual(['giorgos@hospital.gr']);
  });

  it('answers 409 when the sign-in service already has that email', async () => {
    fake.admin.createUser = () => ({data: null, error: {message: 'A user with this email address has already been registered'}});
    const response = await handle(post(form));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({error: 'email_exists'});
    expect(fake.dbCalls('insert')).toHaveLength(0);
  });

  it('removes the new account when the request cannot be written', async () => {
    const answers = fake.db;
    fake.db = call =>
      call.op === 'insert' && call.table === 'staff_access_requests' ? {data: null, error: {message: 'x'}} : answers(call);
    expect((await handle(post(form))).status).toBe(500);
    expect(fake.calls.find(c => c.what === 'deleteUser')?.args[0]).toBe('new-user');
    expect(fake.dbCalls('delete').find(c => c.table === 'profiles')).toBeTruthy();
  });

  it('refuses a personal invitation older than 7 days', async () => {
    world({link: null, invitation: {...INVITATION, invited_at: new Date(Date.now() - 8 * 864e5).toISOString()}});
    expect((await handle(post(form))).status).toBe(410);
    world({link: null, invitation: {...INVITATION, invited_at: new Date(Date.now() - 6 * 864e5).toISOString()}});
    expect((await handle(post(form))).status).toBe(200);
  });
});

describe('staff-signup: a prospect evaluation Demo', () => {
  const DEMO_ORG = {...ORG, is_demo: true, evaluation: true};

  it("takes a colleague's personal invitation, but never the hospital link", async () => {
    world({link: null, invitation: INVITATION, org: DEMO_ORG});
    expect((await handle(post(form))).status).toBe(200);
    world({org: DEMO_ORG});
    expect((await handle(post(form))).status).toBe(410);
  });

  it('refuses any other Demo hospital', async () => {
    world({link: null, invitation: INVITATION, org: {...ORG, is_demo: true, evaluation: false}});
    expect((await handle(post(form))).status).toBe(410);
  });

  it('says so when the Demo is full, and removes the new account', async () => {
    world({link: null, invitation: INVITATION, org: DEMO_ORG});
    const answers = fake.db;
    fake.db = call =>
      call.op === 'insert' && call.table === 'profiles'
        ? {data: null, error: {message: 'demo_user_limit'}}
        : answers(call);
    const response = await handle(post(form));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({error: 'demo_user_limit'});
    expect(fake.calls.find(c => c.what === 'deleteUser')?.args[0]).toBe('new-user');
  });
});

describe('staff-signup: confirming the email (hospital link)', () => {
  beforeEach(mailOn);
  const confirm = (token = 'c0ffee') => handle(post({action: 'confirm', token}));
  const WAITING = {id: 'req-7', user_id: 'user-7', organization_id: 'org-1', requested_at: AN_HOUR_AGO()};

  it('keeps the request from the admin until the emailed link is opened', async () => {
    await handle(post(form));
    const row = requests('insert')[0].values as Record<string, unknown>;
    expect(row.status).toBe('PENDING_EMAIL');
    expect(row.confirm_token).toMatch(/^[0-9a-f]{36}$/);
    const mail = mailState.outbox[0];
    expect(mail.html).toContain(`${SITE}/#/join/confirm/${row.confirm_token}`);
    expect(mail.html).toContain('ΓΙΩΡΓΟΣ ΝΙΚΟΛΑΟΥ');
  });

  it('points the link at the app the form was filled in on', async () => {
    await handle(post({...form, origin: 'https://www.surgitrack.eu'}));
    expect(mailState.outbox[0].html).toContain('https://www.surgitrack.eu/#/join/confirm/');
  });

  it('asks nothing of a personal invitation: the admin chose that address', async () => {
    world({link: null, invitation: INVITATION});
    const response = await handle(post(form));
    expect(await response.json()).toMatchObject({confirm: false});
    expect(fake.calls.find(c => c.what === 'createUser')?.args[0]).toMatchObject({email_confirm: true});
    expect(requests('update')[0].values).toMatchObject({status: 'PENDING', confirm_token: null});
    expect(mailState.outbox).toHaveLength(0);
  });

  it('says so when the confirmation email could not be sent', async () => {
    mailState.fail = true;
    const response = await handle(post(form));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({error: 'email_failed'});
  });

  it('confirms the sign-in email and hands the request to the admin', async () => {
    world({waiting: WAITING});
    const response = await confirm();
    expect(await response.json()).toEqual({ok: true, organization_name: 'ΙΑΣΩ Θεσσαλίας'});
    expect(fake.calls.find(c => c.what === 'updateUserById')?.args).toEqual(['user-7', {email_confirm: true}]);
    const update = requests('update')[0];
    expect(update.values).toMatchObject({status: 'PENDING', confirm_token: null});
    expect(eqValue(update, 'id')).toBe('req-7');
  });

  it.each([
    ['an unknown link', null],
    ['a link older than 7 days', {...WAITING, requested_at: new Date(Date.now() - 8 * 864e5).toISOString()}],
  ])('refuses %s, changing nothing', async (_label, waiting) => {
    world({waiting});
    const response = await confirm();
    expect(response.status).toBe(410);
    expect(fake.calls.some(c => c.what === 'updateUserById')).toBe(false);
    expect(requests('update')).toHaveLength(0);
  });

  it('lets the owner of an address sign up over an unconfirmed signup someone made with it', async () => {
    world({account: {id: 'squatter', active: false}, unconfirmed: {id: 'req-old'}});
    const response = await handle(post(form));
    expect(response.status).toBe(200);
    expect(fake.dbCalls('delete').map(c => c.table)).toEqual(['staff_access_requests', 'profiles']);
    expect(fake.calls.filter(c => c.what === 'deleteUser').map(c => c.args[0])).toEqual(['squatter']);
  });

  it('never removes an account in use or a signup already confirmed', async () => {
    world({account: {id: 'someone', active: true}});
    expect((await handle(post(form))).status).toBe(409);
    world({account: {id: 'someone', active: false}, unconfirmed: null});
    expect((await handle(post(form))).status).toBe(409);
    expect(fake.calls.some(c => c.what === 'deleteUser')).toBe(false);
  });
});
