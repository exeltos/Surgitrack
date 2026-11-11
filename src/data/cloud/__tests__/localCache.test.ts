import 'fake-indexeddb/auto';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

vi.mock('../../../lib/supabase', () => ({supabase: {auth: {onAuthStateChange: () => undefined}}}));

const {CACHE_MAX_AGE_MS, clearCache, clearSyncedCache, pendingOnto, readCache, setCacheOwner, writeCollection} =
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

  it('keeps only the unsaved changes when the session ends on its own, and never uses them as data', async () => {
    await writeAged('sets', entry([{id: 's1'}]), 1000);
    await writeAged('tools', entry([{id: 't1'}, {id: 't2', name: 'Edited'}], ['t2'], ['t9']), 1000);
    await clearSyncedCache();
    const copy = await readCache(owner, ['sets', 'tools']);
    expect(copy.sets).toBeUndefined();
    expect(copy.tools).toMatchObject({
      expired: true,
      changed: ['t2'],
      removed: ['t9'],
      items: [{id: 't2', name: 'Edited'}],
      versions: {t2: 'v-t2'},
    });
  });

  it('wipes everything on the explicit sign-out, unsaved changes included', async () => {
    await writeAged('tools', entry([{id: 't1'}], ['t1']), 1000);
    await clearCache();
    expect(await readCache(owner, ['tools'])).toEqual({});
  });

  it("never hands one user's copy to another", async () => {
    await writeAged('tools', entry([{id: 't1'}], ['t1']), 1000);
    expect(await readCache({userId: 'u2', organizationId: 'org-1'}, ['tools'])).toEqual({});
  });
});

describe("this device's copy of a large collection", () => {
  beforeEach(() => setCacheOwner(owner));
  afterEach(() => {
    vi.restoreAllMocks();
    return clearCache();
  });

  type Item = {id: string; name: string};
  const many = (count: number): Item[] => Array.from({length: count}, (_, n) => ({id: `t${n}`, name: `Tool ${n}`}));
  /** Records each write to the disk carries (the whole collection, or only what changed). */
  const recordsPut = () => {
    const put = vi.spyOn(IDBObjectStore.prototype, 'put');
    return () =>
      put.mock.calls.map(([value]) => {
        const written = value as {items?: unknown[]; upserts?: unknown[]};
        return (written.items || written.upserts || []).length;
      });
  };
  /** Changes the copy on disk under the key, as a write that went wrong would leave it. */
  const tamper = (key: string, update: (value: Record<string, unknown>) => Record<string, unknown>) =>
    new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('surgitrack-cache');
      open.onsuccess = () => {
        const tx = open.result.transaction('collections', 'readwrite');
        const store = tx.objectStore('collections');
        const read = store.get(key);
        read.onsuccess = () => store.put(update(read.result), key);
        tx.oncomplete = () => {
          open.result.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });

  it('writes only the changed record, and reads back the whole collection with it', async () => {
    let items = many(20_000);
    await writeCollection('tools', {...entry(items), items});
    const puts = recordsPut();
    items = items.map(item => (item.id === 't5' ? {...item, name: 'Edited'} : item));
    items = [{id: 'new', name: 'New'}, ...items.filter(item => item.id !== 't9')];
    await writeCollection('tools', {
      ...entry(items, ['t5', 'new'], ['t9']),
      items,
      versions: {...entry(many(20_000)).versions, t5: 'v-t5-2'},
    });

    expect(puts()).toEqual([2]);
    const copy = (await readCache(owner, ['tools'])).tools!;
    expect(copy.expired).toBe(false);
    expect(copy.items).toEqual(items);
    expect(copy.changed).toEqual(['t5', 'new']);
    expect(copy.removed).toEqual(['t9']);
    expect(copy.versions?.t5).toBe('v-t5-2');
    expect(copy.versions?.t1).toBe('v-t1');
  });

  it('writes the whole collection again once the changes have grown, and the changes start over', async () => {
    let items = many(4000);
    await writeCollection('tools', {...entry(items), items});
    const puts = recordsPut();
    for (let round = 0; round < 6; round++) {
      items = items.map((item, n) => (n >= round * 100 && n < (round + 1) * 100 ? {...item, name: 'Edited'} : item));
      await writeCollection('tools', {...entry(items), items});
    }

    // 100, 200 … 500 changed records, then 600: past the limit, the whole collection.
    expect(puts()).toEqual([100, 200, 300, 400, 500, 4000]);
    expect((await readCache(owner, ['tools'])).tools!.items).toEqual(items);
    items = items.map(item => (item.id === 't0' ? {...item, name: 'Again'} : item));
    await writeCollection('tools', {...entry(items), items});
    expect(puts().at(-1)).toBe(1);
    expect((await readCache(owner, ['tools'])).tools!.items).toEqual(items);
  });

  it('changes written over a whole copy that is no longer there (another tab, a failed write) keep the unsaved records and their versions', async () => {
    let items = many(1000);
    await writeCollection('tools', {...entry(items), items});
    items = items.map(item => (item.id === 't3' ? {...item, name: 'Unsaved'} : item));
    await writeCollection('tools', {...entry(items, ['t3']), items});
    // The whole copy on disk is another one than these changes were written over.
    await tamper('u1:org-1:tools', value => ({...value, token: 'another'}));

    const copy = (await readCache(owner, ['tools'])).tools!;
    expect(copy.expired).toBe(true);
    expect(copy.changed).toEqual(['t3']);
    expect(copy.items.find(item => item.id === 't3')).toEqual({id: 't3', name: 'Unsaved'});
    // With the version its change started from, so its save is still checked against the server's (S4).
    expect(copy.versions).toEqual({t3: 'v-t3'});
  });

  it('keeps the unsaved changes written on top when the session ends on its own', async () => {
    let items = many(1000);
    await writeCollection('tools', {...entry(items), items});
    items = items.map(item => (item.id === 't7' ? {...item, name: 'Unsaved'} : item));
    await writeCollection('tools', {...entry(items, ['t7'], ['t99x']), items});
    await clearSyncedCache();

    expect((await readCache(owner, ['tools'])).tools).toMatchObject({
      expired: true,
      changed: ['t7'],
      removed: ['t99x'],
      items: [{id: 't7', name: 'Unsaved'}],
      versions: {t7: 'v-t7'},
    });
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
