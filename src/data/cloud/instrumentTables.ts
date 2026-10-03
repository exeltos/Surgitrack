/**
 * Sets and instruments live in their own tables (instrument_sets, instruments), one column per
 * field. The store keeps working with records; this maps a record to a row and back. Fields with
 * no column yet are kept in `extra`, so a record always comes back exactly as it was saved.
 */
type FieldKind = 'text' | 'number' | 'json' | 'textArray';
type Field = readonly [field: string, column: string, kind: FieldKind];
type Row = Record<string, unknown>;

const SET_FIELDS: readonly Field[] = [
  ['barcode', 'barcode', 'text'],
  ['legacyBarcodes', 'legacy_barcodes', 'textArray'],
  ['code', 'code', 'text'],
  ['name', 'name', 'text'],
  ['department', 'department', 'text'],
  ['specialty', 'specialty', 'text'],
  ['manufacturer', 'manufacturer', 'text'],
  ['category', 'category', 'text'],
  ['state', 'state', 'text'],
  ['expected', 'expected', 'number'],
  ['actual', 'actual', 'number'],
  ['uses', 'uses', 'number'],
  ['maxUses', 'max_uses', 'number'],
  ['patientCode', 'patient_code', 'text'],
  ['createdAt', 'created_on', 'text'],
  ['notes', 'notes', 'text'],
  ['compositionTemplate', 'composition_template', 'json'],
  ['photos', 'photos', 'json'],
  ['colorTapes', 'color_tapes', 'textArray'],
  ['ownership', 'ownership', 'text'],
  ['ownerName', 'owner_name', 'text'],
];

const TOOL_FIELDS: readonly Field[] = [
  ['barcode', 'barcode', 'text'],
  ['legacyBarcodes', 'legacy_barcodes', 'textArray'],
  ['code', 'code', 'text'],
  ['name', 'name', 'text'],
  ['department', 'department', 'text'],
  ['specialty', 'specialty', 'text'],
  ['manufacturer', 'manufacturer', 'text'],
  ['mode', 'mode', 'text'],
  ['setId', 'set_id', 'text'],
  ['state', 'state', 'text'],
  ['uses', 'uses', 'number'],
  ['maxUses', 'max_uses', 'number'],
  ['sterilizations', 'sterilizations', 'number'],
  ['serialNumber', 'serial_number', 'text'],
  ['purchaseDate', 'purchase_date', 'text'],
  ['warrantyUntil', 'warranty_until', 'text'],
  ['cost', 'cost', 'number'],
  ['notes', 'notes', 'text'],
  ['imageUrl', 'image_url', 'text'],
  ['photos', 'photos', 'json'],
  ['colorMode', 'color_mode', 'text'],
  ['colorTapes', 'color_tapes', 'textArray'],
  ['ownership', 'ownership', 'text'],
  ['ownerName', 'owner_name', 'text'],
  ['retiredAt', 'retired_at', 'text'],
  ['retiredReason', 'retired_reason', 'text'],
  ['retiredNoticeSeenAt', 'retired_notice_seen_at', 'text'],
  ['retiredNoticeSeenBy', 'retired_notice_seen_by', 'text'],
];

/** Columns a record never carries: the row's identity and bookkeeping. */
const BOOKKEEPING = ['organization_id', 'id', 'extra', 'created_at', 'updated_at', 'updated_by'];

export const INSTRUMENT_TABLES = {
  sets: {table: 'instrument_sets', fields: SET_FIELDS},
  tools: {table: 'instruments', fields: TOOL_FIELDS},
} as const;
export type InstrumentCollection = keyof typeof INSTRUMENT_TABLES;

export const isInstrumentCollection = (collection: string): collection is InstrumentCollection =>
  collection in INSTRUMENT_TABLES;

/** The columns to read back, so a load never asks for more than the record needs. */
export const instrumentColumns = (collection: InstrumentCollection) =>
  ['id', 'extra', ...INSTRUMENT_TABLES[collection].fields.map(([, column]) => column)].join(',');

/** A store record as a table row. Values the database could not hold as columns stay in `extra`. */
export function instrumentToRow(
  organizationId: string,
  collection: InstrumentCollection,
  record: {id: string} & Record<string, unknown>,
  createdAt?: string,
): Row {
  const {id, ...rest} = record;
  const row: Row = {organization_id: organizationId, id};
  const extra: Record<string, unknown> = {...rest};
  for (const [field, column, kind] of INSTRUMENT_TABLES[collection].fields) {
    const value = rest[field];
    delete extra[field];
    if (value === undefined || value === null) {
      row[column] = null;
      continue;
    }
    const fits =
      kind === 'text'
        ? typeof value === 'string'
        : kind === 'number'
          ? typeof value === 'number' && Number.isFinite(value)
          : kind === 'textArray'
            ? Array.isArray(value) && value.every(item => typeof item === 'string')
            : true;
    if (fits) row[column] = value;
    else {
      // An unexpected shape is kept as it is rather than lost or rejected.
      row[column] = null;
      extra[field] = value;
    }
  }
  // Fields the database requires get their neutral value when a record leaves them out.
  if (row.code === null) row.code = '';
  if (collection === 'tools') {
    if (row.uses === null) row.uses = 0;
    if (row.sterilizations === null) row.sterilizations = 0;
  } else {
    if (row.expected === null) row.expected = 0;
    if (row.actual === null) row.actual = 0;
  }
  row.extra = Object.keys(extra).length ? extra : null;
  row.updated_at = new Date().toISOString();
  if (createdAt) row.created_at = createdAt;
  return row;
}

/** A table row as the store record it was saved from. */
export function instrumentFromRow(collection: InstrumentCollection, row: Row): {id: string} & Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const [field, column, kind] of INSTRUMENT_TABLES[collection].fields) {
    const value = row[column];
    if (value === null || value === undefined) continue;
    // numeric columns can arrive as strings; integers always arrive as numbers.
    record[field] = kind === 'number' && typeof value === 'string' ? Number(value) : value;
  }
  // A value kept in `extra` (one the columns could not hold) wins over the column's placeholder.
  Object.assign(record, (row.extra as Record<string, unknown> | null) || {});
  for (const column of BOOKKEEPING) delete record[column];
  return {...record, id: String(row.id)};
}
