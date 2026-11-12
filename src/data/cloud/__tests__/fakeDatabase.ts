/**
 * A database in memory for the sync's tests (syncAtScale, saveTogether), that behaves like ours where it
 * matters: it stamps updated_at, refuses a save made from an old version (40001, S4, see
 * 20261008160000_version_check.sql), answers the same queries, and saves a group of records in one
 * transaction (save_records_together, 20261112100000). Its state lives on globalThis, so that every station's
 * own copy of the modules (vi.resetModules) talks to the same database.
 */
type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;
type DbError = {code: string; message: string};

type FakeDatabase = {
  tables: Map<string, Map<string, Row>>;
  requests: Array<{op: string; table: string; rows: number}>;
  lastStamp: number;
  /** Records each write of a device's copy put on its disk (IndexedDB). */
  copies: number[];
  /** Saves refused because the record changed since the station saw it. */
  stale: number;
  /** A rule of the database (a check, row security): the error for a row it refuses, else null. */
  refuse: (table: string, row: Row) => DbError | null;
  /** save_records_together: there, not there yet, or out of reach (no connection). */
  together: 'ok' | 'missing' | 'offline';
};
const shared = globalThis as unknown as {surgitrackFakeDatabase?: FakeDatabase};
export const db: FakeDatabase = (shared.surgitrackFakeDatabase ??= {
  tables: new Map(),
  requests: [],
  lastStamp: 0,
  copies: [],
  stale: 0,
  refuse: () => null,
  together: 'ok',
});
/** A fresh, empty database for the next test. */
export const resetDatabase = () => {
  db.tables.clear();
  db.requests.length = 0;
  db.copies.length = 0;
  db.lastStamp = 0;
  db.stale = 0;
  db.refuse = () => null;
  db.together = 'ok';
};

const stamp = () => {
  db.lastStamp = Math.max(Date.now(), db.lastStamp + 1);
  return new Date(db.lastStamp).toISOString();
};
export const tableOf = (name: string) => {
  let table = db.tables.get(name);
  if (!table) db.tables.set(name, (table = new Map()));
  return table;
};
const staleError = (id: unknown): DbError => (
  db.stale++,
  {code: '40001', message: `record ${String(id)} changed on another device`}
);
/** The tables whose records change after they are created (they have updated_at). */
const VERSIONED = new Set([
  'instrument_sets',
  'instruments',
  'issues',
  'process_loads',
  'recall_cases',
  'purchase_orders',
]);

/** Applies one row as the version-check trigger does; returns an error for a save from an old version. */
const writeRow = (name: string, row: Row, mode: 'upsert' | 'update' | 'insert'): DbError | null => {
  const table = tableOf(name);
  const refused = db.refuse(name, row);
  if (refused) return refused;
  const id = String(row.id);
  const old = table.get(id);
  const {expected_updated_at: expected, ...fields} = row;
  if (mode === 'insert' && old) return {code: '23505', message: `duplicate key value violates "${name}_pkey"`};
  if (old) {
    if (expected !== null && expected !== undefined && old.updated_at !== expected) return staleError(id);
    table.set(id, {...old, ...fields, created_at: old.created_at, updated_at: stamp()});
  } else if (mode !== 'update') {
    const now = stamp();
    table.set(id, {...fields, created_at: now, updated_at: now});
  }
  return null;
};
/** Everything as it is now, to put back when a transaction fails. */
const snapshot = () => new Map([...db.tables].map(([name, table]) => [name, new Map(table)]));
const restore = (saved: Map<string, Map<string, Row>>) => {
  db.tables.clear();
  saved.forEach((table, name) => db.tables.set(name, table));
};
const answer = <T>(run: () => T) => ({
  then: (resolve: (value: T) => unknown, reject: (error: unknown) => unknown) =>
    Promise.resolve().then(run).then(resolve, reject),
});

const from = (name: string) => {
  const filters: Filter[] = [];
  const orders: Array<[string, boolean]> = [];
  let op: 'select' | 'upsert' | 'update' | 'insert' | 'delete' = 'select';
  let payload: Row[] = [];
  let changes: Row = {};
  let range: [number, number] | undefined;
  let count = false;
  let ignoreDuplicates = false;
  const run = () => {
    const table = tableOf(name);
    const matches = () => [...table.values()].filter(row => filters.every(filter => filter(row)));
    if (op === 'select') {
      let rows = matches();
      for (const [column, ascending] of [...orders].reverse())
        rows = [...rows].sort((a, b) => {
          const x = String(a[column] ?? '');
          const y = String(b[column] ?? '');
          return (x < y ? -1 : x > y ? 1 : 0) * (ascending ? 1 : -1);
        });
      const total = rows.length;
      if (range) rows = rows.slice(range[0], range[1] + 1);
      db.requests.push({op, table: name, rows: rows.length});
      return {data: rows.map(row => ({...row})), error: null, count: count ? total : null};
    }
    if (op === 'delete') {
      const gone = matches();
      gone.forEach(row => table.delete(String(row.id)));
      db.requests.push({op, table: name, rows: gone.length});
      return {data: null, error: null};
    }
    const rows = op === 'update' ? matches().map(row => ({...changes, id: row.id})) : payload;
    db.requests.push({op, table: name, rows: rows.length});
    // One statement: a refused row refuses all of it, as in Postgres.
    const before = snapshot();
    for (const row of rows) {
      if (op === 'upsert' && ignoreDuplicates && table.has(String(row.id))) continue;
      const error = writeRow(name, row, op === 'upsert' ? 'upsert' : op);
      if (error) {
        restore(before);
        return {data: null, error};
      }
    }
    return {
      data: rows.map(row => ({id: row.id, updated_at: tableOf(name).get(String(row.id))?.updated_at})),
      error: null,
    };
  };
  const builder = {
    select: (_columns?: string, options?: {count?: string}) => {
      if (options?.count) count = true;
      return builder;
    },
    eq: (column: string, value: unknown) => (filters.push(row => row[column] === value), builder),
    in: (column: string, values: unknown[]) => {
      const set = new Set(values);
      filters.push(row => set.has(row[column]));
      return builder;
    },
    gte: (column: string, value: string) => (filters.push(row => String(row[column] ?? '') >= value), builder),
    lt: (column: string, value: string) => (filters.push(row => String(row[column] ?? '') < value), builder),
    or: (expression: string) => {
      const parts = expression.split(',').map(part => part.split('.gte.'));
      filters.push(row => parts.some(([column, value]) => String(row[column] ?? '') >= value));
      return builder;
    },
    order: (column: string, options?: {ascending?: boolean}) => (
      orders.push([column, options?.ascending !== false]),
      builder
    ),
    range: (start: number, end: number) => ((range = [start, end]), builder),
    upsert: (rows: Row[], options?: {ignoreDuplicates?: boolean}) => {
      op = 'upsert';
      payload = rows;
      ignoreDuplicates = !!options?.ignoreDuplicates;
      return builder;
    },
    insert: (rows: Row | Row[]) => ((op = 'insert'), (payload = Array.isArray(rows) ? rows : [rows]), builder),
    update: (fields: Row) => ((op = 'update'), (changes = fields), builder),
    delete: () => ((op = 'delete'), builder),
    then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
      answer(run).then(resolve, reject),
  };
  return builder;
};

/** save_records_together: every row in order, in one transaction. */
const saveTogether = (rows: Array<{table: string; row: Row}>) => {
  db.requests.push({op: 'rpc', table: 'save_records_together', rows: rows.length});
  if (db.together === 'missing')
    return {data: null, error: {code: 'PGRST202', message: 'Could not find the function save_records_together'}};
  if (db.together === 'offline') return {data: null, error: {code: '', message: 'TypeError: Failed to fetch'}};
  const before = snapshot();
  const saved: Array<{table: string; id: string; updated_at: unknown}> = [];
  for (const {table, row} of rows) {
    const id = String(row.id);
    const versioned = VERSIONED.has(table);
    const error = versioned
      ? writeRow(table, row, 'upsert')
      : tableOf(table).has(id)
        ? null
        : writeRow(table, row, 'insert');
    if (error) {
      restore(before);
      return {data: null, error};
    }
    if (versioned) saved.push({table, id, updated_at: tableOf(table).get(id)?.updated_at});
  }
  return {data: saved, error: null};
};

export const fakeSupabase = {
  from,
  rpc: (name: string, args: {p_rows: Array<{table: string; row: Row}>}) =>
    answer(() =>
      name === 'save_records_together'
        ? saveTogether(args.p_rows)
        : {data: null, error: {code: 'PGRST202', message: `Could not find the function ${name}`}},
    ),
  auth: {onAuthStateChange: () => undefined},
};
