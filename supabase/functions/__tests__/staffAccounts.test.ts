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
  const update = (email: string, extra: Record<string, unknown> = {}) =>
    handle(post({user_id: 'user-2', name: 'Nurse', email, ...extra}));
  /** The platform owner (no hospital) is the caller: the one who changes an email at once. */
  const asOwner = (target: Profile) => {
    answer(target);
    const db = fake.db;
    fake.db = call =>
      call.table === 'profiles' && call.op === 'select' && call.filters.some(([op, c, v]) => op === 'eq' && c === 'id' && v === 'admin-1')
        ? {data: {...ADMIN, organization_id: null}, error: null}
        : db(call);
  };

  it('the platform owner changes it at once, records it and tells the old address and the new one', async () => {
    asOwner({...TARGET, role: 'DEPARTMENT'});
    const response = await update('new@hospital.gr');
    expect(response.status).toBe(200);
    const event = fake.dbCalls('insert').find(c => c.table === 'account_events');
    expect(event?.values).toMatchObject({
      target_id: 'user-2',
      actor_id: 'admin-1',
      action: 'email_changed',
      detail: {from: 'Nurse@Hospital.gr', to: 'new@hospital.gr'},
    });
    expect(fake.calls.some(c => c.what === 'updateUserById')).toBe(true);
    expect(mailState.outbox.map(m => m.to)).toEqual(['Nurse@Hospital.gr', 'new@hospital.gr']);
    expect(mailState.outbox[0].html).toContain('άλλαξε από');
    expect(mailState.outbox[1].html).toContain('ορίστηκε σε αυτή τη διεύθυνση');
  });

  it('changes nothing when the change could not be recorded', async () => {
    asOwner({...TARGET, role: 'DEPARTMENT'});
    const db = fake.db;
    fake.db = call => (call.table === 'account_events' ? {data: null, error: {message: 'down'}} : db(call));
    const response = await update('new@hospital.gr');
    expect(response.status).toBe(500);
    expect(fake.calls.some(c => c.what === 'updateUserById')).toBe(false);
    expect(fake.dbCalls('update')).toHaveLength(0);
  });

  describe('a hospital admin: the new address confirms it first', () => {
    const pending = (extra: Record<string, unknown> = {}) => update('new@hospital.gr', {redirect_to: 'https://www.surgitrack.eu', ...extra});

    it('keeps the old email, asks the new address to confirm, and tells the old one', async () => {
      answer({...TARGET, role: 'DEPARTMENT'});
      const response = await pending();
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ok: true, name: 'Nurse', email: 'Nurse@Hospital.gr', pending_email: 'new@hospital.gr'});
      // The sign-in is not touched, and the profile keeps its email.
      expect(fake.calls.some(c => c.what === 'updateUserById')).toBe(false);
      expect(fake.dbCalls('update').find(c => c.table === 'profiles')?.values).toMatchObject({email: 'Nurse@Hospital.gr'});
      const request = fake.dbCalls('insert').find(c => c.table === 'email_change_requests')?.values as Record<string, unknown>;
      expect(request).toMatchObject({organization_id: 'org-1', user_id: 'user-2', new_email: 'new@hospital.gr', requested_by: 'admin-1'});
      // Only the hash of the token is kept; the token itself travels in the email to the NEW address.
      expect(request.token_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(fake.dbCalls('insert').find(c => c.table === 'account_events')?.values).toMatchObject({action: 'email_change_requested'});
      expect(mailState.outbox.map(m => m.to)).toEqual([['new@hospital.gr'].join(), 'Nurse@Hospital.gr']);
      const link = /https:\/\/www\.surgitrack\.eu\/#\/join\/confirm\/([0-9a-f]{48})/.exec(mailState.outbox[0].html);
      expect(link).not.toBeNull();
      expect(JSON.stringify(request)).not.toContain(link![1]);
      expect(mailState.outbox[1].html).toContain('μόνο όταν επιβεβαιωθεί');
    });

    it('replaces an earlier waiting request of the same person', async () => {
      answer({...TARGET, role: 'DEPARTMENT'});
      await pending();
      const deletes = fake.dbCalls('delete').filter(c => c.table === 'email_change_requests');
      expect(deletes[0].filters).toContainEqual(['eq', 'user_id', 'user-2']);
    });

    it('changes nothing when no email can be sent', async () => {
      answer({...TARGET, role: 'DEPARTMENT'});
      for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM']) delete env[key];
      const response = await pending();
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({error: 'email_unavailable'});
      expect(fake.dbCalls('insert')).toHaveLength(0);
      expect(fake.dbCalls('update')).toHaveLength(0);
    });

    it('withdraws the request when the email to the new address fails', async () => {
      answer({...TARGET, role: 'DEPARTMENT'});
      mailState.fail = true;
      const response = await pending();
      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({error: 'email_failed'});
      expect(fake.dbCalls('delete').filter(c => c.table === 'email_change_requests')).toHaveLength(2);
      expect(fake.dbCalls('update')).toHaveLength(0);
    });

    it('changes nothing when the request could not be recorded', async () => {
      answer({...TARGET, role: 'DEPARTMENT'});
      const db = fake.db;
      fake.db = call => (call.table === 'account_events' ? {data: null, error: {message: 'down'}} : db(call));
      expect((await pending()).status).toBe(500);
      expect(mailState.outbox).toHaveLength(0);
      expect(fake.dbCalls('update')).toHaveLength(0);
    });

    it('the platform owner changing the email or the role voids a request made before', async () => {
      asOwner({...TARGET, role: 'DEPARTMENT'});
      await update('other@hospital.gr');
      const voided = fake.dbCalls('delete').filter(c => c.table === 'email_change_requests');
      expect(voided).toHaveLength(1);
      expect(voided[0].filters).toContainEqual(['eq', 'user_id', 'user-2']);
      resetFake();
      fake.user = {id: 'admin-1'};
      asOwner({...TARGET, role: 'DEPARTMENT'});
      await update('nurse@hospital.gr', {role: 'ADMIN'});
      expect(fake.dbCalls('delete').filter(c => c.table === 'email_change_requests')).toHaveLength(1);
    });

    it('but an owner change of something else leaves it', async () => {
      asOwner({...TARGET, role: 'DEPARTMENT'});
      await update('nurse@hospital.gr', {role: 'DEPARTMENT'});
      expect(fake.dbCalls('delete').filter(c => c.table === 'email_change_requests')).toHaveLength(0);
    });

    it('still saves the other fields at once', async () => {
      answer({...TARGET, role: 'DEPARTMENT'});
      const response = await update('nurse@hospital.gr', {role: 'VIEWER'});
      expect(response.status).toBe(200);
      expect(mailState.outbox).toHaveLength(0);
      expect(fake.dbCalls('insert').filter(c => c.table === 'email_change_requests')).toHaveLength(0);
    });
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

describe('another admin\'s account: only the platform owner', () => {
  const PEER = {...TARGET, id: 'user-2', role: 'ADMIN', name: 'Peer Admin', email: 'peer@hospital.gr'};
  const OWNER = {...ADMIN, id: 'admin-1', organization_id: null};
  /** The caller is a hospital admin, or the platform owner (no hospital); the target is another admin. */
  const asCaller = (caller: Profile) => {
    fake.db = (call: DbCall) => {
      if (call.table === 'profiles' && call.op === 'select') {
        const id = call.filters.find(([op, column]) => op === 'eq' && column === 'id')?.[2];
        return {data: id === 'admin-1' ? caller : id === 'user-2' ? PEER : null, error: null};
      }
      return {data: null, error: null};
    };
  };
  const requests: Record<string, (handle: Handler) => Promise<Response>> = {
    'staff-link': handle => handle(post({user_id: 'user-2'})),
    'update-staff': handle => handle(post({user_id: 'user-2', name: 'Peer Admin', email: 'peer@hospital.gr'})),
    'delete-staff': handle => handle(post({user_id: 'user-2'})),
  };

  for (const name of Object.keys(requests)) {
    it(`${name}: a hospital admin is refused, and nothing is changed`, async () => {
      asCaller(ADMIN);
      const response = await requests[name](await loadFunction(name));
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({error: 'owner_only'});
      expect(fake.calls.some(c => ['deleteUser', 'generateLink', 'updateUserById'].includes(c.what))).toBe(false);
      expect(fake.dbCalls('update').length + fake.dbCalls('delete').length).toBe(0);
    });

    it(`${name}: the platform owner may`, async () => {
      asCaller(OWNER);
      const response = await requests[name](await loadFunction(name));
      expect(await response.json()).not.toEqual({error: 'owner_only'});
    });
  }
});

describe('giving the Admin role: only the platform owner', () => {
  const asCaller = (caller: Profile) => {
    fake.db = (call: DbCall) => {
      if (call.table === 'profiles' && call.op === 'select') {
        const id = call.filters.find(([op, column]) => op === 'eq' && column === 'id')?.[2];
        return {data: id === 'admin-1' ? caller : id === 'user-2' ? TARGET : null, error: null};
      }
      return {data: null, error: null};
    };
  };
  const promote = (handle: Handler) =>
    handle(post({user_id: 'user-2', name: TARGET.name, email: TARGET.email, role: 'ADMIN'}));

  it('update-staff: a hospital admin cannot make someone an admin, and nothing is changed', async () => {
    asCaller(ADMIN);
    const response = await promote(await loadFunction('update-staff'));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({error: 'owner_only'});
    expect(fake.dbCalls('update').length).toBe(0);
  });

  it('update-staff: the platform owner may', async () => {
    asCaller({...ADMIN, organization_id: null});
    const response = await promote(await loadFunction('update-staff'));
    expect(response.status).toBe(200);
    expect(fake.dbCalls('update').find(c => c.table === 'profiles')?.values).toMatchObject({role: 'ADMIN'});
  });

  it('update-staff: a hospital admin still sets the other roles', async () => {
    asCaller(ADMIN);
    const response = await (await loadFunction('update-staff'))(
      post({user_id: 'user-2', name: TARGET.name, email: TARGET.email, role: 'VIEWER'}),
    );
    expect(response.status).toBe(200);
  });
});
