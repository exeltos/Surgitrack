// @vitest-environment node
import {beforeEach, describe, expect, it} from 'vitest';
import {env, loadFunction, mailState, post, resetFake} from './harness';
import {fake, type DbCall} from './fakes/supabase';

type Handler = (req: Request) => Response | Promise<Response>;
type Row = Record<string, unknown> | null;

const SITE = 'https://surgitrack.eu';
const ADMIN = {id: 'admin-1', role: 'ADMIN', active: true, organization_id: 'org-1'};
const ORG = {id: 'org-1', name: 'ΙΑΣΩ Θεσσαλίας', active: true};

/** Table answers, keyed "table:op" and chosen per query; anything not listed answers nothing. */
type Routes = Record<string, Row | ((call: DbCall) => Row)>;
const filter = (call: DbCall, column: string) => call.filters.find(([op, name]) => op === 'eq' && name === column)?.[2];
const routes = (extra: Routes = {}) => {
  const all: Routes = {
    'profiles:select': call => (filter(call, 'id') === 'admin-1' ? ADMIN : null),
    'organizations:select': ORG,
    ...extra,
  };
  fake.db = call => {
    const answer = all[`${call.table}:${call.op}`];
    return {data: typeof answer === 'function' ? answer(call) : (answer ?? null), error: null};
  };
};
/** Profile lookups: the caller is the admin, the invited email is `existing`. */
const withProfile = (existing: Row): Routes => ({
  'profiles:select': call => (filter(call, 'id') === 'admin-1' ? ADMIN : filter(call, 'email') ? existing : null),
});
const mailOn = () => {
  Object.assign(env, {SMTP_HOST: 'smtp.example', SMTP_USER: 'u', SMTP_PASS: 'p', MAIL_FROM: 'SurgiTrack <no-reply@example.gr>'});
};
const linkFor = (id = 'new-user', token = 'hashed-token') => {
  fake.admin.generateLink = () => ({data: {user: {id}, properties: {hashed_token: token}}, error: null});
};
const codeIs = (code = 'AB1234') => {
  fake.rpc = () => ({data: code, error: null});
};
const invite = (handle: Handler, body: Record<string, unknown>, headers?: Record<string, string>) =>
  handle(post(body, headers));
const result = async (response: Response) => ((await response.json()) as {results: Array<Record<string, unknown>>}).results[0];
const upserts = (table: string) => fake.dbCalls('upsert').filter(c => c.table === table);

let handle: Handler;
beforeEach(async () => {
  resetFake();
  fake.user = {id: 'admin-1'};
  routes();
  handle = await loadFunction('invite-staff');
});

describe('invite-staff: who may invite', () => {
  it('refuses a caller who is not signed in', async () => {
    fake.user = null;
    expect((await invite(handle, {})).status).toBe(401);
  });

  it.each([{role: 'DEPARTMENT', active: true}, {role: 'VIEWER', active: true}, {role: 'ADMIN', active: false}])(
    'refuses %j',
    async profile => {
      routes({'profiles:select': {...ADMIN, ...profile}});
      expect((await invite(handle, {email: 'a@b.gr', organization_id: 'org-1'})).status).toBe(403);
      expect(fake.dbCalls().filter(c => c.op !== 'select')).toHaveLength(0);
    },
  );

  it("refuses a hospital admin inviting into another hospital, before anything is written", async () => {
    const row = await result(await invite(handle, {email: 'a@b.gr', organization_id: 'org-2', direct: true, full_name: 'Μαρία'}));
    expect(row).toMatchObject({ok: false, error: 'Organization not allowed'});
    expect(fake.dbCalls().filter(c => c.op !== 'select')).toHaveLength(0);
    expect(fake.calls.filter(c => ['generateLink', 'inviteUserByEmail'].includes(c.what))).toHaveLength(0);
  });

  it('lets the platform admin (no hospital) invite into any hospital', async () => {
    routes({'profiles:select': call => (filter(call, 'id') === 'admin-1' ? {...ADMIN, organization_id: null} : null)});
    codeIs();
    const row = await result(await invite(handle, {email: 'a@b.gr', organization_id: 'org-1', direct: true, full_name: 'Μαρία'}));
    expect(row.ok).toBe(true);
  });

  it('refuses an inactive hospital', async () => {
    routes({'organizations:select': {...ORG, active: false}});
    const row = await result(await invite(handle, {email: 'a@b.gr', organization_id: 'org-1', direct: true, full_name: 'Μαρία'}));
    expect(row).toMatchObject({ok: false, error: 'Hospital not active'});
  });
});

describe('invite-staff: input', () => {
  it.each([
    {email: 'not-an-email', organization_id: 'org-1'},
    {email: 'a@b.gr'},
    {email: 'a@b.gr', organization_id: 'org-1', role: 'OWNER'},
    {email: 'a@b.gr', organization_id: 'org-1', direct: true, full_name: 'Μ'},
  ])('rejects %j as invalid user data', async body => {
    expect(await result(await invite(handle, body))).toMatchObject({ok: false, error: 'Invalid user data'});
    expect(fake.dbCalls().filter(c => c.op !== 'select')).toHaveLength(0);
  });

  it('refuses an empty list and more than 500 users', async () => {
    expect((await invite(handle, {users: []})).status).toBe(400);
    const many = Array.from({length: 501}, (_, i) => ({email: `u${i}@b.gr`, organization_id: 'org-1'}));
    expect((await invite(handle, {users: many})).status).toBe(400);
  });

  it('answers 400 for a body that is not JSON', async () => {
    const response = await handle(new Request('http://localhost/fn', {method: 'POST', headers: {Authorization: 'Bearer x'}, body: 'nope'}));
    expect(response.status).toBe(400);
  });

  it('reports each user of a list on its own, so one bad row does not stop the rest', async () => {
    codeIs();
    mailOn();
    linkFor();
    const response = await invite(handle, {
      direct: true,
      users: [
        {email: 'bad', organization_id: 'org-1', full_name: 'Μαρία'},
        {email: 'good@b.gr', organization_id: 'org-1', full_name: 'Γιώργος'},
      ],
    });
    const {results} = (await response.json()) as {results: Array<{ok: boolean; email: string}>};
    expect(results.map(r => [r.email, r.ok])).toEqual([
      ['bad', false],
      ['good@b.gr', true],
    ]);
  });
});

describe('invite-staff: an account made at once (hospital admin role or direct list)', () => {
  const body = {email: ' Maria@Hospital.GR ', full_name: ' μαρία   παπά ', organization_id: 'org-1', role: 'DEPARTMENT', direct: true};

  it('makes the inactive profile and the invitation, and emails the username with the accept link', async () => {
    mailOn();
    codeIs('MP1234');
    linkFor('new-user', 'hashed token/1');
    const row = await result(await invite(handle, body));
    expect(row).toMatchObject({ok: true, mode: 'account', user_code: 'MP1234', emailed: true});
    expect(row.url).toBe(`${SITE}/?st_token=hashed%20token%2F1&st_link=invite`);

    expect(upserts('profiles')[0].values).toMatchObject({
      id: 'new-user',
      organization_id: 'org-1',
      name: 'ΜΑΡΙΑ ΠΑΠΑ',
      email: 'maria@hospital.gr',
      role: 'DEPARTMENT',
      user_code: 'MP1234',
      active: false,
      demo_enabled: false,
    });
    expect(upserts('user_invitations')[0].values).toMatchObject({
      auth_user_id: 'new-user',
      email: 'maria@hospital.gr',
      status: 'SENT',
      invited_by: 'admin-1',
    });
    expect(mailState.outbox).toHaveLength(1);
    expect(mailState.outbox[0].to).toBe('maria@hospital.gr');
    expect(mailState.outbox[0].html).toContain('MP1234');
    expect(mailState.outbox[0].html).toContain(row.url as string);
  });

  it('never makes the profile active: only accepting the link does that', async () => {
    mailOn();
    codeIs();
    linkFor();
    await invite(handle, {...body, role: 'ADMIN'});
    expect(upserts('profiles')[0].values).toMatchObject({role: 'ADMIN', active: false});
  });

  it('asks the invited user to the app origin, and a foreign origin falls back to production', async () => {
    mailOn();
    codeIs();
    const requested: string[] = [];
    fake.admin.generateLink = (args: unknown) => {
      requested.push((args as {options: {redirectTo: string}}).options.redirectTo);
      return {data: {user: {id: 'u'}, properties: {hashed_token: 't'}}, error: null};
    };
    for (const redirect_to of ['http://localhost:5174', 'https://evil.example', undefined]) {
      await invite(handle, {...body, email: `${requested.length}@b.gr`, redirect_to});
    }
    expect(requested).toEqual(['http://localhost:5174', SITE, SITE]);
  });

  it('puts only the allowed origin in the emailed link', async () => {
    mailOn();
    codeIs();
    linkFor();
    const row = await result(await invite(handle, {...body, redirect_to: 'https://evil.example'}));
    expect(String(row.url).startsWith(`${SITE}/?st_token=`)).toBe(true);
  });

  it('escapes the hospital name in the email', async () => {
    mailOn();
    codeIs();
    linkFor();
    routes({'organizations:select': {...ORG, name: '<script>alert(1)</script>'}});
    await invite(handle, body);
    const html = mailState.outbox[0].html;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&#60;script&#62;');
  });

  it('reports emailed: false when the mail could not be sent, without failing the invitation', async () => {
    mailOn();
    codeIs();
    linkFor();
    mailState.fail = true;
    const row = await result(await invite(handle, body));
    expect(row).toMatchObject({ok: true, emailed: false});
    expect(upserts('user_invitations')).toHaveLength(1);
  });

  it("falls back to the sign-in service's own invitation email when no mail is set up", async () => {
    codeIs();
    const row = await result(await invite(handle, body));
    expect(row).toMatchObject({ok: true, emailed: true});
    expect(row.url).toBeUndefined();
    expect(fake.calls.filter(c => c.what === 'inviteUserByEmail')).toHaveLength(1);
    expect(fake.calls.filter(c => c.what === 'generateLink')).toHaveLength(0);
    expect(mailState.outbox).toHaveLength(0);
  });

  it('refuses an email that already belongs to an active account', async () => {
    routes(withProfile({id: 'u9', organization_id: 'org-1', active: true, user_code: 'ZZ0000'}));
    expect(await result(await invite(handle, body))).toMatchObject({ok: false, error: 'Email already registered'});
    expect(fake.calls.filter(c => ['generateLink', 'inviteUserByEmail'].includes(c.what))).toHaveLength(0);
  });

  it("refuses an email waiting in another hospital's invitation", async () => {
    routes(withProfile({id: 'u9', organization_id: 'org-2', active: false, user_code: 'ZZ0000'}));
    expect(await result(await invite(handle, body))).toMatchObject({ok: false, error: 'Email already registered'});
  });

  it('re-invites someone still waiting, keeping their username and sending a set-password link', async () => {
    mailOn();
    routes(withProfile({id: 'u9', organization_id: 'org-1', active: false, user_code: 'ZZ0000'}));
    const types: string[] = [];
    fake.admin.generateLink = (args: unknown) => {
      const {type} = args as {type: string};
      types.push(type);
      return type === 'invite'
        ? {data: null, error: {message: 'already registered'}}
        : {data: {user: {id: 'u9'}, properties: {hashed_token: 't2'}}, error: null};
    };
    const row = await result(await invite(handle, body));
    expect(types).toEqual(['invite', 'recovery']);
    expect(row).toMatchObject({ok: true, user_code: 'ZZ0000'});
    expect(String(row.url)).toContain('st_link=recovery');
    expect(fake.calls.filter(c => c.what === 'rpc')).toHaveLength(0);
    expect(upserts('profiles')).toHaveLength(0);
  });

  it('fails when no username can be made, before any account exists', async () => {
    mailOn();
    fake.rpc = () => ({data: null, error: {message: 'nope'}});
    expect(await result(await invite(handle, body))).toMatchObject({ok: false, error: 'Username failed'});
    expect(fake.calls.filter(c => ['generateLink', 'inviteUserByEmail'].includes(c.what))).toHaveLength(0);
  });

  it('gives an admin or viewer no department, and accepts only a department of the same hospital', async () => {
    mailOn();
    codeIs();
    linkFor();
    routes({'departments:select': null});
    const bad = await result(await invite(handle, {...body, department_id: 'dept-x'}));
    expect(bad).toMatchObject({ok: false, error: 'Department not valid'});
    const whole = await result(await invite(handle, {...body, role: 'VIEWER', department_id: 'dept-x'}));
    expect(whole.ok).toBe(true);
    expect(upserts('profiles')[0].values).toMatchObject({department_id: null});
  });

  it('looks departments up only within the hospital and only active ones', async () => {
    mailOn();
    codeIs();
    linkFor();
    routes({'departments:select': {id: 'dept-1', name: 'Χειρουργείο'}});
    await invite(handle, {...body, department_id: 'dept-1'});
    const lookup = fake.dbCalls().find(c => c.table === 'departments');
    expect(lookup?.filters).toContainEqual(['eq', 'organization_id', 'org-1']);
    expect(lookup?.filters).toContainEqual(['eq', 'active', true]);
    expect(mailState.outbox[0].html).toContain('Χειρουργείο');
  });
});

describe('invite-staff: a signup invitation (anyone but an admin, not from a list)', () => {
  const body = {email: 'Nurse@Hospital.gr', organization_id: 'org-1', role: 'DEPARTMENT'};

  it('records a request awaiting the person, and emails the signup form link', async () => {
    mailOn();
    const row = await result(await invite(handle, body));
    expect(row).toMatchObject({ok: true, mode: 'signup', emailed: true});
    const insert = fake.dbCalls('insert').find(c => c.table === 'staff_access_requests');
    const values = insert?.values as Record<string, unknown>;
    expect(values).toMatchObject({
      organization_id: 'org-1',
      email: 'nurse@hospital.gr',
      status: 'PENDING_EMAIL',
      invited_role: 'DEPARTMENT',
      invited_by: 'admin-1',
    });
    expect(values.invite_token).toMatch(/^[0-9a-f]{36}$/);
    expect(row.url).toBe(`${SITE}/#/join/${values.invite_token}`);
    expect(mailState.outbox[0].html).toContain(row.url as string);
  });

  it('makes a different token each time', async () => {
    mailOn();
    await invite(handle, body);
    await invite(handle, {...body, email: 'other@hospital.gr'});
    const tokens = fake.dbCalls('insert').map(c => (c.values as {invite_token: string}).invite_token);
    expect(new Set(tokens).size).toBe(2);
  });

  it('does not invite an email that already has an account', async () => {
    routes(withProfile({id: 'u9'}));
    expect(await result(await invite(handle, body))).toMatchObject({ok: false, error: 'Email already registered'});
    expect(fake.dbCalls('insert')).toHaveLength(0);
  });

  it('does not invite again while a request waits for approval', async () => {
    routes({'staff_access_requests:select': {id: 'r1', status: 'PENDING', invite_token: 't'}});
    expect(await result(await invite(handle, body))).toMatchObject({ok: false, error: 'Request already waiting for approval'});
  });

  it('sends the same link again for an open invitation, changing the role only when asked to', async () => {
    mailOn();
    routes({'staff_access_requests:select': {id: 'r1', status: 'PENDING_EMAIL', invite_token: 'known-token'}});
    const first = await result(await invite(handle, body));
    expect(first.url).toBe(`${SITE}/#/join/known-token`);
    expect(fake.dbCalls('insert')).toHaveLength(0);
    expect(fake.dbCalls('update')).toHaveLength(0);
    await invite(handle, {...body, again: true, role: 'STERILIZATION'});
    const update = fake.dbCalls('update').find(c => c.table === 'staff_access_requests');
    expect(update?.values).toMatchObject({invited_role: 'STERILIZATION'});
    expect(update?.filters).toContainEqual(['eq', 'id', 'r1']);
  });

  it('refuses an open request that has no token to resend', async () => {
    routes({'staff_access_requests:select': {id: 'r1', status: 'PENDING_EMAIL', invite_token: null}});
    expect(await result(await invite(handle, body))).toMatchObject({ok: false, error: 'Request already open'});
  });
});

describe('invite-staff: approving a request', () => {
  const REQUEST = {
    id: 'req-1',
    organization_id: 'org-1',
    user_id: null,
    full_name: 'ΜΑΡΙΑ ΠΑΠΑ',
    email: 'maria@hospital.gr',
    status: 'PENDING',
    department_id: null,
  };
  const approve = (extra: Record<string, unknown> = {}) => invite(handle, {approve_request: 'req-1', role: 'DEPARTMENT', ...extra});
  const asRequest = (request: Row) => routes({'staff_access_requests:select': request});

  it('answers 404 for an unknown request, and 409 unless it awaits approval', async () => {
    asRequest(null);
    expect((await approve()).status).toBe(404);
    asRequest({...REQUEST, status: 'APPROVED'});
    expect((await approve()).status).toBe(409);
    asRequest({...REQUEST, user_id: 'u1'});
    expect((await approve()).status).toBe(409);
  });

  it('needs a valid role', async () => {
    asRequest(REQUEST);
    expect((await approve({role: ''})).status).toBe(400);
    expect((await approve({role: 'OWNER'})).status).toBe(400);
  });

  it("refuses a hospital admin approving another hospital's request", async () => {
    asRequest({...REQUEST, organization_id: 'org-2'});
    const response = await approve();
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({error: 'Organization not allowed'});
    expect(fake.dbCalls().filter(c => c.op !== 'select')).toHaveLength(0);
  });

  it('makes the account, emails the approval, and records who decided and that the person was told', async () => {
    mailOn();
    codeIs('MP1234');
    linkFor('new-user');
    asRequest(REQUEST);
    const response = await approve({supervisor: false});
    expect(await response.json()).toMatchObject({ok: true, user_id: 'new-user', user_code: 'MP1234', emailed: true});
    expect(mailState.outbox[0].subject).toBe('Η πρόσβασή σας στο SurgiTrack εγκρίθηκε');
    const update = fake.dbCalls('update').find(c => c.table === 'staff_access_requests');
    expect(update?.values).toMatchObject({status: 'APPROVED', user_id: 'new-user', granted_role: 'DEPARTMENT', decided_by: 'admin-1'});
    expect((update?.values as {decision_notified_at: unknown}).decision_notified_at).toEqual(expect.any(String));
    expect(update?.filters).toContainEqual(['eq', 'id', 'req-1']);
  });

  it('leaves the person marked as not told when the mail could not be sent', async () => {
    mailOn();
    codeIs();
    linkFor();
    asRequest(REQUEST);
    mailState.fail = true;
    expect(await (await approve()).json()).toMatchObject({ok: true, emailed: false});
    const update = fake.dbCalls('update').find(c => c.table === 'staff_access_requests');
    expect((update?.values as {decision_notified_at: unknown}).decision_notified_at).toBeNull();
  });

  it('uses the department the admin picked over the one requested, only within the hospital', async () => {
    mailOn();
    codeIs();
    linkFor();
    asRequest(REQUEST);
    routes({'staff_access_requests:select': REQUEST, 'departments:select': {id: 'dept-9', name: 'Μονάδα'}});
    await approve({department_id: 'dept-9'});
    expect(upserts('profiles')[0].values).toMatchObject({department_id: 'dept-9'});
    expect(fake.dbCalls().find(c => c.table === 'departments')?.filters).toContainEqual(['eq', 'organization_id', 'org-1']);
  });
});
