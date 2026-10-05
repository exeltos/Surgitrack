import {supabase} from '../../lib/supabase';
import {
  CLOUD_TABLES,
  TABLE_COLLECTIONS,
  tableColumns,
  tableFromRow,
  tableToRow,
  type TableCollection,
} from './cloudTables';

/** Store collections saved in the cloud: each has its own table (see cloudTables), one row per record. */
export const STORE_COLLECTIONS = [
  'sets',
  'tools',
  'movements',
  'issues',
  'counts',
  'receipts',
  'preparations',
  'sterilizationCycles',
  'processLoads',
  'recallCases',
  'sterilizationReleases',
  'workflowCheckpoints',
  'deliveries',
  'purchaseOrders',
] as const;
export type StoreCollection = (typeof STORE_COLLECTIONS)[number];
export type CloudCollection = StoreCollection | 'library';
export type CloudRecord = {id: string};

export type CloudRecords = Record<CloudCollection, CloudRecord[]>;

const PAGE_SIZE = 1000;
const WRITE_CHUNK = 200;

const emptyRecords = (): CloudRecords =>
  Object.fromEntries([...STORE_COLLECTIONS, 'library'].map(c => [c, []])) as unknown as CloudRecords;

/** Loads one collection's table, newest first (the store's order). */
async function loadTable(organizationId: string, collection: TableCollection) {
  const rows: CloudRecord[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const {data, error} = await supabase
      .from(CLOUD_TABLES[collection].table)
      .select(tableColumns(collection))
      .eq('organization_id', organizationId)
      .order('created_at', {ascending: false})
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data as unknown as Array<Record<string, unknown>>;
    rows.push(...page.map(row => tableFromRow(collection, row)));
    if (page.length < PAGE_SIZE) return rows;
  }
}

/** Loads every record of an organization, newest first within each collection (the store's order). */
export async function loadAppRecords(organizationId: string): Promise<CloudRecords> {
  const records = emptyRecords();
  const loaded = await Promise.all(TABLE_COLLECTIONS.map(collection => loadTable(organizationId, collection)));
  TABLE_COLLECTIONS.forEach((collection, index) => (records[collection] = loaded[index]));
  return records;
}

const chunks = <T>(items: T[]) =>
  Array.from({length: Math.ceil(items.length / WRITE_CHUNK)}, (_, i) =>
    items.slice(i * WRITE_CHUNK, (i + 1) * WRITE_CHUNK),
  );

const UNIQUE_VIOLATION = '23505';
const RLS_VIOLATION = '42501';

/**
 * Saves one row: an update when it exists, otherwise an insert. Department users may update a Set
 * or instrument (handovers change state) but only Sterilization may create one, and an upsert is
 * checked against the create rule even when it ends up updating — hence the separate update.
 */
async function saveTableRow(table: string, row: Record<string, unknown>): Promise<'saved' | 'conflict'> {
  const {organization_id: organizationId, id, ...changes} = row;
  const {data, error} = await supabase
    .from(table)
    .update(changes)
    .eq('organization_id', organizationId as string)
    .eq('id', id as string)
    .select('id');
  if (error?.code === UNIQUE_VIOLATION) return 'conflict';
  if (error) throw error;
  if (data.length) return 'saved';
  const {error: insertError} = await supabase.from(table).insert(row);
  if (insertError?.code === UNIQUE_VIOLATION) return 'conflict';
  if (insertError) throw insertError;
  return 'saved';
}

/**
 * Saves records of a collection. Batches go in one request; history is
 * insert-only (a record already saved stays as it was). When the database refuses a batch of
 * changeable records (a barcode another record already holds, or a department user updating),
 * each record is saved on its own. Returns the ids refused for a barcode clash, so the rest still
 * count as saved.
 */
export async function writeAppRecords(organizationId: string, collection: CloudCollection, items: CloudRecord[]) {
  const {table, mutable} = CLOUD_TABLES[collection];
  const toRow = (item: CloudRecord) =>
    tableToRow(organizationId, collection, item as CloudRecord & Record<string, unknown>);
  const rejected: string[] = [];
  for (const chunk of chunks(items)) {
    const {error} = await supabase
      .from(table)
      .upsert(chunk.map(toRow), {onConflict: 'organization_id,id', ignoreDuplicates: !mutable});
    if (!error) continue;
    if (!mutable || (error.code !== UNIQUE_VIOLATION && error.code !== RLS_VIOLATION)) throw error;
    for (const item of chunk) if ((await saveTableRow(table, toRow(item))) === 'conflict') rejected.push(item.id);
  }
  return rejected;
}

export async function deleteAppRecords(organizationId: string, collection: CloudCollection, ids: string[]) {
  for (const chunk of chunks(ids)) {
    const {error} = await supabase
      .from(CLOUD_TABLES[collection].table)
      .delete()
      .eq('organization_id', organizationId)
      .in('id', chunk);
    if (error) throw error;
  }
}

/**
 * Writes a full data set into an empty organization. Arrays are newest first, so
 * creation times are spaced backwards from now to keep that order on reload.
 * Existing records are left untouched, so an interrupted seed can simply run again.
 */
export async function seedAppRecords(
  organizationId: string,
  records: Partial<CloudRecords>,
  onProgress?: (done: number, total: number) => void,
) {
  const now = Date.now();
  const total = Object.values(records).reduce((sum, items) => sum + (items?.length || 0), 0);
  let done = 0;
  for (const [collection, items] of Object.entries(records) as Array<[CloudCollection, CloudRecord[]]>) {
    const rows = items.map((item, index) =>
      tableToRow(
        organizationId,
        collection,
        item as CloudRecord & Record<string, unknown>,
        new Date(now - index * 1000).toISOString(),
      ),
    );
    for (const chunk of chunks(rows)) {
      const {error} = await supabase
        .from(CLOUD_TABLES[collection].table)
        .upsert(chunk, {onConflict: 'organization_id,id', ignoreDuplicates: true});
      if (error) throw error;
      done += chunk.length;
      onProgress?.(done, total);
    }
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The organization whose data is stored in Supabase for this session, if any. */
export const getCloudOrganizationId = (): string | undefined => {
  const id = sessionStorage.getItem('surgitrack-active-organization') || '';
  return UUID.test(id) ? id : undefined;
};

/** The library is stored as a single document; this drops the synthetic `id` it is stored under. */
export const libraryFromRecords = (records: CloudRecords): Record<string, unknown> | undefined => {
  const doc = records.library[0] as (CloudRecord & Record<string, unknown>) | undefined;
  if (!doc) return undefined;
  const {id: _id, ...state} = doc;
  void _id;
  return state;
};
