import {beforeEach, describe, expect, it, vi} from 'vitest';

// A stand-in for the database: what a select answers (per columns asked) and what an insert was given.
const db = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  oldDatabase: false,
  inserted: [] as Array<Record<string, unknown>>,
}));
vi.mock('../../../lib/supabase', () => {
  const query = (columns: string) => {
    const result =
      db.oldDatabase && columns.includes('kind') ? {data: null, error: {code: '42703'}} : {data: db.rows, error: null};
    const chain: Record<string, unknown> = {
      lte: () => chain,
      or: () => chain,
      order: () => chain,
      limit: () => Promise.resolve(result),
      then: (resolve: (value: unknown) => void) => resolve(result),
    };
    return chain;
  };
  return {
    supabase: {
      from: () => ({
        select: (columns: string) => query(columns),
        insert: (row: Record<string, unknown>) => {
          db.inserted.push(row);
          return Promise.resolve({error: null});
        },
      }),
    },
  };
});

const {addNotice, loadActiveNotices, loadNotices, noticeStatus, safeLink} = await import('../platformNotices');
type PlatformNotice = Awaited<ReturnType<typeof loadNotices>>[number];

const now = Date.parse('2026-10-10T10:00:00Z');
const notice = (startsAt: string, endsAt?: string): PlatformNotice => ({
  id: 'n',
  message: 'Συντήρηση',
  kind: 'NOTICE',
  audience: 'ALL',
  startsAt,
  endsAt,
  createdAt: startsAt,
});
const row = (over: Record<string, unknown>) => ({
  id: 'r',
  message: 'Μήνυμα',
  starts_at: '2026-10-01T00:00:00Z',
  ends_at: null,
  created_at: '2026-10-01T00:00:00Z',
  created_by_name: 'Owner',
  ...over,
});

beforeEach(() => {
  db.rows = [];
  db.oldDatabase = false;
  db.inserted = [];
});

describe('a notice to every user', () => {
  it('shows from its start until its end', () => {
    expect(noticeStatus(notice('2026-10-10T09:00:00Z', '2026-10-10T11:00:00Z'), now)).toBe('ACTIVE');
  });
  it('without an end it shows until it is ended', () => {
    expect(noticeStatus(notice('2026-10-01T09:00:00Z'), now)).toBe('ACTIVE');
  });
  it('is scheduled before its start and over at its end', () => {
    expect(noticeStatus(notice('2026-10-10T12:00:00Z'), now)).toBe('SCHEDULED');
    expect(noticeStatus(notice('2026-10-09T09:00:00Z', '2026-10-10T10:00:00Z'), now)).toBe('ENDED');
  });
});

describe('a link', () => {
  it('is opened only over https', () => {
    expect(safeLink('https://example.com/x')).toBe('https://example.com/x');
    expect(safeLink('http://example.com')).toBeUndefined();
    expect(safeLink('javascript:alert(1)')).toBeUndefined();
    expect(safeLink('https://exa mple.com')).toBeUndefined();
    expect(safeLink(undefined)).toBeUndefined();
  });
});

describe('reading notices and promotions', () => {
  it('splits them by kind: the strip gets notices, the Overview the promotions', async () => {
    db.rows = [
      row({id: 'a', kind: 'NOTICE', audience: 'ALL'}),
      row({
        id: 'b',
        kind: 'PROMO',
        audience: 'ADMINS',
        title: 'Προϊόν',
        link_url: 'https://example.com',
        link_label: 'Δείτε',
      }),
    ];
    expect((await loadActiveNotices('NOTICE')).map(n => n.id)).toEqual(['a']);
    const promos = await loadActiveNotices('PROMO');
    expect(promos).toHaveLength(1);
    expect(promos[0]).toMatchObject({
      title: 'Προϊόν',
      linkUrl: 'https://example.com',
      linkLabel: 'Δείτε',
      audience: 'ADMINS',
    });
  });

  it('keeps the strip working on a database that has not got the new columns yet', async () => {
    db.oldDatabase = true;
    db.rows = [row({id: 'old'})];
    expect((await loadActiveNotices('NOTICE')).map(n => n.id)).toEqual(['old']);
    expect(await loadActiveNotices('PROMO')).toEqual([]);
    expect((await loadNotices())[0]).toMatchObject({kind: 'NOTICE', audience: 'ALL'});
  });

  it('reads the hospitals a notice is for', async () => {
    db.rows = [row({organization_ids: ['o1', 'o2']})];
    expect((await loadNotices())[0].organizationIds).toEqual(['o1', 'o2']);
  });
});

describe('publishing', () => {
  it('writes only the old columns for a plain notice to everyone (it works before the migration too)', async () => {
    await addNotice({message: ' Συντήρηση ', byName: 'Owner'});
    expect(db.inserted[0]).toEqual({message: 'Συντήρηση', ends_at: null, created_by_name: 'Owner'});
  });

  it('makes a promotion for the administrators, with its title, a safe link and the hospitals', async () => {
    await addNotice({
      message: 'Κείμενο',
      kind: 'PROMO',
      audience: 'ALL',
      title: ' Προϊόν ',
      linkUrl: 'https://example.com/p',
      linkLabel: 'Δείτε',
      organizationIds: ['o1'],
      byName: 'Owner',
    });
    expect(db.inserted[0]).toMatchObject({
      kind: 'PROMO',
      audience: 'ADMINS',
      title: 'Προϊόν',
      link_url: 'https://example.com/p',
      link_label: 'Δείτε',
      organization_ids: ['o1'],
    });
  });

  it('drops a link that is not https instead of sending it', async () => {
    await addNotice({message: 'x', kind: 'PROMO', title: 'T', linkUrl: 'javascript:alert(1)', byName: 'Owner'});
    expect(db.inserted[0]).toMatchObject({link_url: null, link_label: null});
  });
});
