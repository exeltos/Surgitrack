import {beforeEach, describe, expect, it, vi} from 'vitest';

type Row = Record<string, unknown>;
type DbError = {code: string; message: string};

/** A table in memory: `refuse` decides which rows the database turns down, and how. */
const db = {
  existing: new Set<string>(),
  refuse: (() => null) as (row: Row, op: string) => DbError | null,
  calls: [] as Array<{op: string; ids: string[]}>,
};
const answer = (op: string, rows: Row[]) => {
  db.calls.push({op, ids: rows.map(row => String(row.id))});
  const error = rows.map(row => db.refuse(row, op)).find(Boolean) || null;
  if (error) return {data: null, error};
  if (op === 'update') rows = rows.filter(row => db.existing.has(String(row.id)));
  else rows.forEach(row => db.existing.add(String(row.id)));
  return {data: rows.map(row => ({id: row.id, updated_at: '2026-10-09T10:00:00Z'})), error: null};
};
const query = (run: () => {data: unknown; error: DbError | null}) => ({
  select: () => query(run),
  then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
    Promise.resolve().then(run).then(resolve, reject),
});

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      upsert: (rows: Row[]) => query(() => answer('upsert', rows)),
      insert: (row: Row) => query(() => answer('insert', [row])),
      update: (changes: Row) => {
        let id = '';
        const builder = {
          eq: (column: string, value: string) => {
            if (column === 'id') id = value;
            return builder;
          },
          select: () => query(() => answer('update', [{...changes, id}])),
        };
        return builder;
      },
      delete: () => {
        const builder = {
          eq: () => builder,
          in: (_column: string, ids: string[]) =>
            query(() =>
              answer(
                'delete',
                ids.map(id => ({id})),
              ),
            ),
        };
        return builder;
      },
    }),
  },
}));

const {writeAppRecords, deleteAppRecords} = await import('../appRecords');

const tool = (n: number) => ({id: `t${n}`, barcode: `T${String(n).padStart(6, '0')}`, name: `Tool ${n}`});

describe('saving records', () => {
  beforeEach(() => {
    db.existing.clear();
    db.calls = [];
    db.refuse = () => null;
  });

  it('finds the record with a barcode clash by halving the batch, and saves the rest', async () => {
    db.refuse = row =>
      row.barcode === 'T000006' ? {code: '23505', message: 'violates "instruments_organization_id_barcode_key"'} : null;
    const items = Array.from({length: 8}, (_, i) => tool(i + 1));
    const outcome = await writeAppRecords('org-1', 'tools', items);
    expect(outcome).toEqual({rejected: ['t6'], stale: [], refused: []});
    expect([...db.existing].sort()).toEqual(['t1', 't2', 't3', 't4', 't5', 't7', 't8']);
    // 8 → 4 + 4 → 2 + 2 → 1 + 1, then the clashing one on its own: far fewer than one request per record.
    expect(db.calls.filter(call => call.op === 'upsert').length).toBeLessThan(8);
  });

  it('reports a history record refused for good instead of failing the whole save', async () => {
    db.refuse = row => (row.id === 'm2' ? {code: '42501', message: 'new row violates row-level security'} : null);
    const outcome = await writeAppRecords('org-1', 'movements', [
      {id: 'm1', asset: 'T000001'},
      {id: 'm2', asset: 'T000002'},
      {id: 'm3', asset: 'T000003'},
    ] as never);
    expect(outcome.refused).toEqual([{id: 'm2', code: '42501', message: 'new row violates row-level security'}]);
    expect([...db.existing].sort()).toEqual(['m1', 'm3']);
  });

  it('lets a department user update records one by one when the batch upsert is refused', async () => {
    db.existing = new Set(['t1', 't2']);
    db.refuse = (_row, op) => (op === 'upsert' ? {code: '42501', message: 'row-level security'} : null);
    const outcome = await writeAppRecords('org-1', 'tools', [tool(1), tool(2)]);
    expect(outcome).toEqual({rejected: [], stale: [], refused: []});
    expect(db.calls.filter(call => call.op === 'update').length).toBe(2);
  });

  it('throws what is worth another try (network, server)', async () => {
    db.refuse = () => ({code: '', message: 'TypeError: Failed to fetch'});
    await expect(writeAppRecords('org-1', 'tools', [tool(1)])).rejects.toMatchObject({message: /Failed to fetch/});
  });

  it('returns a delete the database refuses for good, and deletes the rest', async () => {
    db.existing = new Set(['t1', 't2']);
    db.refuse = (row, op) => (op === 'delete' && row.id === 't2' ? {code: '23503', message: 'still referenced'} : null);
    expect(await deleteAppRecords('org-1', 'tools', ['t1', 't2'])).toEqual([
      {id: 't2', code: '23503', message: 'still referenced'},
    ]);
  });
});
