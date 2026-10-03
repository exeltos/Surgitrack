import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {deleteAppRecords, writeAppRecords, type CloudCollection, type CloudRecord} from './appRecords';

const SYNC_DELAY_MS = 400;
const RETRY_DELAY_MS = 5000;
// Rounds per flush; later changes are picked up by the next render's flush.
const MAX_ROUNDS = 5;

export type SyncStatus = 'saved' | 'saving' | 'failed';

// Collections with changes not yet confirmed by the server, and those whose last write failed.
const pending = new Set<string>();
const failed = new Set<string>();
const listeners = new Set<() => void>();
let status: SyncStatus = 'saved';
const publish = () => {
  status = failed.size ? 'failed' : pending.size ? 'saving' : 'saved';
  listeners.forEach(listener => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Overall save state of the cloud workspace, for a status indicator. */
export const useSyncStatus = () => useSyncExternalStore(subscribe, () => status);

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
) {
  const confirmed = useRef<Map<string, CloudRecord> | null>(null);
  const latest = useRef(items);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const busy = useRef(false);
  const [retryTick, setRetryTick] = useState(0);

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
            break;
          }
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
}
