import 'fake-indexeddb/auto';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

vi.mock('../../../lib/supabase', () => ({supabase: {auth: {onAuthStateChange: () => undefined}}}));

const {CACHE_MAX_AGE_MS, clearCache, pendingOnto, readCache, setCacheOwner, writeCollection} =
  await import('../localCache');

const owner = {userId: 'u1', organizationId: 'org-1'};
const since = '2026-10-01T08:00:00.000Z';
const entry = (items: Array<{id: string; name?: string}>, changed: string[] = [], removed: string[] = []) => ({
  items,
  changed,
  removed,
  versions: Object.fromEntries(items.map(item => [item.id, `v-${item.id}`])),
  since,
  deletedSince: since,
});
/** Writes a copy as if it had been saved `ageMs` ago. */
const writeAged = async (collection: 'sets' | 'tools', value: ReturnType<typeof entry>, ageMs: number) => {
  const now = Date.now();
  const spy = vi.spyOn(Date, 'now').mockReturnValue(now - ageMs);
  await writeCollection(collection, value);
  spy.mockRestore();
};

describe("this device's copy", () => {
  beforeEach(() => setCacheOwner(owner));
  afterEach(() => clearCache());

  it('drops an old clean copy but keeps the unsaved changes of an old one', async () => {
    await writeAged('sets', entry([{id: 's1'}]), CACHE_MAX_AGE_MS + 1000);
    await writeAged('tools', entry([{id: 't1', name: 'Edited'}], ['t1']), 3 * CACHE_MAX_AGE_MS);
    const copy = await readCache(owner, ['sets', 'tools']);
    expect(copy.sets).toBeUndefined();
    expect(copy.tools).toMatchObject({expired: true, changed: ['t1'], items: [{id: 't1', name: 'Edited'}]});
  });

  it('uses a fresh copy as it is', async () => {
    await writeAged('sets', entry([{id: 's1'}]), 1000);
    expect((await readCache(owner, ['sets'])).sets).toMatchObject({expired: false, items: [{id: 's1'}]});
  });

  it("never hands one user's copy to another", async () => {
    await writeAged('tools', entry([{id: 't1'}], ['t1']), 1000);
    expect(await readCache({userId: 'u2', organizationId: 'org-1'}, ['tools'])).toEqual({});
  });
});

describe('unsaved changes put onto fresh server records', () => {
  it('keeps changed and new records, leaves deleted ones out, and only the changed versions', () => {
    const server = [
      {id: 'a', name: 'Server A'},
      {id: 'b', name: 'Server B'},
      {id: 'd', name: 'Server D'},
    ];
    const copy = {
      ...entry(
        [
          {id: 'c', name: 'New C'},
          {id: 'a', name: 'Local A'},
          {id: 'd', name: 'Old D'},
        ],
        ['c', 'a'],
        ['b'],
      ),
      savedAt: 0,
      version: 1,
      expired: true,
    };
    const restored = pendingOnto(server, copy, '2026-10-09T09:00:00.000Z')!;
    expect(restored.items).toEqual([
      {id: 'c', name: 'New C'},
      {id: 'a', name: 'Local A'},
      {id: 'd', name: 'Server D'},
    ]);
    expect(restored.changed).toEqual(['c', 'a']);
    expect(restored.removed).toEqual(['b']);
    expect(restored.versions).toEqual({c: 'v-c', a: 'v-a'});
    expect(restored.since).toBe('2026-10-09T09:00:00.000Z');
  });

  it('restores nothing when the copy kept no unsaved changes', () => {
    expect(pendingOnto([], {...entry([{id: 'a'}]), savedAt: 0, version: 1}, since)).toBeUndefined();
    expect(pendingOnto([], undefined, since)).toBeUndefined();
  });
});
