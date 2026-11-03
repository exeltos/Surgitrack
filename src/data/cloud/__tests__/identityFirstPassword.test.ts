import {beforeEach, describe, expect, it, vi} from 'vitest';

type Profile = Record<string, unknown> | null;
const db = vi.hoisted(() => ({profile: null as Profile}));
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {getSession: async () => ({data: {session: {user: {id: 'u1', email: 'someone@hospital.gr'}}}})},
    rpc: async () => ({data: false, error: null}),
    from: () => ({select: () => ({eq: () => ({maybeSingle: async () => ({data: db.profile, error: null})})})}),
  },
}));
vi.mock('../../../config/dataMode', () => ({getRuntimeDataMode: () => 'PRODUCTION'}));

const PROFILE = {
  id: 'u1',
  name: 'ΜΑΡΙΑ',
  role: 'DEPARTMENT',
  active: true,
  organization_id: 'org-1',
  department: {name: 'ΧΕΙΡΟΥΡΓΕΙΟ'},
};
const resolve = async () => {
  vi.resetModules();
  const {resolveIdentity} = await import('../identity');
  return resolveIdentity();
};

beforeEach(() => sessionStorage.clear());

describe("the identity of someone the owner's staff import made", () => {
  it('asks for the new password first, with the deadline, instead of opening the app', async () => {
    db.profile = {...PROFILE, password_change_required: true, password_change_deadline: '2026-11-10T00:00:00Z'};
    expect(await resolve()).toEqual({status: 'password-change', deadline: '2026-11-10T00:00:00Z'});
    expect(sessionStorage.getItem('surgitrack-real-user')).toBeNull();
  });

  it('opens the app once the password has been changed', async () => {
    db.profile = {...PROFILE, password_change_required: false, password_change_deadline: null};
    const result = await resolve();
    expect(result.status).toBe('ok');
  });

  it('does not ask anyone who was never held to it', async () => {
    db.profile = PROFILE;
    expect((await resolve()).status).toBe('ok');
  });
});
