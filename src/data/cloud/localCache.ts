import {supabase} from '../../lib/supabase';
import type {CloudCollection, CloudRecord} from './appRecords';

/**
 * This device's copy of the hospital's records (IndexedDB), per signed-in user and hospital:
 *  - opening the app shows the copy at once and then fetches only what changed since (T2);
 *  - changes not yet saved when the page was closed or reloaded are kept and sent on the next
 *    opening with a connection (S3).
 * It holds patient codes, so it is wiped on sign-out. A copy older than a day is not used.
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

export type CacheOwner = {userId: string; organizationId: string};
let owner: CacheOwner | undefined;
/** Who the copy belongs to, set once the workspace is known; without it nothing is kept. */
export const setCacheOwner = (next: CacheOwner | undefined) => {
  owner = next;
};
export const cacheOwner = () => owner;

/** The copy of every collection of this user and hospital (fresh ones only). */
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
        const request = store.get(keyFor(forOwner, collection));
        request.onsuccess = () => {
          const entry = request.result as CachedCollection | undefined;
          if (entry && entry.version === CACHE_VERSION && Date.now() - entry.savedAt < CACHE_MAX_AGE_MS)
            out[collection] = entry;
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

/** Saves one collection's copy for the current owner (best effort: a full disk only loses the copy). */
export async function writeCollection(
  collection: CloudCollection,
  entry: Omit<CachedCollection, 'savedAt' | 'version'>,
) {
  const current = owner;
  if (!current) return;
  const db = await openDb();
  if (!db) return;
  await new Promise<void>(resolve => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({...entry, savedAt: Date.now(), version: CACHE_VERSION}, keyFor(current, collection));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** Wipes every copy on this device (sign-out, or a copy that must not be trusted). */
export async function clearCache() {
  owner = undefined;
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

if (typeof window !== 'undefined')
  supabase.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') void clearCache();
  });

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
