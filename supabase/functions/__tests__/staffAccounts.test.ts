// @vitest-environment node
import {beforeEach, describe, expect, it} from 'vitest';
import {loadFunction, post, resetFake} from './harness';
import {fake, type DbCall} from './fakes/supabase';

type Handler = (req: Request) => Response | Promise<Response>;
type Profile = Record<string, unknown>;

const ADMIN = {id: 'admin-1', role: 'ADMIN', active: true, organization_id: 'org-1'};
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

  it('makes a set-new-password link for an active user, without sending any email', async () => {
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

  it('reports link_failed when no link could be made', async () => {
    answer(TARGET);
    fake.admin.generateLink = () => ({data: null, error: {message: 'nope'}});
    const response = await linkRequest();
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({error: 'link_failed'});
  });
});
