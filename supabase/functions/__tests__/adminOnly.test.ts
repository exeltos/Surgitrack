// @vitest-environment node
import {beforeEach, describe, expect, it} from 'vitest';
import {loadFunction, post, resetFake} from './harness';
import {fake, type DbCall} from './fakes/supabase';

type Handler = (req: Request) => Response | Promise<Response>;
type Profile = Record<string, unknown>;

const ADMIN = {id: 'admin-1', role: 'ADMIN', active: true, organization_id: 'org-1'};
const TARGET = {
  id: 'user-2',
  organization_id: 'org-1',
  name: 'Nurse',
  email: 'nurse@hospital.gr',
  role: 'DEPARTMENT',
  active: true,
  supervisor: false,
  department_id: null,
  demo_enabled: false,
};

/** Answers the two profile lookups every admin function makes: the caller's, then the target's. */
const profiles = (me: Profile | null, target: Profile | null) => {
  fake.db = (call: DbCall) => {
    if (call.table !== 'profiles' || call.op !== 'select') return {data: null, error: null};
    const id = call.filters.find(([op, column]) => op === 'eq' && column === 'id')?.[2];
    return {data: id === fake.user?.id ? me : id === 'user-2' ? target : null, error: null};
  };
};

// The same gate guards every function that changes someone else's account.
const FUNCTIONS: Array<{name: string; extra?: Record<string, unknown>; selfStatus: number}> = [
  {name: 'delete-staff', selfStatus: 409},
  {name: 'staff-link', selfStatus: 403},
  {name: 'update-staff', extra: {name: 'Nurse', email: 'nurse@hospital.gr'}, selfStatus: 403},
];

describe.each(FUNCTIONS)('$name: who may act', ({name, extra, selfStatus}) => {
  let handle: Handler;
  const call = (userId = 'user-2') => handle(post({user_id: userId, ...extra}));

  beforeEach(async () => {
    resetFake();
    fake.user = {id: 'admin-1'};
    handle = await loadFunction(name);
  });

  it('refuses a caller who is not signed in', async () => {
    fake.user = null;
    profiles(ADMIN, TARGET);
    expect((await call()).status).toBe(401);
  });

  it.each(['DEPARTMENT', 'STERILIZATION', 'VIEWER'])('refuses a %s account', async role => {
    profiles({...ADMIN, role}, TARGET);
    const response = await call();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({error: 'forbidden'});
  });

  it('refuses an inactive admin', async () => {
    profiles({...ADMIN, active: false}, TARGET);
    expect((await call()).status).toBe(403);
  });

  it('refuses a caller with no profile', async () => {
    profiles(null, TARGET);
    expect((await call()).status).toBe(403);
  });

  it('needs a user to act on', async () => {
    profiles(ADMIN, TARGET);
    expect((await call('')).status).toBe(400);
  });

  it("refuses to act on the caller's own account", async () => {
    profiles(ADMIN, TARGET);
    expect((await call('admin-1')).status).toBe(selfStatus);
  });

  it('answers not_found for a user that does not exist', async () => {
    profiles(ADMIN, null);
    expect((await call()).status).toBe(404);
  });

  it("refuses a hospital admin acting on another hospital's user", async () => {
    profiles(ADMIN, {...TARGET, organization_id: 'org-2'});
    expect((await call()).status).toBe(403);
    expect(fake.calls.filter(c => ['deleteUser', 'updateUserById', 'generateLink'].includes(c.what))).toHaveLength(0);
    expect(fake.dbCalls().filter(c => c.op !== 'select')).toHaveLength(0);
  });

  it('refuses a target who belongs to no hospital, even to the platform admin', async () => {
    profiles({...ADMIN, organization_id: null}, {...TARGET, organization_id: null});
    expect((await call()).status).toBe(403);
  });

  it('lets the platform admin (no hospital) act on a hospital user', async () => {
    profiles({...ADMIN, organization_id: null}, TARGET);
    const response = await call();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ok: true});
  });

  it('lets a hospital admin act on their own hospital', async () => {
    profiles(ADMIN, TARGET);
    expect((await call()).status).toBe(200);
  });
});
