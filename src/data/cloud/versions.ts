import type {CloudCollection} from './appRecords';

/**
 * The version (server updated_at) this device last saw of each changeable record. A save sends it, and
 * the database refuses it when the record changed since on another device (see useAppRecordSync).
 */
const versions = new Map<CloudCollection, Map<string, string>>();
const of = (collection: CloudCollection) => {
  let map = versions.get(collection);
  if (!map) versions.set(collection, (map = new Map()));
  return map;
};

export const versionOf = (collection: CloudCollection, id: string) => versions.get(collection)?.get(id);
const setVersion = (collection: CloudCollection, id: string, version: unknown) => {
  if (typeof version === 'string' && version) of(collection).set(id, version);
};
/** Remembers the versions of rows read from or returned by the database. */
export const rememberVersions = (collection: CloudCollection, rows: ReadonlyArray<Record<string, unknown>>) =>
  rows.forEach(row => setVersion(collection, String(row.id), row.updated_at));
export const exportVersions = (collection: CloudCollection) => Object.fromEntries(of(collection));
export const importVersions = (collection: CloudCollection, saved: Record<string, string> | undefined) =>
  Object.entries(saved || {}).forEach(([id, version]) => setVersion(collection, id, version));
