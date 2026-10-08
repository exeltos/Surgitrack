import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {deleteAppRecords, writeAppRecords, type CloudCollection, type CloudRecord} from './appRecords';
import {loadChangedRecords, loadDeletedIds, recordKey} from './remoteChanges';
import {isRealtimeLive, onRemoteChange} from './realtime';

const SYNC_DELAY_MS = 400;
const RETRY_DELAY_MS = 5000;
/** How often an open screen looks for what other devices saved (and at once when the window comes back). */
const PULL_INTERVAL_MS = 20000;
/** With live changes connected, the periodic look is only a safety net. */
const LIVE_PULL_INTERVAL_MS = 60000;
/** A burst of live changes (e.g. a whole Set released) is fetched once. */
const LIVE_DEBOUNCE_MS = 300;
/** A record taken from another device is adopted as saved when the store shows it within this time. */
const ADOPT_MS = 5000;
// Rounds per flush; later changes are picked up by the next render's flush.
const MAX_ROUNDS = 5;

export type SyncStatus = 'saved' | 'saving' | 'failed';

// Collections with changes not yet confirmed by the server, and those whose last write failed.
const pending = new Set<string>();
const failed = new Set<string>();
// Records waiting to be saved, per collection, and when this device last heard from the server.
const pendingRecords = new Map<string, number>();
let lastSyncAt: number | undefined;
const listeners = new Set<() => void>();
let status: SyncStatus = 'saved';
export type SyncInfo = {status: SyncStatus; pendingRecords: number; lastSyncAt?: number};
let info: SyncInfo = {status, pendingRecords: 0};
const publish = () => {
  status = failed.size ? 'failed' : pending.size ? 'saving' : 'saved';
  const waiting = [...pending].reduce((sum, key) => sum + (pendingRecords.get(key) || 0), 0);
  if (info.status !== status || info.pendingRecords !== waiting || info.lastSyncAt !== lastSyncAt)
    info = {status, pendingRecords: waiting, lastSyncAt};
  listeners.forEach(listener => listener());
};
const markSynced = () => {
  lastSyncAt = Date.now();
  publish();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Overall save state of the cloud workspace, for a status indicator. */
export const useSyncStatus = () => useSyncExternalStore(subscribe, () => status);
/** Save state, records waiting and the last time the server was reached, for the top bar. */
export const useSyncInfo = () => useSyncExternalStore(subscribe, () => info);

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', event => {
    if (!pending.size) return;
    event.preventDefault();
    event.returnValue = '';
  });
}

const diff = (known: Map<string, CloudRecord>, items: readonly CloudRecord[]) => {
  const changed = items.filter(item => known.get(item.id) !== item);
  const currentIds = new Set(items.map(item => item.id));
  const removed = [...known.keys()].filter(id => !currentIds.has(id));
  return {changed, removed};
};

/** Records taken from another device count as saved when they show up in the store. */
const adopt = (known: Map<string, CloudRecord>, items: readonly CloudRecord[], adopted: Map<string, number>) => {
  if (!adopted.size) return;
  const now = Date.now();
  for (const item of items) {
    const until = adopted.get(item.id);
    if (until === undefined) continue;
    if (until >= now && known.get(item.id) !== item) {
      known.set(item.id, item);
      adopted.delete(item.id);
    }
  }
  for (const [id, until] of adopted) if (until < now) adopted.delete(id);
};

/**
 * Mirrors one store collection into its table. The store updates records immutably,
 * so any record whose object identity changed since the last confirmed write is sent again,
 * and records that disappeared are deleted. Writes run one at a time and always diff against
 * the latest items, so changes made while a write is in flight (even create-then-delete) are
 * reconciled once it lands. Failed writes are retried until they succeed.
 */
export function useAppRecordSync(
  organizationId: string | undefined,
  collection: CloudCollection,
  items: readonly CloudRecord[],
  /** Puts records saved by other devices into the store (changed and new records, deleted ids). */
  apply?: (remote: CloudRecord[], removed: string[]) => void,
) {
  const confirmed = useRef<Map<string, CloudRecord> | null>(null);
  const latest = useRef(items);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const busy = useRef(false);
  const [retryTick, setRetryTick] = useState(0);
  const applyRef = useRef(apply);
  applyRef.current = apply;
  // Records just taken from another device: their next appearance in the store is not a local change.
  const adopted = useRef(new Map<string, number>());

  useEffect(() => {
    latest.current = items;
    if (!organizationId) return;
    // The first snapshot is what was just loaded from the server.
    if (!confirmed.current) {
      confirmed.current = new Map(items.map(item => [item.id, item]));
      return;
    }
    const known = confirmed.current;
    const key = `${organizationId}:${collection}`;
    adopt(known, items, adopted.current);
    const {changed, removed} = diff(known, items);
    // While a write is in flight its outcome is not in `known` yet; that flush re-checks when it lands.
    if (!changed.length && !removed.length && !busy.current) {
      if (pending.delete(key)) publish();
      return;
    }
    pending.add(key);
    publish();
    const flush = async () => {
      busy.current = true;
      try {
        for (let round = 0; round < MAX_ROUNDS; round++) {
          const next = diff(known, latest.current);
          if (!next.changed.length && !next.removed.length) {
            pending.delete(key);
            pendingRecords.delete(key);
            break;
          }
          pendingRecords.set(key, next.changed.length + next.removed.length);
          publish();
          const rejected = new Set(
            next.changed.length ? await writeAppRecords(organizationId, collection, next.changed) : [],
          );
          // What the database took is saved even when one record in the batch was refused.
          next.changed.filter(item => !rejected.has(item.id)).forEach(item => known.set(item.id, item));
          if (rejected.size)
            throw new Error(`${collection}: ${[...rejected].join(', ')} refused (barcode already in use)`);
          if (next.removed.length) await deleteAppRecords(organizationId, collection, next.removed);
          next.removed.forEach(id => known.delete(id));
        }
        failed.delete(key);
        lastSyncAt = Date.now();
        // Still changing after the last round: run another flush rather than wait for a render.
        const rest = diff(known, latest.current);
        if (rest.changed.length || rest.removed.length) setRetryTick(tick => tick + 1);
      } catch (error) {
        console.error(`SurgiTrack: saving ${collection} failed`, error);
        failed.add(key);
        window.setTimeout(() => setRetryTick(tick => tick + 1), RETRY_DELAY_MS);
      } finally {
        busy.current = false;
        publish();
      }
    };
    const timer = window.setTimeout(() => {
      queue.current = queue.current.then(flush);
    }, SYNC_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [organizationId, collection, items, retryTick]);

  // Picks up what other devices saved, so this screen does not keep (and later write back) an old picture.
  useEffect(() => {
    if (!organizationId || !applyRef.current) return;
    let since = new Date(Date.now() - 10 * 60000).toISOString();
    let deletedSince = since;
    let lastLook = 0;
    let running = false;
    const pull = async () => {
      const known = confirmed.current;
      if (running || document.hidden || busy.current || !known || !applyRef.current) return;
      lastLook = Date.now();
      // Local changes first: they are saved before anything is taken from the server.
      const local = diff(known, latest.current);
      if (local.changed.length || local.removed.length) return;
      running = true;
      try {
        const {records, latest: stamp} = await loadChangedRecords(organizationId, collection, since);
        if (stamp) since = new Date(Date.parse(stamp) - 60000).toISOString();
        let removed: string[] = [];
        if (collection !== 'library') {
          const deleted = await loadDeletedIds(organizationId, collection, deletedSince);
          if (deleted.latest) deletedSince = new Date(Date.parse(deleted.latest) - 60000).toISOString();
          const gone = new Set(deleted.ids);
          removed = latest.current.filter(item => known.get(item.id) === item && gone.has(item.id)).map(i => i.id);
        }
        markSynced();
        const current = new Map(latest.current.map(item => [item.id, item]));
        const fresh = records.filter(record => {
          const mine = current.get(record.id);
          // A record changed here and not saved yet stays as it is here.
          if (mine && known.get(record.id) !== mine) return false;
          return !mine || recordKey(mine) !== recordKey(record);
        });
        if (!fresh.length && !removed.length) return;
        const until = Date.now() + ADOPT_MS;
        fresh.forEach(record => adopted.current.set(record.id, until));
        // Deleted elsewhere: once gone from the store, the usual flush confirms the delete (already done).
        applyRef.current(fresh, removed);
      } catch (error) {
        console.warn(`SurgiTrack: reading ${collection} changes failed`, error);
      } finally {
        running = false;
      }
    };
    // The periodic look: every 20 s, or every 60 s while live changes are connected.
    const timer = window.setInterval(() => {
      if (isRealtimeLive() && Date.now() - lastLook < LIVE_PULL_INTERVAL_MS) return;
      void pull();
    }, PULL_INTERVAL_MS);
    const onBack = () => {
      if (!document.hidden) void pull();
    };
    let liveTimer: number | undefined;
    const stopLive = onRemoteChange(organizationId, collection, () => {
      window.clearTimeout(liveTimer);
      liveTimer = window.setTimeout(() => void pull(), LIVE_DEBOUNCE_MS);
    });
    document.addEventListener('visibilitychange', onBack);
    window.addEventListener('focus', onBack);
    window.addEventListener('online', onBack);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(liveTimer);
      stopLive();
      document.removeEventListener('visibilitychange', onBack);
      window.removeEventListener('focus', onBack);
      window.removeEventListener('online', onBack);
    };
  }, [organizationId, collection]);
}
