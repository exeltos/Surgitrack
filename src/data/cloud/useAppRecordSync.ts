import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {deleteAppRecords, writeAppRecords, type CloudCollection, type CloudRecord} from './appRecords';

const SYNC_DELAY_MS = 400;
const RETRY_DELAY_MS = 5000;

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

/**
 * Mirrors one store collection into `app_records`. The store updates records immutably,
 * so any record whose object identity changed since the last confirmed write is sent again,
 * and records that disappeared are deleted. Failed writes are retried until they succeed.
 */
export function useAppRecordSync(
  organizationId: string | undefined,
  collection: CloudCollection,
  items: readonly CloudRecord[],
) {
  const confirmed = useRef<Map<string, CloudRecord> | null>(null);
  // Writes run one after another so an older version can never land after a newer one.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!organizationId) return;
    // The first snapshot is what was just loaded from the server.
    if (!confirmed.current) {
      confirmed.current = new Map(items.map(item => [item.id, item]));
      return;
    }
    const known = confirmed.current;
    const key = `${organizationId}:${collection}`;
    const changedOrRemoved =
      items.some(item => known.get(item.id) !== item) || known.size !== new Set(items.map(item => item.id)).size;
    if (!changedOrRemoved) {
      if (pending.delete(key)) publish();
      return;
    }
    pending.add(key);
    publish();
    let cancelled = false;
    const timer = window.setTimeout(() => {
      queue.current = queue.current.then(async () => {
        if (cancelled) return;
        // Diff against what the server has confirmed at the moment this write starts.
        const changed = items.filter(item => known.get(item.id) !== item);
        const currentIds = new Set(items.map(item => item.id));
        const removed = [...known.keys()].filter(id => !currentIds.has(id));
        try {
          if (changed.length) await writeAppRecords(organizationId, collection, changed);
          if (removed.length) await deleteAppRecords(organizationId, collection, removed);
          changed.forEach(item => known.set(item.id, item));
          removed.forEach(id => known.delete(id));
          failed.delete(key);
          if (!cancelled) pending.delete(key);
        } catch (error) {
          console.error(`SurgiTrack: saving ${collection} failed`, error);
          failed.add(key);
          if (!cancelled) window.setTimeout(() => setRetryTick(tick => tick + 1), RETRY_DELAY_MS);
        }
        publish();
      });
    }, SYNC_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [organizationId, collection, items, retryTick]);
}
