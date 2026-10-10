import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {
  deleteAppRecords,
  loadBarcodes,
  writeAppRecords,
  type CloudCollection,
  type CloudRecord,
  type RefusedRecord,
} from './appRecords';
import {loadChangedRecords, loadDeletedIds, recordKey} from './remoteChanges';
import {isRealtimeLive, onRemoteChange} from './realtime';
import {takeRestored, writeCollection} from './localCache';
import {loadRecordsById, loadTable} from './appRecords';
import {cutoffOf, HISTORY_WINDOW_DAYS, registerOlderLoader, setCutoff} from './historyWindow';
import type {TableCollection} from './cloudTables';
import {exportVersions, importVersions} from './versions';
import {mergeConcurrent, recordLabel} from './mergeConcurrent';

const SYNC_DELAY_MS = 400;
/** A failed save is tried again after 5 s, then 10 s, 20 s … up to 2 minutes, until one succeeds. */
const RETRY_DELAY_MS = 5000;
const MAX_RETRY_DELAY_MS = 120000;
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
/**
 * Collections whose saves wait until these have nothing left to save on this device: a cycle and its
 * release reach the server before the Set or instrument they make ready, so the database can require a
 * release of a passed cycle when a Set becomes ready.
 */
const SAVED_AFTER: Partial<Record<CloudCollection, CloudCollection[]>> = {
  sets: ['sterilizationCycles', 'sterilizationReleases'],
  tools: ['sterilizationCycles', 'sterilizationReleases'],
};

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
/** Resolves once none of these collections has a change waiting to be saved (or a save under way). */
const settled = (keys: string[]) =>
  new Promise<void>(resolve => {
    const done = () => !keys.some(key => pending.has(key));
    if (done()) return resolve();
    const stop = subscribe(() => {
      if (!done()) return;
      stop();
      resolve();
    });
  });

/** A record two devices changed at once, with the fields where the other device's value was kept. */
export type SyncConflict = {collection: CloudCollection; label: string; fields: string[]};
const conflictListeners = new Set<(conflict: SyncConflict) => void>();
/** Calls `listener` for every conflict the sync resolves; returns the unsubscribe. */
export const onSyncConflict = (listener: (conflict: SyncConflict) => void) => {
  conflictListeners.add(listener);
  return () => {
    conflictListeners.delete(listener);
  };
};

export type RefusalReason = 'permission' | 'invalid' | 'other';
/** What the sync changed or gave up on by itself, and the user must hear about. */
export type SyncNotice =
  | {kind: 'barcode'; collection: 'sets' | 'tools'; changes: Array<{from: string; to: string}>}
  | {kind: 'refused'; records: Array<{label: string; reverted: boolean; reason: RefusalReason}>};
const noticeListeners = new Set<(notice: SyncNotice) => void>();
/** Calls `listener` for every barcode the sync had to change and every record the server refused. */
export const onSyncNotice = (listener: (notice: SyncNotice) => void) => {
  noticeListeners.add(listener);
  return () => {
    noticeListeners.delete(listener);
  };
};
const notify = (notice: SyncNotice) => noticeListeners.forEach(listener => listener(notice));
const reasonOf = (code: string): RefusalReason =>
  code === '42501' ? 'permission' : /^2[23]/.test(code) ? 'invalid' : 'other';

// Each collection's "save now", for a sign-out that first saves what is waiting.
const flushers = new Set<() => void>();
/** Changes not yet confirmed by the server (at least one per collection still saving). */
export const unsavedChanges = () =>
  [...pending].reduce((sum, key) => sum + Math.max(pendingRecords.get(key) || 0, 1), 0);
/** Saves what is waiting at once and waits up to `timeoutMs` for it; resolves with what is still unsaved. */
export const flushPendingWrites = (timeoutMs: number) =>
  new Promise<number>(resolve => {
    if (!pending.size) return resolve(0);
    let stop: () => void = () => undefined;
    const timer = window.setTimeout(() => {
      stop();
      resolve(unsavedChanges());
    }, timeoutMs);
    stop = subscribe(() => {
      if (pending.size) return;
      window.clearTimeout(timer);
      stop();
      resolve(0);
    });
    flushers.forEach(flush => flush());
  });

/** Save state, records waiting and the last time the server was reached, for the top bar. */
export const useSyncInfo = () => useSyncExternalStore(subscribe, () => info);

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', event => {
    if (!pending.size) return;
    event.preventDefault();
    event.returnValue = '';
  });
}

// Each collection's "save this device's copy now", run when the page is hidden or closed.
const cacheWriters = new Set<() => void>();
if (typeof window !== 'undefined') {
  const writeAll = () => cacheWriters.forEach(write => write());
  window.addEventListener('pagehide', writeAll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) writeAll();
  });
}
/** How long the device's copy waits after a change before it is written (changes come in bursts). */
const CACHE_DELAY_MS = 800;

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
 * reconciled once it lands. Failed writes are retried, further and further apart, until they succeed;
 * a record the server refuses for good is put back (a barcode clash renumbered), so it never blocks the rest.
 */
export function useAppRecordSync(
  organizationId: string | undefined,
  collection: CloudCollection,
  items: readonly CloudRecord[],
  /** Puts records saved by other devices into the store (changed and new records, deleted ids). */
  apply?: (remote: CloudRecord[], removed: string[], append?: boolean) => void,
) {
  const confirmed = useRef<Map<string, CloudRecord> | null>(null);
  const latest = useRef(items);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const busy = useRef(false);
  const [retryTick, setRetryTick] = useState(0);
  // Failed saves in a row, for the growing wait before the next try.
  const failures = useRef(0);
  const applyRef = useRef(apply);
  applyRef.current = apply;
  // Records just taken from another device: their next appearance in the store is not a local change.
  const adopted = useRef(new Map<string, number>());
  // Local versions replaced by a merge with another device's save: never sent as they are.
  const superseded = useRef(new WeakSet<CloudRecord>());
  // Server time from which the next look fetches changes and deletions (kept in the device's copy).
  const since = useRef(new Date(Date.now() - 10 * 60000).toISOString());
  const deletedSince = useRef(since.current);
  const pullNow = useRef<() => void>(() => undefined);
  const cacheTimer = useRef<number | undefined>(undefined);
  // Writes this device's copy: the current records and which of them the server has not confirmed yet.
  const writeCopy = useRef(() => {
    const known = confirmed.current;
    if (!known) return;
    window.clearTimeout(cacheTimer.current);
    const {changed, removed} = diff(known, latest.current);
    void writeCollection(collection, {
      items: [...latest.current],
      changed: changed.map(item => item.id),
      removed,
      bases: changed.map(item => known.get(item.id)).filter((base): base is CloudRecord => !!base),
      cutoff: cutoffOf(collection),
      versions: exportVersions(collection),
      since: since.current,
      deletedSince: deletedSince.current,
    });
  });
  const scheduleCopy = () => {
    window.clearTimeout(cacheTimer.current);
    cacheTimer.current = window.setTimeout(() => writeCopy.current(), CACHE_DELAY_MS);
  };
  // The rest of the history, older than what the opening loaded (T3): fetched on request, added after.
  useEffect(() => {
    if (!organizationId || !HISTORY_WINDOW_DAYS[collection]) return;
    return registerOlderLoader(collection, async () => {
      const cutoff = cutoffOf(collection);
      if (!cutoff) return;
      const older = await loadTable(organizationId, collection as TableCollection, {before: cutoff});
      // Taken from the server: their appearance in the store is not a local change to save.
      const until = Date.now() + 60000;
      older.forEach(record => adopted.current.set(record.id, until));
      if (older.length) applyRef.current?.(older, [], true);
      setCutoff(collection, undefined);
      scheduleCopy();
    });
  }, [organizationId, collection]);

  useEffect(() => {
    if (!organizationId) return;
    const write = () => writeCopy.current();
    const flushNow = () => setRetryTick(tick => tick + 1);
    cacheWriters.add(write);
    flushers.add(flushNow);
    return () => {
      cacheWriters.delete(write);
      flushers.delete(flushNow);
    };
  }, [organizationId]);

  useEffect(() => {
    latest.current = items;
    if (!organizationId) return;
    // The first snapshot is what was just loaded from the server, or this device's copy of it.
    if (!confirmed.current) {
      const known = new Map(items.map(item => [item.id, item]));
      const copy = takeRestored(organizationId, collection);
      if (copy) {
        since.current = copy.since;
        deletedSince.current = copy.deletedSince;
        importVersions(collection, copy.versions);
        // Changes the copy kept unsaved: the server does not have them, so they count as changed
        // (against the server's version they started from, when the copy kept it).
        const bases = new Map((copy.bases || []).map(base => [base.id, base]));
        for (const id of [...copy.changed, ...copy.removed]) known.set(id, bases.get(id) || {id});
      }
      confirmed.current = known;
      scheduleCopy();
      // Fetch at once what other devices changed since the copy (or since this load).
      window.setTimeout(() => pullNow.current(), copy ? 300 : 3000);
      if (!copy || (!copy.changed.length && !copy.removed.length)) return;
    }
    scheduleCopy();
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
    // Records another device saved since this device saw them: merge field by field (S4).
    const resolveStale = async (ids: string[]) => {
      const saved = new Map((await loadRecordsById(organizationId, collection, ids)).map(r => [r.id, r]));
      const current = new Map(latest.current.map(item => [item.id, item]));
      const merged: CloudRecord[] = [];
      for (const id of ids) {
        const server = saved.get(id);
        const local = current.get(id);
        if (!server || !local) continue;
        const result = mergeConcurrent(known.get(id), local, server);
        // The other device's save is now the base; what is kept from here is saved on top of it.
        known.set(id, server);
        superseded.current.add(local);
        merged.push(result.keepsLocal ? result.merged : server);
        if (result.conflicts.length)
          conflictListeners.forEach(listener =>
            listener({collection, label: recordLabel(server), fields: result.conflicts}),
          );
      }
      if (merged.length) applyRef.current?.(merged, []);
    };
    // Records the server will not take (permission, invalid data): sent again they would block the
    // collection for good, so they go back to the server's version, or away if never saved there.
    const dropRefused = async (refusals: RefusedRecord[]) => {
      const ids = refusals.map(refusal => refusal.id);
      const saved = new Map((await loadRecordsById(organizationId, collection, ids)).map(r => [r.id, r]));
      const current = new Map(latest.current.map(item => [item.id, item]));
      const back: CloudRecord[] = [];
      const gone: string[] = [];
      const records = refusals.map(({id, code}) => {
        const server = saved.get(id);
        const local = current.get(id);
        if (local) superseded.current.add(local);
        if (server) {
          known.set(id, server);
          back.push(server);
        } else {
          known.delete(id);
          if (local) gone.push(id);
        }
        return {label: recordLabel(server || local || {id}), reverted: !!server, reason: reasonOf(code)};
      });
      applyRef.current?.(back, gone);
      notify({kind: 'refused', records});
    };
    // Barcodes another station handed out first (both took the highest + 1): the record takes the next
    // free one, counting this device's records and the server's, and is saved again.
    const renumber = async (ids: string[]) => {
      type Coded = CloudRecord & {barcode?: unknown; legacyBarcodes?: string[]};
      const current = new Map(latest.current.map(item => [item.id, item as Coded]));
      const clashing: Array<Coded & {barcode: string}> = [];
      const others: RefusedRecord[] = [];
      for (const id of ids) {
        const item = current.get(id);
        // Only a barcode this device gave (new, or changed here) is renumbered; any other clash is refused.
        const own =
          (collection === 'sets' || collection === 'tools') &&
          !!applyRef.current &&
          typeof item?.barcode === 'string' &&
          (known.get(id) as Coded | undefined)?.barcode !== item.barcode;
        if (own) clashing.push(item as Coded & {barcode: string});
        else others.push({id, code: '23505', message: 'unique violation'});
      }
      if (others.length) await dropRefused(others);
      if (!clashing.length || (collection !== 'sets' && collection !== 'tools')) return;
      const taken = [
        ...latest.current.flatMap(item => [(item as Coded).barcode, ...((item as Coded).legacyBarcodes || [])]),
        ...(await loadBarcodes(organizationId, collection)),
      ];
      let max = taken.reduce<number>((m, barcode) => {
        const numeric = typeof barcode === 'string' ? Number(barcode.replace(/\D/g, '')) : NaN;
        return Number.isFinite(numeric) ? Math.max(m, numeric) : m;
      }, 0);
      const prefix = collection === 'sets' ? 'S' : 'T';
      const changes: Array<{from: string; to: string}> = [];
      const renumbered = clashing.map(item => {
        const barcode = `${prefix}${String(++max).padStart(6, '0')}`;
        changes.push({from: item.barcode, to: barcode});
        superseded.current.add(item);
        return {...item, barcode};
      });
      // Not marked as saved: the store's new version differs from `known`, so the next flush sends it.
      applyRef.current?.(renumbered, []);
      notify({kind: 'barcode', collection, changes});
    };
    const before = (SAVED_AFTER[collection] || []).map(other => `${organizationId}:${other}`);
    const flush = async () => {
      busy.current = true;
      try {
        for (let round = 0; round < MAX_ROUNDS; round++) {
          if (before.length) await settled(before);
          const next = diff(known, latest.current);
          if (!next.changed.length && !next.removed.length) {
            pending.delete(key);
            pendingRecords.delete(key);
            break;
          }
          pendingRecords.set(key, next.changed.length + next.removed.length);
          publish();
          // A local version already merged with another device's save waits for the merged one (S4).
          const sendable = next.changed.filter(item => !superseded.current.has(item));
          const outcome = sendable.length
            ? await writeAppRecords(organizationId, collection, sendable)
            : {rejected: [], stale: [], refused: []};
          const rejected = new Set(outcome.rejected);
          const stale = new Set(outcome.stale);
          const refused = new Set(outcome.refused.map(refusal => refusal.id));
          // What the database took is saved even when one record in the batch was refused.
          sendable
            .filter(item => !rejected.has(item.id) && !stale.has(item.id) && !refused.has(item.id))
            .forEach(item => known.set(item.id, item));
          if (refused.size) await dropRefused(outcome.refused);
          if (stale.size) await resolveStale([...stale]);
          if (rejected.size) await renumber([...rejected]);
          // The store is taking the restored, merged or renumbered records: the next flush sends what is left.
          if (refused.size || stale.size || rejected.size) break;
          if (next.removed.length) {
            const kept = await deleteAppRecords(organizationId, collection, next.removed);
            const keptIds = new Set(kept.map(refusal => refusal.id));
            next.removed.filter(id => !keptIds.has(id)).forEach(id => known.delete(id));
            if (kept.length) {
              await dropRefused(kept);
              break;
            }
          }
        }
        failed.delete(key);
        failures.current = 0;
        lastSyncAt = Date.now();
        // Still changing after the last round: run another flush rather than wait for a render.
        const rest = diff(known, latest.current);
        if (rest.changed.length || rest.removed.length) setRetryTick(tick => tick + 1);
      } catch (error) {
        console.error(`SurgiTrack: saving ${collection} failed`, error);
        failed.add(key);
        const delay = Math.min(RETRY_DELAY_MS * 2 ** failures.current, MAX_RETRY_DELAY_MS);
        failures.current += 1;
        window.setTimeout(() => setRetryTick(tick => tick + 1), delay);
      } finally {
        busy.current = false;
        publish();
        // The copy now records what was confirmed; a look that waited for the save can run.
        writeCopy.current();
        pullNow.current();
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
        const {records, latest: stamp} = await loadChangedRecords(organizationId, collection, since.current);
        if (stamp) since.current = new Date(Date.parse(stamp) - 60000).toISOString();
        let removed: string[] = [];
        if (collection !== 'library') {
          const deleted = await loadDeletedIds(organizationId, collection, deletedSince.current);
          if (deleted.latest) deletedSince.current = new Date(Date.parse(deleted.latest) - 60000).toISOString();
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
    pullNow.current = () => void pull();
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
