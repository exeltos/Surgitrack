// @vitest-environment node
import {beforeEach, describe, expect, it} from 'vitest';
import {env, loadFunction, mailState, post, resetFake} from './harness';
import {fake, type DbCall} from './fakes/supabase';

type Handler = (req: Request) => Response | Promise<Response>;
type Profile = Record<string, unknown>;

const ADMIN = {id: 'admin-1', name: 'Admin One', role: 'ADMIN', active: true, organization_id: 'org-1'};
const TARGET = {id: 'user-2', organization_id: 'org-1', name: 'Nurse', email: 'Nurse@Hospital.gr', active: true};

const answer = (target: Profile, invitation: Profile | null = null) => {
  fake.db = (call: DbCall) => {
    if (call.table === 'profiles' && call.op === 'select') {
      const id = call.filters.find(([op, column]) => op === 'eq' && column === 'id')?.[2];
      return {data: id === 'admin-1' ? ADMIN : id === 'user-2' ? target : null, error: null};
    }
    if (call.table === 'user_invitations' && call.op === 'select') return {data: invitation, error: null};
    return {data: null, error: null};
  };
};

beforeEach(() => {
  resetFake();
  fake.user = {id: 'admin-1'};
});

describe('delete-staff', () => {
  let handle: Handler;
  beforeEach(async () => {
    handle = await loadFunction('delete-staff');
  });

  it("deletes the sign-in, the profile, and that hospital's invitation and requests for the email", async () => {
    answer(TARGET);
    const response = await handle(post({user_id: 'user-2'}));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ok: true, name: 'Nurse'});
    expect(fake.calls.filter(c => c.what === 'deleteUser').map(c => c.args[0])).toEqual(['user-2']);
    const deletes = fake.dbCalls('delete');
    expect(deletes.map(c => c.table)).toEqual(['profiles', 'user_invitations', 'staff_access_requests']);
    for (const call of deletes.slice(1)) {
      expect(call.filters).toContainEqual(['eq', 'organization_id', 'org-1']);
      expect(call.filters).toContainEqual(['eq', 'email', 'nurse@hospital.gr']);
    }
  });

  it('keeps invitations the user sent, only detaching them', async () => {
    answer(TARGET);
    await handle(post({user_id: 'user-2'}));
    const detach = fake.dbCalls('update').find(c => c.table === 'user_invitations');
    expect(detach?.values).toEqual({invited_by: null});
    expect(detach?.filters).toContainEqual(['eq', 'invited_by', 'user-2']);
  });

  it('keeps the profile when the sign-in could not be deleted', async () => {
    answer(TARGET);
    fake.admin.deleteUser = () => ({error: {message: 'boom'}});
    const response = await handle(post({user_id: 'user-2'}));
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({error: 'delete_failed'});
    expect(fake.dbCalls('delete')).toHaveLength(0);
  });
});

describe('staff-link', () => {
  let handle: Handler;
  beforeEach(async () => {
    handle = await loadFunction('staff-link');
  });
  const linkRequest = (origin?: string) => handle(post({user_id: 'user-2', origin}));
  const generated = () => fake.calls.filter(c => c.what === 'generateLink').map(c => c.args[0] as {type: string; options: {redirectTo: string}});

  it('makes a set-new-password link for an active user and hands it back', async () => {
    answer(TARGET);
    const response = await linkRequest('https://surgitrack-med.netlify.app');
    const body = await response.json();
    expect(body).toMatchObject({ok: true, kind: 'recovery'});
    expect(body.url).toBe('https://surgitrack-med.netlify.app/?st_token=tok&st_link=recovery');
    expect(generated().map(g => g.type)).toEqual(['recovery']);
  });

  it('makes an invitation link for someone who has not accepted yet', async () => {
    answer({...TARGET, active: false}, {id: 'invitation-1'});
    const body = await (await linkRequest()).json();
    expect(body.kind).toBe('invite');
    expect(generated().map(g => g.type)).toEqual(['invite']);
  });

  it('falls back to a password link when the invitation was already accepted', async () => {
    answer({...TARGET, active: false}, {id: 'invitation-1'});
    let first = true;
    fake.admin.generateLink = () => {
      if (first) {
        first = false;
        return {data: null, error: {message: 'already registered'}};
      }
      return {data: {properties: {hashed_token: 'tok2'}}, error: null};
    };
    const body = await (await linkRequest()).json();
    expect(body).toMatchObject({kind: 'recovery'});
    expect(body.url).toContain('st_token=tok2&st_link=recovery');
    expect(generated().map(g => g.type)).toEqual(['invite', 'recovery']);
  });

  it.each(['https://deploy-preview-55--surgitrack-med.netlify.app', 'http://localhost:5174'])('points the link at the app origin %s', async origin => {
    answer(TARGET);
    const body = await (await linkRequest(origin)).json();
    expect(body.url.startsWith(`${origin}/?st_token=`)).toBe(true);
  });

  it.each(['https://evil.example', 'https://surgitrack-med.netlify.app.evil.example', 'javascript:alert(1)', undefined])(
    'never points the link at a foreign origin (%s)',
    async origin => {
      answer(TARGET);
      const body = await (await linkRequest(origin)).json();
      expect(body.url.startsWith('https://surgitrack-med.netlify.app/?st_token=')).toBe(true);
      expect(generated().every(g => g.options.redirectTo === 'https://surgitrack-med.netlify.app')).toBe(true);
    },
  );

  it('answers not_found for a user with no email', async () => {
    answer({...TARGET, email: null});
    expect((await linkRequest()).status).toBe(404);
  });

  it('records every link and tells the person by email', async () => {
    Object.assign(env, {SMTP_HOST: 'smtp.test', SMTP_USER: 'u', SMTP_PASS: 'p', MAIL_FROM: 'app@test'});
    answer(TARGET);
    await linkRequest();
    const event = fake.dbCalls('insert').find(c => c.table === 'account_events');
    expect(event?.values).toEqual({
      organization_id: 'org-1',
      target_id: 'user-2',
      actor_id: 'admin-1',
      action: 'password_link',
      detail: {},
    });
    expect(mailState.outbox).toHaveLength(1);
    expect(mailState.outbox[0].to).toBe('Nurse@Hospital.gr');
    expect(mailState.outbox[0].html).toContain('Admin One');
    expect(mailState.outbox[0].html).not.toContain('st_token');
  });

  it('gives no link when it could not be recorded', async () => {
    answer(TARGET);
    const db = fake.db;
    fake.db = call => (call.table === 'account_events' ? {data: null, error: {message: 'down'}} : db(call));
    const response = await linkRequest();
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({error: 'audit_failed'});
  });

  it('reports link_failed when no link could be made', async () => {
    answer(TARGET);
    fake.admin.generateLink = () => ({data: null, error: {message: 'nope'}});
    const response = await linkRequest();
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({error: 'link_failed'});
  });
});

describe('update-staff: the sign-in email', () => {
  let handle: Handler;
  beforeEach(async () => {
    handle = await loadFunction('update-staff');
    Object.assign(env, {SMTP_HOST: 'smtp.test', SMTP_USER: 'u', SMTP_PASS: 'p', MAIL_FROM: 'app@test'});
  });
  const update = (email: string) => handle(post({user_id: 'user-2', name: 'Nurse', email}));

  it('records the change and tells the old address and the new one', async () => {
    answer({...TARGET, role: 'DEPARTMENT'});
    const response = await update('new@hospital.gr');
    expect(response.status).toBe(200);
    const event = fake.dbCalls('insert').find(c => c.table === 'account_events');
    expect(event?.values).toMatchObject({
      target_id: 'user-2',
      actor_id: 'admin-1',
      action: 'email_changed',
      detail: {from: 'Nurse@Hospital.gr', to: 'new@hospital.gr'},
    });
    expect(mailState.outbox.map(m => m.to)).toEqual(['Nurse@Hospital.gr', 'new@hospital.gr']);
    expect(mailState.outbox[0].html).toContain('άλλαξε από');
    expect(mailState.outbox[1].html).toContain('ορίστηκε σε αυτή τη διεύθυνση');
  });

  it('changes nothing when the change could not be recorded', async () => {
    answer({...TARGET, role: 'DEPARTMENT'});
    const db = fake.db;
    fake.db = call => (call.table === 'account_events' ? {data: null, error: {message: 'down'}} : db(call));
    const response = await update('new@hospital.gr');
    expect(response.status).toBe(500);
    expect(fake.calls.some(c => c.what === 'updateUserById')).toBe(false);
    expect(fake.dbCalls('update')).toHaveLength(0);
  });

  it('records nothing and sends nothing when the email stays the same', async () => {
    answer({...TARGET, role: 'DEPARTMENT'});
    expect((await update('nurse@hospital.gr')).status).toBe(200);
    expect(fake.dbCalls('insert')).toHaveLength(0);
    expect(mailState.outbox).toHaveLength(0);
  });
});

describe('update-staff: an unconfirmed signup', () => {
  let handle: Handler;
  beforeEach(async () => {
    handle = await loadFunction('update-staff');
  });
  const activate = () => handle(post({user_id: 'user-2', name: 'Nurse', email: 'nurse@hospital.gr', active: true}));
  const withRequest = (request: Profile | null) => {
    answer({...TARGET, active: false, role: 'DEPARTMENT'});
    const db = fake.db;
    fake.db = call =>
      call.table === 'staff_access_requests' && call.op === 'select' ? {data: request ? [request] : [], error: null} : db(call);
  };

  it('is not activated while its email is not confirmed', async () => {
    withRequest({id: 'req-1'});
    const response = await activate();
    expect(response.status).toBe(412);
    expect(fake.dbCalls('update')).toHaveLength(0);
  });

  it('is activated as before when no signup waits for its email', async () => {
    withRequest(null);
    expect((await activate()).status).toBe(200);
    expect(fake.dbCalls('update').find(c => c.table === 'profiles')?.values).toMatchObject({active: true});
  });
});
