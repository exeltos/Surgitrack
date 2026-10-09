import {supabase} from '../../lib/supabase';
import {
  CLOUD_TABLES,
  TABLE_COLLECTIONS,
  tableColumns,
  tableFromRow,
  tableToRow,
  type TableCollection,
} from './cloudTables';
import {loadAllPages} from './pages';
import {rememberVersions, versionOf} from './versions';
import {freshCutoff, setCutoff} from './historyWindow';

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
  'recycleBin',
] as const;
export type StoreCollection = (typeof STORE_COLLECTIONS)[number];
export type CloudCollection = StoreCollection | 'library';
export type CloudRecord = {id: string};

export type CloudRecords = Record<CloudCollection, CloudRecord[]>;

const WRITE_CHUNK = 200;

const emptyRecords = (): CloudRecords =>
  Object.fromEntries([...STORE_COLLECTIONS, 'library'].map(c => [c, []])) as unknown as CloudRecords;

/**
 * Loads one collection's table, newest first (the store's order). With `since`, only records created
 * from then on; with `before`, only older ones (the rest of the history, loaded when asked: T3).
 */
export async function loadTable(
  organizationId: string,
  collection: TableCollection,
  range: {since?: string; before?: string} = {},
) {
  const {mutable} = CLOUD_TABLES[collection];
  const rows = await loadAllPages<Record<string, unknown>>((from, to, withCount) => {
    let query = supabase
      .from(CLOUD_TABLES[collection].table)
      // Changeable records come with their version, for the check when they are saved (S4).
      .select(`${tableColumns(collection)}${mutable ? ',updated_at' : ''}`, withCount ? {count: 'exact'} : undefined)
      .eq('organization_id', organizationId);
    if (range.since) query = query.gte('created_at', range.since);
    if (range.before) query = query.lt('created_at', range.before);
    return query
      .order('created_at', {ascending: false})
      .order('id')
      .range(from, to)
      .then(result => ({...result, data: result.data as unknown as Array<Record<string, unknown>> | null}));
  });
  if (mutable) rememberVersions(collection, rows);
  return rows.map(row => tableFromRow(collection, row));
}

/**
 * Loads an organization's records, newest first within each collection (the store's order): every
 * changeable record, and the recent part of the history (see historyWindow; the rest loads on request).
 */
export async function loadAppRecords(organizationId: string, {recentHistory = true} = {}): Promise<CloudRecords> {
  const records = emptyRecords();
  const cutoffs = TABLE_COLLECTIONS.map(collection => (recentHistory ? freshCutoff(collection) : undefined));
  const loaded = await Promise.all(
    TABLE_COLLECTIONS.map((collection, index) => loadTable(organizationId, collection, {since: cutoffs[index]})),
  );
  TABLE_COLLECTIONS.forEach((collection, index) => {
    records[collection] = loaded[index];
    setCutoff(collection, cutoffs[index]);
  });
  return records;
}

const chunks = <T>(items: T[]) =>
  Array.from({length: Math.ceil(items.length / WRITE_CHUNK)}, (_, i) =>
    items.slice(i * WRITE_CHUNK, (i + 1) * WRITE_CHUNK),
  );

const UNIQUE_VIOLATION = '23505';
const RLS_VIOLATION = '42501';
/** The database refused a save because the record changed since this device saw it (S4). */
const STALE_VERSION = '40001';
type DbError = {code?: string; message?: string; details?: string};
const isStale = (error: DbError | null) =>
  !!error && (error.code === STALE_VERSION || /changed on another device/.test(error.message || ''));
/**
 * A refusal that sending again will not change: permission (RLS), a constraint or invalid data, or a
 * rule raised by a trigger. Anything else (network, timeouts, server errors, a schema the client does
 * not know yet) is worth another try.
 */
export const isPermanentRefusal = (error: DbError | null) =>
  !!error && (error.code === RLS_VIOLATION || error.code === 'P0001' || /^2[23]/.test(error.code || ''));
/** A unique clash is the barcode's unless the database names the primary key (the id). */
const isBarcodeClash = (error: DbError) =>
  error.code === UNIQUE_VIOLATION && !/_pkey|primary key/i.test(`${error.message || ''} ${error.details || ''}`);

/** A record the database will not take, and why (its error code). */
export type RefusedRecord = {id: string; code: string; message: string};
export type WriteOutcome = {rejected: string[]; stale: string[]; refused: RefusedRecord[]};

/**
 * Saves one row: an update when it exists, otherwise an insert. Department users may update a Set
 * or instrument (handovers change state) but only Sterilization may create one, and an upsert is
 * checked against the create rule even when it ends up updating — hence the separate update.
 */
async function saveTableRow(
  collection: CloudCollection,
  row: Record<string, unknown>,
): Promise<'saved' | 'conflict' | 'stale'> {
  const {table} = CLOUD_TABLES[collection];
  const {organization_id: organizationId, id, ...changes} = row;
  const {data, error} = await supabase
    .from(table)
    .update(changes)
    .eq('organization_id', organizationId as string)
    .eq('id', id as string)
    .select('id,updated_at');
  if (error && isBarcodeClash(error)) return 'conflict';
  if (isStale(error)) return 'stale';
  if (error) throw error;
  if (data.length) {
    rememberVersions(collection, data as Array<Record<string, unknown>>);
    return 'saved';
  }
  const {expected_updated_at: _expected, ...fresh} = row;
  void _expected;
  const {data: inserted, error: insertError} = await supabase.from(table).insert(fresh).select('id,updated_at');
  if (insertError && isBarcodeClash(insertError)) return 'conflict';
  if (insertError) throw insertError;
  rememberVersions(collection, (inserted || []) as Array<Record<string, unknown>>);
  return 'saved';
}

/**
 * Saves records of a collection. Batches go in one request; history is
 * insert-only (a record already saved stays as it was). When the database refuses a batch, it is
 * halved until the refused records are found, so the rest are still saved. Returns the ids refused
 * for a barcode clash, those changed meanwhile on another device, and those refused for good
 * (permission, invalid data). Anything worth another try (network, server) is thrown.
 */
export async function writeAppRecords(
  organizationId: string,
  collection: CloudCollection,
  items: CloudRecord[],
): Promise<WriteOutcome> {
  const {table, mutable} = CLOUD_TABLES[collection];
  const toRow = (item: CloudRecord) => {
    const row = tableToRow(organizationId, collection, item as CloudRecord & Record<string, unknown>);
    // The version this device saw: the database refuses the save if the record changed since.
    if (mutable) row.expected_updated_at = versionOf(collection, item.id) ?? null;
    return row;
  };
  const outcome: WriteOutcome = {rejected: [], stale: [], refused: []};
  const send = async (batch: CloudRecord[]) => {
    const request = supabase
      .from(table)
      .upsert(batch.map(toRow), {onConflict: 'organization_id,id', ignoreDuplicates: !mutable});
    const {data, error} = mutable ? await request.select('id,updated_at') : await request;
    if (!error && mutable) rememberVersions(collection, (data || []) as Array<Record<string, unknown>>);
    return error;
  };
  const saveOne = async (item: CloudRecord) => {
    try {
      if (!mutable) {
        const error = await send([item]);
        if (error) throw error;
        return;
      }
      const result = await saveTableRow(collection, toRow(item));
      if (result === 'conflict') outcome.rejected.push(item.id);
      if (result === 'stale') outcome.stale.push(item.id);
    } catch (error) {
      const refusal = error as DbError;
      if (!isPermanentRefusal(refusal)) throw error;
      outcome.refused.push({id: item.id, code: refusal.code || '', message: refusal.message || ''});
    }
  };
  const settle = async (batch: CloudRecord[], error: DbError) => {
    if (!isStale(error) && !isPermanentRefusal(error)) throw error;
    // A department user's upsert is refused as a whole (see saveTableRow): each record goes on its own.
    if (batch.length === 1 || (mutable && error.code === RLS_VIOLATION)) {
      for (const item of batch) await saveOne(item);
      return;
    }
    const half = Math.ceil(batch.length / 2);
    for (const part of [batch.slice(0, half), batch.slice(half)]) {
      const partError = await send(part);
      if (partError) await settle(part, partError);
    }
  };
  for (const chunk of chunks(items)) {
    const error = await send(chunk);
    if (error) await settle(chunk, error);
  }
  return outcome;
}

/** Every barcode of the hospital's Sets or instruments, retired ones included (never handed out again). */
export async function loadBarcodes(organizationId: string, collection: 'sets' | 'tools') {
  const rows = await loadAllPages<{barcode: string; legacy_barcodes: string[] | null}>((from, to, withCount) =>
    supabase
      .from(CLOUD_TABLES[collection].table)
      .select('barcode,legacy_barcodes', withCount ? {count: 'exact'} : undefined)
      .eq('organization_id', organizationId)
      .order('id')
      .range(from, to)
      .then(result => ({
        ...result,
        data: result.data as unknown as Array<{barcode: string; legacy_barcodes: string[] | null}> | null,
      })),
  );
  return rows.flatMap(row => [row.barcode, ...(row.legacy_barcodes || [])]);
}

/** The saved records with these ids (and their versions), to merge a refused save with them. */
export async function loadRecordsById(organizationId: string, collection: CloudCollection, ids: string[]) {
  const records: CloudRecord[] = [];
  for (const chunk of chunks(ids)) {
    const {data, error} = await supabase
      .from(CLOUD_TABLES[collection].table)
      .select(`${tableColumns(collection)},updated_at`)
      .eq('organization_id', organizationId)
      .in('id', chunk);
    if (error) throw error;
    const rows = (data || []) as unknown as Array<Record<string, unknown>>;
    rememberVersions(collection, rows);
    records.push(...rows.map(row => tableFromRow(collection, row)));
  }
  return records;
}

/** Deletes records; returns those the database refuses for good (the rest are deleted). */
export async function deleteAppRecords(organizationId: string, collection: CloudCollection, ids: string[]) {
  const remove = async (batch: string[]) =>
    (await supabase.from(CLOUD_TABLES[collection].table).delete().eq('organization_id', organizationId).in('id', batch))
      .error as DbError | null;
  const refused: RefusedRecord[] = [];
  for (const chunk of chunks(ids)) {
    const error = await remove(chunk);
    if (!error) continue;
    if (!isPermanentRefusal(error)) throw error;
    // Refusals of a delete are rare (a record still referenced): find which one by one.
    for (const id of chunk) {
      const one = chunk.length === 1 ? error : await remove([id]);
      if (!one) continue;
      if (!isPermanentRefusal(one)) throw one;
      refused.push({id, code: one.code || '', message: one.message || ''});
    }
  }
  return refused;
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
