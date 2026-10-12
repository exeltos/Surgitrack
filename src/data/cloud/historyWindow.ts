import {useSyncExternalStore} from 'react';
import type {CloudCollection} from './appRecords';

/**
 * Opening a hospital loads only recent history (T3); the rest comes when asked (History), when a report
 * that reads it opens (only the kinds it reads), or, for a search, only what matches it (Traceability). Sets, instruments, issues and the other changeable
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

/**
 * A PostgREST `or` filter (e.g. `asset.ilike.*S000321*,patient_code.eq.P-77`): only the older records that
 * match it. It may match more than a screen needs (the screen filters again); never less.
 */
export type HistoryFilter = string;

/** Per collection: the server time before which records were not loaded (none: all loaded). */
const cutoffs = new Map<CloudCollection, string>();
/** Collections whose whole older history, or a search in it, is being fetched. */
const busy = new Map<CloudCollection, number>();
const listeners = new Set<() => void>();
let version = 0;
const publish = () => {
  version += 1;
  listeners.forEach(listener => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The cutoff for a fresh load of the collection (undefined: load everything). */
export const freshCutoff = (collection: CloudCollection) => {
  const days = HISTORY_WINDOW_DAYS[collection];
  return days ? new Date(Date.now() - days * DAY_MS).toISOString() : undefined;
};
export const setCutoff = (collection: CloudCollection, cutoff: string | undefined) => {
  if (cutoff) cutoffs.set(collection, cutoff);
  else cutoffs.delete(collection);
  // A new cutoff (another hospital, a fresh load) makes earlier searches worth running again.
  searched.clear();
  publish();
};
export const cutoffOf = (collection: CloudCollection) => cutoffs.get(collection);

/**
 * Each windowed collection's sync registers how to fetch what is older than its cutoff: all of it (which
 * clears the cutoff), or with a filter only what matches (the cutoff stays).
 */
type OlderLoader = (filter?: HistoryFilter) => Promise<void>;
const loaders = new Map<CloudCollection, OlderLoader>();
export const registerOlderLoader = (collection: CloudCollection, load: OlderLoader) => {
  loaders.set(collection, load);
  return () => {
    if (loaders.get(collection) === load) loaders.delete(collection);
  };
};

const tracked = <T>(collection: CloudCollection, work: () => Promise<T>) => {
  busy.set(collection, (busy.get(collection) || 0) + 1);
  publish();
  return work().finally(() => {
    const left = (busy.get(collection) || 1) - 1;
    if (left) busy.set(collection, left);
    else busy.delete(collection);
    publish();
  });
};

// One full load per collection at a time; later calls wait for the same one.
const running = new Map<CloudCollection, Promise<void>>();
const loadAllOlder = (collection: CloudCollection) => {
  if (!cutoffs.has(collection)) return Promise.resolve();
  let load = running.get(collection);
  if (!load) {
    load = tracked(collection, () => loaders.get(collection)?.() ?? Promise.resolve()).finally(() =>
      running.delete(collection),
    );
    running.set(collection, load);
  }
  return load;
};

/** Loads the whole older history of these collections (every windowed one when none are named). */
export const loadOlderHistory = (collections: readonly CloudCollection[] = [...cutoffs.keys()]) =>
  Promise.all(collections.map(loadAllOlder)).then(() => undefined);

// The same function for the same collections, so a screen's effect does not run again on every render.
const loadersFor = new Map<string, () => Promise<void>>();
const loaderFor = (names: readonly CloudCollection[]) => {
  const key = names.join(',');
  let load = loadersFor.get(key);
  if (!load) {
    load = () => loadOlderHistory(names);
    loadersFor.set(key, load);
  }
  return load;
};

// Searches already fetched since the last cutoff change: the same search is not sent again.
const searched = new Set<string>();
/**
 * Fetches only the older records that match, per collection (e.g. one Set's movements, or a patient's): what a
 * search needs, without the whole hospital's history. A collection already loaded in full is skipped.
 */
export const loadOlderMatching = (filters: Partial<Record<CloudCollection, HistoryFilter>>) =>
  Promise.all(
    (Object.entries(filters) as Array<[CloudCollection, HistoryFilter]>).map(([collection, filter]) => {
      const key = `${collection}|${filter}`;
      const load = loaders.get(collection);
      if (!filter || !load || !cutoffs.has(collection) || searched.has(key)) return undefined;
      return tracked(collection, () => load(filter)).then(() => {
        searched.add(key);
      });
    }),
  ).then(() => undefined);

/**
 * Whether only recent history of these collections is loaded (every windowed one when none are named),
 * whether some of it is loading, and how to load all of it.
 */
export const useHistoryWindow = (collections?: readonly CloudCollection[]) => {
  useSyncExternalStore(subscribe, () => version);
  const names = collections ?? [...cutoffs.keys()];
  return {
    windowed: names.some(collection => cutoffs.has(collection)),
    loading: names.some(collection => busy.has(collection)),
    loadOlder: loaderFor(names),
  };
};
