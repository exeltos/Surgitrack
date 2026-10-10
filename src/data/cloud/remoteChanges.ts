import {supabase} from '../../lib/supabase';
import {CLOUD_TABLES, tableColumns, tableFromRow} from './cloudTables';
import type {CloudCollection, CloudRecord} from './appRecords';
import {loadAllPages, PAGE_SIZE} from './pages';
import {rememberVersions} from './versions';

/** A record's content in a fixed form (keys sorted, empty values dropped), to tell real changes apart. */
export const recordKey = (value: unknown): string => {
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === 'object')
      return Object.fromEntries(
        Object.keys(v as Record<string, unknown>)
          .filter(k => (v as Record<string, unknown>)[k] !== undefined && (v as Record<string, unknown>)[k] !== null)
          .sort()
          .map(k => [k, norm((v as Record<string, unknown>)[k])]),
      );
    return v;
  };
  return JSON.stringify(norm(value));
};

/**
 * Records of a collection saved by anyone since `since` (server time: the database stamps every update).
 * Returns them with the latest stamp seen, which moves the next look forward. History tables are
 * append-only and have no updated_at: only their created_at counts.
 */
export async function loadChangedRecords(
  organizationId: string,
  collection: CloudCollection,
  since: string,
): Promise<{records: CloudRecord[]; latest?: string}> {
  const records: CloudRecord[] = [];
  let latest: string | undefined;
  const {mutable} = CLOUD_TABLES[collection];
  for (let from = 0; ; from += PAGE_SIZE) {
    const query = supabase
      .from(CLOUD_TABLES[collection].table)
      .select(`${tableColumns(collection)},${mutable ? 'updated_at,' : ''}created_at`)
      .eq('organization_id', organizationId);
    const {data, error} = await (
      mutable ? query.or(`updated_at.gte.${since},created_at.gte.${since}`) : query.gte('created_at', since)
    )
      .order('created_at', {ascending: false})
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data as unknown as Array<Record<string, unknown>>;
    if (mutable) rememberVersions(collection, page);
    for (const row of page) {
      for (const stamp of [row.updated_at, row.created_at])
        if (typeof stamp === 'string' && (!latest || stamp > latest)) latest = stamp;
      records.push(tableFromRow(collection, row));
    }
    if (page.length < PAGE_SIZE) return {records, latest};
  }
}

/**
 * Ids of a collection deleted (on any device) since `since`, as the database recorded them, with the latest
 * stamp seen. One small query instead of downloading every id to find the missing ones.
 */
export async function loadDeletedIds(
  organizationId: string,
  collection: CloudCollection,
  since: string,
): Promise<{ids: string[]; latest?: string}> {
  const rows = await loadAllPages<{id: string; deleted_at: string}>((from, to, withCount) =>
    supabase
      .from('deleted_records')
      .select('id,deleted_at', withCount ? {count: 'exact'} : undefined)
      .eq('organization_id', organizationId)
      .eq('collection', collection)
      .gte('deleted_at', since)
      .order('deleted_at')
      .range(from, to)
      .then(result => ({...result, data: result.data as unknown as Array<{id: string; deleted_at: string}> | null})),
  );
  return {ids: rows.map(row => String(row.id)), latest: rows.length ? rows[rows.length - 1].deleted_at : undefined};
}

/** Puts another device's records into a list: changed ones replaced in place, new ones first, deleted ones out. */
export function mergeRemote<T extends {id: string}>(
  list: readonly T[],
  remote: readonly T[],
  removed: readonly string[],
  /** Older records (the rest of the history): they go after the list, not before it. */
  append = false,
) {
  const byId = new Map(remote.map(item => [item.id, item]));
  const gone = new Set(removed);
  const kept = list.filter(item => !gone.has(item.id)).map(item => byId.get(item.id) ?? item);
  const present = new Set(list.map(item => item.id));
  const added = remote.filter(item => !present.has(item.id));
  return append ? [...kept, ...added] : [...added, ...kept];
}
