import {useSyncExternalStore} from 'react';
import type {CloudCollection} from './appRecords';

/**
 * Opening a hospital loads only recent history (T3); the rest comes when asked (History) or when a
 * screen needs all of it (Traceability, Reports). Sets, instruments, issues and the other changeable
 * records always load in full. Compositions, cycles and releases go back further than the longest
 * sterile shelf life (6 months), so a sterile Set always has its release record.
 */
export const HISTORY_WINDOW_DAYS: Partial<Record<CloudCollection, number>> = {
  movements: 90,
  receipts: 90,
  deliveries: 90,
  counts: 90,
  workflowCheckpoints: 90,
  preparations: 210,
  sterilizationCycles: 210,
  sterilizationReleases: 210,
};
const DAY_MS = 24 * 60 * 60 * 1000;

/** Per collection: the server time before which records were not loaded (none: all loaded). */
const cutoffs = new Map<CloudCollection, string>();
let loading = false;
const listeners = new Set<() => void>();
let snapshot = {windowed: false, loading: false};
const publish = () => {
  snapshot = {windowed: cutoffs.size > 0, loading};
  listeners.forEach(listener => listener());
};

/** The cutoff for a fresh load of the collection (undefined: load everything). */
export const freshCutoff = (collection: CloudCollection) => {
  const days = HISTORY_WINDOW_DAYS[collection];
  return days ? new Date(Date.now() - days * DAY_MS).toISOString() : undefined;
};
export const setCutoff = (collection: CloudCollection, cutoff: string | undefined) => {
  if (cutoff) cutoffs.set(collection, cutoff);
  else cutoffs.delete(collection);
  publish();
};
export const cutoffOf = (collection: CloudCollection) => cutoffs.get(collection);

// Each windowed collection's sync registers how to fetch what is older than its cutoff.
const loaders = new Map<CloudCollection, () => Promise<void>>();
export const registerOlderLoader = (collection: CloudCollection, load: () => Promise<void>) => {
  loaders.set(collection, load);
  return () => {
    if (loaders.get(collection) === load) loaders.delete(collection);
  };
};

/** Loads the older history of every windowed collection (once; later calls wait for the same load). */
let running: Promise<void> | undefined;
export const loadOlderHistory = () => {
  if (!cutoffs.size) return Promise.resolve();
  if (!running) {
    loading = true;
    publish();
    running = Promise.all([...cutoffs.keys()].map(collection => loaders.get(collection)?.()))
      .then(() => undefined)
      .finally(() => {
        loading = false;
        running = undefined;
        publish();
      });
  }
  return running;
};

/** Whether only recent history is loaded, whether the rest is loading, and how to load it. */
export const useHistoryWindow = () => {
  const state = useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
  );
  return {...state, loadOlder: loadOlderHistory};
};
