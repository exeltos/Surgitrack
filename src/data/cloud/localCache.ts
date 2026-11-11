import {supabase} from '../../lib/supabase';
import type {CloudCollection, CloudRecord} from './appRecords';
import {normalizeDates} from '../../core/displayDate';
import {mergeRemote} from './remoteChanges';

/**
 * This device's copy of the hospital's records (IndexedDB), per signed-in user and hospital:
 *  - opening the app shows the copy at once and then fetches only what changed since (T2);
 *  - changes not yet saved when the page was closed or reloaded are kept and sent on the next
 *    opening with a connection (S3).
 * It holds patient codes, so it is wiped on sign-out. A copy older than a day is not used as data,
 * but the changes it kept unsaved are, whatever their age (they exist nowhere else).
 *
 * A collection is kept in two parts: the whole collection (a large hospital's instruments are megabytes,
 * and writing them blocks the screen for a moment) and, beside it, what changed since it was written. A
 * change writes only that second part; the whole collection is written again only once that part has grown
 * (see writeCollection).
 */
const DB_NAME = 'surgitrack-cache';
const STORE = 'collections';
const VERSION = 1;
/** Records in the store's shape; bump when that shape changes so old copies are ignored. */
const CACHE_VERSION = 1;
export const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type CachedCollection = {
  items: CloudRecord[];
  /** Records changed or created here and not yet confirmed by the server. */
  changed: string[];
  /** Records deleted here and not yet deleted on the server. */
  removed: string[];
  /** The server's version of each changed record before it changed here (the merge base, S4). */
  bases?: CloudRecord[];
  /** The server version (updated_at) of each record, sent with a save (S4). */
  versions?: Record<string, string>;
  /** Only history created from then on is in the copy (T3); none: all of it. */
  cutoff?: string;
  /** Server time from which to fetch changes and deletions at the next opening. */
  since: string;
  deletedSince: string;
  savedAt: number;
  version: number;
  /** Older than a day: only its unsaved changes count (see pendingOnto). */
  expired?: boolean;
  /** Names this written collection, so that only the changes written on top of it are read with it. */
  token?: string;
};

/** What changed since the whole collection was written, saved beside it under its own key. */
type CachedChanges = Omit<CachedCollection, 'items' | 'token' | 'expired'> & {
  /** The token of the whole collection these changes go on top of. */
  base: string;
  /** Records new or different since then, and every unsaved one. */
  upserts: CloudRecord[];
  /** Records gone since then. */
  gone: string[];
};

let dbPromise: Promise<IDBDatabase | undefined> | undefined;
const openDb = () => {
  if (!dbPromise)
    dbPromise = new Promise(resolve => {
      try {
        if (typeof indexedDB === 'undefined') return resolve(undefined);
        const request = indexedDB.open(DB_NAME, VERSION);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(undefined);
        request.onblocked = () => resolve(undefined);
      } catch {
        resolve(undefined);
      }
    });
  return dbPromise;
};

const keyFor = (owner: CacheOwner, collection: CloudCollection) =>
  `${owner.userId}:${owner.organizationId}:${collection}`;
const CHANGES = '#changes';
const changesKey = (key: string) => `${key}${CHANGES}`;

/**
 * The whole collection on top of which changes are written, as written: its records (by identity, as the
 * store hands them over) and versions. Only in this page's memory: after a reload the first write is whole.
 */
type Written = {token: string; records: Map<string, CloudRecord>; versions: Record<string, string>};
const written = new Map<string, Written>();
/**
 * The changes are written alone while they hold at most this many records (a quarter of a small collection);
 * past that the whole collection is written again, and the changes start over.
 */
const MAX_CHANGES = 500;
const changesLimit = (size: number) => Math.min(MAX_CHANGES, Math.max(50, Math.ceil(size / 4)));
let tokens = 0;
const newToken = () =>
  `${Date.now().toString(36)}-${(tokens++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * A collection read back: the changes go on top of the whole collection they were written over. Changes
 * written over another one (a whole write that never reached the disk) only bring their unsaved records,
 * so the copy counts as old: it is not used as data, its unsaved changes are (see pendingOnto).
 */
const combine = (whole: CachedCollection | undefined, changes: CachedChanges | undefined) => {
  if (!changes || changes.version !== CACHE_VERSION) return whole;
  const {base, upserts, gone, ...rest} = changes;
  const matches = !!whole && !!whole.token && whole.token === base;
  const unsaved = new Set(changes.changed);
  const combined: CachedCollection = {
    ...rest,
    items: matches
      ? mergeRemote(whole!.items, upserts, gone)
      : mergeRemote(
          whole?.items || [],
          upserts.filter(item => unsaved.has(item.id)),
          changes.removed,
        ),
    versions: {...(matches ? whole!.versions : {}), ...changes.versions},
    savedAt: matches ? changes.savedAt : 0,
  };
  return combined;
};

export type CacheOwner = {userId: string; organizationId: string};
let owner: CacheOwner | undefined;
/** Who the copy belongs to, set once the workspace is known; without it nothing is kept. */
export const setCacheOwner = (next: CacheOwner | undefined) => {
  owner = next;
};

/** The copy of every collection of this user and hospital: fresh ones, and older ones with unsaved changes. */
export async function readCache(
  forOwner: CacheOwner,
  collections: readonly CloudCollection[],
): Promise<Partial<Record<CloudCollection, CachedCollection>>> {
  const db = await openDb();
  if (!db) return {};
  return new Promise(resolve => {
    const out: Partial<Record<CloudCollection, CachedCollection>> = {};
    try {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      for (const collection of collections) {
        const key = keyFor(forOwner, collection);
        const request = store.get(key);
        const changesRequest = store.get(changesKey(key));
        changesRequest.onsuccess = () => {
          const whole = request.result as CachedCollection | undefined;
          const entry = combine(
            whole?.version === CACHE_VERSION ? whole : undefined,
            changesRequest.result as CachedChanges | undefined,
          );
          if (!entry || entry.version !== CACHE_VERSION) return;
          const expired = Date.now() - entry.savedAt >= CACHE_MAX_AGE_MS;
          if (expired && !entry.changed.length && !entry.removed.length) return;
          // A copy saved by an older version may hold dates in the older form.
          out[collection] = {
            ...entry,
            items: normalizeDates(entry.items),
            bases: normalizeDates(entry.bases),
            expired,
          };
        };
      }
      tx.oncomplete = () => resolve(out);
      tx.onerror = () => resolve({});
      tx.onabort = () => resolve({});
    } catch {
      resolve({});
    }
  });
}

/**
 * Saves one collection's copy for the current owner (best effort: a full disk only loses the copy). Only
 * what changed since the whole collection was last written goes to the disk, unless that has grown past
 * changesLimit: then the whole collection is written again. `items` must be the store's own records (a
 * record is taken as unchanged while it is the same object).
 */
export async function writeCollection(
  collection: CloudCollection,
  entry: Omit<CachedCollection, 'savedAt' | 'version'>,
) {
  const current = owner;
  if (!current) return;
  const key = keyFor(current, collection);
  const savedAt = Date.now();
  const versions = entry.versions || {};
  // Decided now, in the order of the calls: each write goes on top of the whole one decided before it.
  const last = written.get(key);
  let changes: CachedChanges | undefined;
  if (last) {
    const unsaved = new Set(entry.changed);
    const upserts = entry.items.filter(item => last.records.get(item.id) !== item || unsaved.has(item.id));
    const present = new Set(entry.items.map(item => item.id));
    const gone = [...last.records.keys()].filter(id => !present.has(id));
    if (upserts.length + gone.length <= changesLimit(entry.items.length)) {
      const {items: _items, ...rest} = entry;
      void _items;
      changes = {
        ...rest,
        // The versions that changed, and always those of the unsaved records: read without the whole copy
        // (another tab wrote its own over it), these still need the version their change started from.
        versions: Object.fromEntries(
          Object.entries(versions).filter(([id, version]) => last.versions[id] !== version || unsaved.has(id)),
        ),
        base: last.token,
        upserts,
        gone,
        savedAt,
        version: CACHE_VERSION,
      };
    }
  }
  const token = changes ? undefined : newToken();
  if (token) written.set(key, {token, records: new Map(entry.items.map(item => [item.id, item])), versions});
  const db = await openDb();
  if (!db) return;
  await new Promise<void>(resolve => {
    // A whole write that did not reach the disk: the next write is whole again.
    const failed = () => {
      if (token && written.get(key)?.token === token) written.delete(key);
      resolve();
    };
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      if (changes) store.put(changes, changesKey(key));
      else {
        store.put({...entry, savedAt, version: CACHE_VERSION, token}, key);
        store.delete(changesKey(key));
      }
      tx.oncomplete = () => resolve();
      tx.onerror = failed;
      tx.onabort = failed;
    } catch {
      failed();
    }
  });
}

/** Wipes every copy on this device (sign-out, or a copy that must not be trusted). */
export async function clearCache() {
  owner = undefined;
  written.clear();
  const db = await openDb();
  if (!db) return;
  await new Promise<void>(resolve => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Wipes what this device holds of the hospital but keeps the changes that exist nowhere else (not yet
 * saved): a sign-out the person did not ask for (expired session, signed out in another tab) must not
 * lose recorded work. Each copy shrinks to its unsaved records and is marked old (savedAt 0), so it is
 * never used as data, only for those changes (see readCache and pendingOnto). They stay under the
 * user's and hospital's own key and go with the next normal sign-out (clearCache).
 */
export async function clearSyncedCache() {
  owner = undefined;
  written.clear();
  const db = await openDb();
  if (!db) return;
  await new Promise<void>(resolve => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const keysRequest = store.getAllKeys();
      const valuesRequest = store.getAll();
      valuesRequest.onsuccess = () => {
        const values = new Map(keysRequest.result.map((key, index) => [String(key), valuesRequest.result[index]]));
        store.clear();
        for (const [key, value] of values) {
          if (key.endsWith(CHANGES)) continue;
          const whole = value as CachedCollection;
          const changes = values.get(changesKey(key)) as CachedChanges | undefined;
          const entry = whole?.version === CACHE_VERSION ? combine(whole, changes) : whole;
          if (!entry?.changed?.length && !entry?.removed?.length) continue;
          const keep = new Set(entry.changed);
          const {token: _token, expired: _expired, ...rest} = entry;
          void _token;
          void _expired;
          store.put(
            {
              ...rest,
              items: entry.items.filter(item => keep.has(item.id)),
              versions: Object.fromEntries(Object.entries(entry.versions || {}).filter(([id]) => keep.has(id))),
              savedAt: 0,
            },
            key,
          );
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

if (typeof window !== 'undefined')
  supabase.auth.onAuthStateChange(event => {
    // A sign-out through the app's own button clears everything first (clearCache); this one also covers
    // the session ending on its own, where unsaved work has to survive.
    if (event === 'SIGNED_OUT') void clearSyncedCache();
  });

/**
 * A collection's unsaved changes put onto records just loaded from the server, for when the copy as a
 * whole is not used (missing collections, or too old): changed and new records replace or join the
 * server's, deleted ones are left out. Nothing when the copy kept no unsaved changes.
 */
export const pendingOnto = (
  server: CloudRecord[],
  copy: CachedCollection | undefined,
  /** Server time the records were loaded from (the sync fetches what changed since). */
  since: string,
): CachedCollection | undefined => {
  if (!copy || (!copy.changed.length && !copy.removed.length)) return undefined;
  const local = new Map(copy.items.map(item => [item.id, item]));
  const changed = copy.changed.filter(id => local.has(id));
  // Only the changed records keep the version they started from; the rest take the server's just loaded.
  const versions = Object.fromEntries(changed.flatMap(id => (copy.versions?.[id] ? [[id, copy.versions[id]]] : [])));
  return {
    ...copy,
    items: mergeRemote(
      server,
      changed.map(id => local.get(id)!),
      copy.removed,
    ),
    changed,
    versions,
    cutoff: undefined,
    since,
    deletedSince: since,
    expired: false,
  };
};

// What the workspace restored from the copy, handed to each collection's sync when it starts.
const restored = new Map<string, CachedCollection>();
export const setRestored = (organizationId: string, entries: Partial<Record<CloudCollection, CachedCollection>>) => {
  for (const [collection, entry] of Object.entries(entries))
    if (entry) restored.set(`${organizationId}:${collection}`, entry);
};
/** The restored copy of a collection, once (the sync takes it on its first snapshot). */
export const takeRestored = (organizationId: string, collection: CloudCollection) => {
  const key = `${organizationId}:${collection}`;
  const entry = restored.get(key);
  restored.delete(key);
  return entry;
};
