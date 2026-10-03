/**
 * Store collections that live in their own tables, one column per field. The store keeps working
 * with records; this maps a record to a row and back. Fields with no column yet are kept in
 * `extra`, so a record always comes back exactly as it was saved.
 */
type FieldKind = 'text' | 'number' | 'boolean' | 'json' | 'textArray';
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

const MOVEMENT_FIELDS: readonly Field[] = [
  ['asset', 'asset', 'text'],
  ['assetKind', 'asset_kind', 'text'],
  ['from', 'from_location', 'text'],
  ['to', 'to_location', 'text'],
  ['status', 'status', 'text'],
  ['at', 'at', 'text'],
  ['by', 'by_name', 'text'],
  ['patientCode', 'patient_code', 'text'],
  ['note', 'note', 'text'],
];

const ISSUE_FIELDS: readonly Field[] = [
  ['asset', 'asset', 'text'],
  ['type', 'type', 'text'],
  ['status', 'status', 'text'],
  ['created', 'created_on', 'text'],
  ['department', 'department', 'text'],
  ['note', 'note', 'text'],
  ['photos', 'photos', 'json'],
];

const RECEIPTS_FIELDS: readonly Field[] = [
  ['workflowVersion', 'workflow_version', 'number'],
  ['batchId', 'batch_id', 'text'],
  ['assetId', 'asset_id', 'text'],
  ['assetKind', 'asset_kind', 'text'],
  ['barcode', 'barcode', 'text'],
  ['assetName', 'asset_name', 'text'],
  ['fromDepartment', 'from_department', 'text'],
  ['toDepartment', 'to_department', 'text'],
  ['deliveredByUserId', 'delivered_by_user_id', 'text'],
  ['deliveredByName', 'delivered_by_name', 'text'],
  ['deliveredByDepartment', 'delivered_by_department', 'text'],
  ['receivedByUserId', 'received_by_user_id', 'text'],
  ['receivedByName', 'received_by_name', 'text'],
  ['receivedByDepartment', 'received_by_department', 'text'],
  ['at', 'at', 'text'],
  ['note', 'note', 'text'],
  ['visibleDeviation', 'visible_deviation', 'boolean'],
  ['departmentMismatch', 'department_mismatch', 'boolean'],
  ['departmentMismatchReason', 'department_mismatch_reason', 'text'],
  ['expected', 'expected', 'number'],
  ['actual', 'actual', 'number'],
  ['checkPerformed', 'check_performed', 'boolean'],
  ['checkedCount', 'checked_count', 'number'],
  ['checkResult', 'check_result', 'text'],
  ['checkNote', 'check_note', 'text'],
  ['itemChecks', 'item_checks', 'json'],
  ['setChecks', 'set_checks', 'json'],
];

const DELIVERIES_FIELDS: readonly Field[] = [
  ['workflowVersion', 'workflow_version', 'number'],
  ['batchId', 'batch_id', 'text'],
  ['assetId', 'asset_id', 'text'],
  ['assetKind', 'asset_kind', 'text'],
  ['barcode', 'barcode', 'text'],
  ['assetName', 'asset_name', 'text'],
  ['department', 'department', 'text'],
  ['deliveredByUserId', 'delivered_by_user_id', 'text'],
  ['deliveredByName', 'delivered_by_name', 'text'],
  ['deliveredByDepartment', 'delivered_by_department', 'text'],
  ['receivedByUserId', 'received_by_user_id', 'text'],
  ['receivedByName', 'received_by_name', 'text'],
  ['receivedByDepartment', 'received_by_department', 'text'],
  ['at', 'at', 'text'],
  ['note', 'note', 'text'],
];

const PREPARATIONS_FIELDS: readonly Field[] = [
  ['workflowVersion', 'workflow_version', 'number'],
  ['assetId', 'asset_id', 'text'],
  ['assetKind', 'asset_kind', 'text'],
  ['barcode', 'barcode', 'text'],
  ['assetName', 'asset_name', 'text'],
  ['department', 'department', 'text'],
  ['preparedByUserId', 'prepared_by_user_id', 'text'],
  ['preparedByName', 'prepared_by_name', 'text'],
  ['preparedByDepartment', 'prepared_by_department', 'text'],
  ['at', 'at', 'text'],
  ['toolIds', 'tool_ids', 'textArray'],
  ['checkedToolIds', 'checked_tool_ids', 'textArray'],
  ['allOk', 'all_ok', 'boolean'],
  ['processChecks', 'process_checks', 'json'],
  ['note', 'note', 'text'],
];

const SURGICAL_COUNTS_FIELDS: readonly Field[] = [
  ['setId', 'set_id', 'text'],
  ['patientCode', 'patient_code', 'text'],
  ['expected', 'expected', 'number'],
  ['counted', 'counted', 'number'],
  ['result', 'result', 'text'],
  ['note', 'note', 'text'],
  ['at', 'at', 'text'],
  ['by', 'by_name', 'text'],
  ['signed', 'signed', 'boolean'],
];

const WORKFLOW_CHECKPOINTS_FIELDS: readonly Field[] = [
  ['workflowVersion', 'workflow_version', 'number'],
  ['assetId', 'asset_id', 'text'],
  ['assetKind', 'asset_kind', 'text'],
  ['barcode', 'barcode', 'text'],
  ['assetName', 'asset_name', 'text'],
  ['department', 'department', 'text'],
  ['stageId', 'stage_id', 'text'],
  ['checks', 'checks', 'json'],
  ['note', 'note', 'text'],
  ['completedByUserId', 'completed_by_user_id', 'text'],
  ['completedByName', 'completed_by_name', 'text'],
  ['completedByDepartment', 'completed_by_department', 'text'],
  ['completedAt', 'completed_on', 'text'],
];

/** Columns a record never carries: the row's identity and bookkeeping. */
const BOOKKEEPING = ['organization_id', 'id', 'extra', 'created_at', 'updated_at', 'updated_by', 'created_by'];

type TableSpec = {
  table: string;
  fields: readonly Field[];
  /** Records change after creation (otherwise history: written once). */
  mutable: boolean;
  /** Values for columns the database requires when a record leaves them out. */
  defaults?: Record<string, unknown>;
};

export const CLOUD_TABLES = {
  sets: {
    table: 'instrument_sets',
    fields: SET_FIELDS,
    mutable: true,
    defaults: {code: '', expected: 0, actual: 0},
  },
  tools: {table: 'instruments', fields: TOOL_FIELDS, mutable: true, defaults: {code: '', uses: 0, sterilizations: 0}},
  movements: {table: 'movements', fields: MOVEMENT_FIELDS, mutable: false},
  issues: {table: 'issues', fields: ISSUE_FIELDS, mutable: true, defaults: {note: ''}},
  receipts: {table: 'receipts', fields: RECEIPTS_FIELDS, mutable: false},
  deliveries: {table: 'deliveries', fields: DELIVERIES_FIELDS, mutable: false},
  preparations: {table: 'preparations', fields: PREPARATIONS_FIELDS, mutable: false},
  counts: {table: 'surgical_counts', fields: SURGICAL_COUNTS_FIELDS, mutable: false},
  workflowCheckpoints: {table: 'workflow_checkpoints', fields: WORKFLOW_CHECKPOINTS_FIELDS, mutable: false},
} as const satisfies Record<string, TableSpec>;
export type TableCollection = keyof typeof CLOUD_TABLES;
export const TABLE_COLLECTIONS = Object.keys(CLOUD_TABLES) as TableCollection[];

export const isTableCollection = (collection: string): collection is TableCollection => collection in CLOUD_TABLES;

/** The columns to read back, so a load never asks for more than the record needs. */
export const tableColumns = (collection: TableCollection) =>
  ['id', 'extra', ...CLOUD_TABLES[collection].fields.map(([, column]) => column)].join(',');

const fits = (kind: FieldKind, value: unknown) =>
  kind === 'text'
    ? typeof value === 'string'
    : kind === 'number'
      ? typeof value === 'number' && Number.isFinite(value)
      : kind === 'boolean'
        ? typeof value === 'boolean'
        : kind === 'textArray'
          ? Array.isArray(value) && value.every(item => typeof item === 'string')
          : true;

/** A store record as a table row. Values the database could not hold as columns stay in `extra`. */
export function tableToRow(
  organizationId: string,
  collection: TableCollection,
  record: {id: string} & Record<string, unknown>,
  createdAt?: string,
): Row {
  const spec: TableSpec = CLOUD_TABLES[collection];
  const {id, ...rest} = record;
  const row: Row = {organization_id: organizationId, id};
  const extra: Record<string, unknown> = {...rest};
  for (const [field, column, kind] of spec.fields) {
    const value = rest[field];
    delete extra[field];
    if (value === undefined || value === null) row[column] = null;
    else if (fits(kind, value)) row[column] = value;
    else {
      // An unexpected shape is kept as it is rather than lost or rejected.
      row[column] = null;
      extra[field] = value;
    }
  }
  for (const [column, value] of Object.entries(spec.defaults || {})) if (row[column] === null) row[column] = value;
  row.extra = Object.keys(extra).length ? extra : null;
  if (spec.mutable) row.updated_at = new Date().toISOString();
  if (createdAt) row.created_at = createdAt;
  return row;
}

/** A table row as the store record it was saved from. */
export function tableFromRow(collection: TableCollection, row: Row): {id: string} & Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const [field, column, kind] of CLOUD_TABLES[collection].fields) {
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
