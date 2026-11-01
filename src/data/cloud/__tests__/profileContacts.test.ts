import {beforeEach, describe, expect, it, vi} from 'vitest';

const db = vi.hoisted(() => ({
  rpc: vi.fn(),
  table: vi.fn(),
  eq: vi.fn(),
}));
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    rpc: db.rpc,
    from: (name: string) => ({
      select: (cols: string) => {
        db.table(name, cols);
        const result = db.eq.getMockImplementation() ? db.eq() : {data: [], error: null};
        return Object.assign(Promise.resolve(result), {
          eq: (...a: unknown[]) => (db.table('eq', a), Promise.resolve(result)),
        });
      },
    }),
  },
}));

const {loadProfileContacts, findProfileIdByEmail} = await import('../profileContacts');
const rows = [
  {id: 'u1', email: 'Ann@Hospital.gr', user_code: 'ann1'},
  {id: 'u2', email: 'bob@hospital.gr', user_code: null},
];

beforeEach(() => {
  db.rpc.mockReset();
  db.table.mockReset();
  db.eq.mockReset();
});

describe('reading sign-in emails and usernames', () => {
  it('asks profile_contacts() and not the profiles table', async () => {
    db.rpc.mockResolvedValue({data: rows, error: null});
    const {contacts, error} = await loadProfileContacts('org-1');
    expect(db.rpc).toHaveBeenCalledWith('profile_contacts', {p_org: 'org-1'});
    expect(db.table).not.toHaveBeenCalled();
    expect(error).toBeUndefined();
    expect(contacts.get('u2')).toEqual(rows[1]);
  });

  it('asks for everyone (no hospital) for the platform owner', async () => {
    db.rpc.mockResolvedValue({data: rows, error: null});
    await loadProfileContacts();
    expect(db.rpc).toHaveBeenCalledWith('profile_contacts', {p_org: null});
  });

  it('reads the table as before while the function is not in the database yet', async () => {
    db.rpc.mockResolvedValue({data: null, error: {code: 'PGRST202', message: 'Could not find the function'}});
    db.eq.mockImplementation(() => ({data: rows, error: null}));
    const {contacts, error} = await loadProfileContacts('org-1');
    expect(db.table).toHaveBeenCalledWith('profiles', 'id,email,user_code');
    expect(db.table).toHaveBeenCalledWith('eq', ['organization_id', 'org-1']);
    expect(contacts.size).toBe(2);
    expect(error).toBeUndefined();
  });

  it('reports any other error instead of falling back', async () => {
    db.rpc.mockResolvedValue({data: null, error: {code: '42501', message: 'permission denied'}});
    const {contacts, error} = await loadProfileContacts('org-1');
    expect(db.table).not.toHaveBeenCalled();
    expect(error?.message).toBe('permission denied');
    expect(contacts.size).toBe(0);
  });

  it('finds a person by email, ignoring case and spaces', async () => {
    db.rpc.mockResolvedValue({data: rows, error: null});
    expect(await findProfileIdByEmail('org-1', '  ann@hospital.GR ')).toBe('u1');
    expect(await findProfileIdByEmail('org-1', 'nobody@hospital.gr')).toBeUndefined();
    expect(await findProfileIdByEmail(undefined, 'ann@hospital.gr')).toBeUndefined();
  });
});
