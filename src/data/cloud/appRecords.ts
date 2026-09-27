import {supabase} from '../../lib/supabase';

/** Store collections mirrored into `public.app_records`, one row per record. */
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
] as const;
export type StoreCollection = (typeof STORE_COLLECTIONS)[number];
export type CloudCollection = StoreCollection | 'library';
export type CloudRecord = {id: string};

/**
 * Collections whose records change after creation. Everything else is traceability
 * history: written once and never updated (the database rejects updates too).
 */
export const MUTABLE_COLLECTIONS: ReadonlySet<CloudCollection> = new Set([
  'library',
  'sets',
  'tools',
  'issues',
  'processLoads',
  'recallCases',
]);

export type CloudRecords = Record<CloudCollection, CloudRecord[]>;

const PAGE_SIZE = 1000;
const WRITE_CHUNK = 200;

const emptyRecords = (): CloudRecords =>
  Object.fromEntries([...STORE_COLLECTIONS, 'library'].map(c => [c, []])) as unknown as CloudRecords;

/** Loads every record of an organization, newest first within each collection (the store's order). */
export async function loadAppRecords(organizationId: string): Promise<CloudRecords> {
  const records = emptyRecords();
  for (let from = 0; ; from += PAGE_SIZE) {
    const {data, error} = await supabase
      .from('app_records')
      .select('collection,id,data')
      .eq('organization_id', organizationId)
      .order('collection')
      .order('created_at', {ascending: false})
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    for (const row of data) {
      const list = records[row.collection as CloudCollection];
      if (list) list.push({...(row.data as object), id: row.id} as CloudRecord);
    }
    if (data.length < PAGE_SIZE) return records;
  }
}

const chunks = <T>(items: T[]) =>
  Array.from({length: Math.ceil(items.length / WRITE_CHUNK)}, (_, i) =>
    items.slice(i * WRITE_CHUNK, (i + 1) * WRITE_CHUNK),
  );

const toRow = (organizationId: string, collection: CloudCollection, item: CloudRecord, createdAt?: string) => {
  const {id, ...data} = item;
  return {
    organization_id: organizationId,
    collection,
    id,
    data,
    updated_at: new Date().toISOString(),
    ...(createdAt ? {created_at: createdAt} : {}),
  };
};

/** Inserts new records and updates changed ones; history collections are insert-only. */
export async function writeAppRecords(organizationId: string, collection: CloudCollection, items: CloudRecord[]) {
  const mutable = MUTABLE_COLLECTIONS.has(collection);
  for (const chunk of chunks(items)) {
    const {error} = await supabase.from('app_records').upsert(
      chunk.map(item => toRow(organizationId, collection, item)),
      {onConflict: 'organization_id,collection,id', ignoreDuplicates: !mutable},
    );
    if (error) throw error;
  }
}

export async function deleteAppRecords(organizationId: string, collection: CloudCollection, ids: string[]) {
  for (const chunk of chunks(ids)) {
    const {error} = await supabase
      .from('app_records')
      .delete()
      .eq('organization_id', organizationId)
      .eq('collection', collection)
      .in('id', chunk);
    if (error) throw error;
  }
}

/**
 * Writes a full data set into an empty organization. Arrays are newest first, so
 * creation times are spaced backwards from now to keep that order on reload.
 * Existing records are left untouched, so an interrupted seed can simply run again.
 */
export async function seedAppRecords(organizationId: string, records: Partial<CloudRecords>) {
  const now = Date.now();
  for (const [collection, items] of Object.entries(records) as Array<[CloudCollection, CloudRecord[]]>) {
    const rows = items.map((item, index) =>
      toRow(organizationId, collection, item, new Date(now - index * 1000).toISOString()),
    );
    for (const chunk of chunks(rows)) {
      const {error} = await supabase
        .from('app_records')
        .upsert(chunk, {onConflict: 'organization_id,collection,id', ignoreDuplicates: true});
      if (error) throw error;
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
