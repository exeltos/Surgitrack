import {supabase} from '../../lib/supabase';
import {CLOUD_TABLES, tableColumns, tableFromRow} from './cloudTables';
import type {CloudCollection, CloudRecord} from './appRecords';

const PAGE_SIZE = 1000;

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
 * Returns them with the latest stamp seen, which moves the next look forward.
 */
export async function loadChangedRecords(
  organizationId: string,
  collection: CloudCollection,
  since: string,
): Promise<{records: CloudRecord[]; latest?: string}> {
  const records: CloudRecord[] = [];
  let latest: string | undefined;
  for (let from = 0; ; from += PAGE_SIZE) {
    const {data, error} = await supabase
      .from(CLOUD_TABLES[collection].table)
      .select(`${tableColumns(collection)},updated_at,created_at`)
      .eq('organization_id', organizationId)
      .or(`updated_at.gte.${since},created_at.gte.${since}`)
      .order('created_at', {ascending: false})
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data as unknown as Array<Record<string, unknown>>;
    for (const row of page) {
      for (const stamp of [row.updated_at, row.created_at])
        if (typeof stamp === 'string' && (!latest || stamp > latest)) latest = stamp;
      records.push(tableFromRow(collection, row));
    }
    if (page.length < PAGE_SIZE) return {records, latest};
  }
}

/** Every id of a collection, to notice records another device deleted. */
export async function loadRecordIds(organizationId: string, collection: CloudCollection): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const {data, error} = await supabase
      .from(CLOUD_TABLES[collection].table)
      .select('id')
      .eq('organization_id', organizationId)
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data as unknown as Array<{id: string}>;
    page.forEach(row => ids.add(String(row.id)));
    if (page.length < PAGE_SIZE) return ids;
  }
}

/** Puts another device's records into a list: changed ones replaced in place, new ones first, deleted ones out. */
export function mergeRemote<T extends {id: string}>(
  list: readonly T[],
  remote: readonly T[],
  removed: readonly string[],
) {
  const byId = new Map(remote.map(item => [item.id, item]));
  const gone = new Set(removed);
  const kept = list.filter(item => !gone.has(item.id)).map(item => byId.get(item.id) ?? item);
  const present = new Set(list.map(item => item.id));
  const added = remote.filter(item => !present.has(item.id));
  return [...added, ...kept];
}
