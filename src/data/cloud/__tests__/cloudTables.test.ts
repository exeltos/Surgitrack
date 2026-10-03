import {describe, expect, it} from 'vitest';
import {demoSurgiRepository} from '../../repositories/demoRepository';
import {TABLE_COLLECTIONS, tableFromRow, tableToRow, type TableCollection} from '../cloudTables';

const ORG = '11111111-2222-4333-8444-555555555555';
type Item = {id: string} & Record<string, unknown>;
/** What the database hands back: the written row, minus the bookkeeping it fills in itself. */
const roundTrip = (collection: TableCollection, item: Item) => {
  const row = tableToRow(ORG, collection, item);
  return tableFromRow(collection, JSON.parse(JSON.stringify(row)));
};

describe('cloud tables', () => {
  const data = demoSurgiRepository.getInitialData();

  it('brings every demo record back exactly as it was saved', () => {
    const initial = data as unknown as Record<string, Item[] | undefined>;
    let checked = 0;
    for (const collection of TABLE_COLLECTIONS)
      for (const item of initial[collection] || []) {
        expect(roundTrip(collection, item)).toEqual(item);
        checked++;
      }
    expect(checked).toBeGreaterThan(300);
  });

  it('keeps booleans, id lists and nested checks of the sterilization records', () => {
    const preparation = {
      id: 'p1',
      workflowVersion: 3,
      assetId: 's1',
      assetKind: 'SET',
      barcode: 'S1',
      assetName: 'Σετ',
      department: 'Χειρουργείο',
      preparedByUserId: 'u1',
      preparedByName: 'Μ.',
      preparedByDepartment: 'Αποστείρωση',
      at: '30/9/26, 10:27 π.μ.',
      toolIds: ['t1', 't2'],
      checkedToolIds: ['t1'],
      allOk: false,
      processChecks: {cleanDry: true, functionIntegrity: false, assembly: true, packaging: true, labelIndicator: true},
    };
    const checkpoint = {
      id: 'w1',
      workflowVersion: 3,
      assetId: 's1',
      assetKind: 'SET',
      barcode: 'S1',
      assetName: 'Σετ',
      department: 'Χειρουργείο',
      stageId: 'WASHING',
      checks: [true, false, true],
      completedByUserId: 'u1',
      completedByName: 'Μ.',
      completedByDepartment: 'Αποστείρωση',
      completedAt: '30/9/26',
    };
    const count = {
      id: 'c1',
      setId: 's1',
      patientCode: 'P1',
      expected: 10,
      counted: 9,
      result: 'MISSING',
      note: '',
      at: 'x',
      by: 'Μ.',
      signed: true,
    };
    expect(roundTrip('preparations', preparation)).toEqual(preparation);
    expect(roundTrip('workflowCheckpoints', checkpoint)).toEqual(checkpoint);
    expect(roundTrip('counts', count)).toEqual(count);
    expect(tableToRow(ORG, 'preparations', preparation)).toMatchObject({
      tool_ids: ['t1', 't2'],
      all_ok: false,
      extra: null,
    });
  });

  it('writes history without a change stamp and changeable records with one', () => {
    const movement = tableToRow(ORG, 'movements', {
      id: 'm1',
      asset: 'S1 · Σετ',
      assetKind: 'SET',
      from: 'A',
      to: 'B',
      status: 'x',
      at: '1/1/26',
      by: 'N',
    });
    expect(movement).not.toHaveProperty('updated_at');
    expect(movement).toMatchObject({from_location: 'A', to_location: 'B', by_name: 'N', extra: null});
    expect(
      tableToRow(ORG, 'issues', {id: 'i1', asset: 'a', type: 't', status: 'OPEN', created: 'c', department: 'd'}),
    ).toMatchObject({
      note: '',
      updated_at: expect.any(String),
    });
  });

  it('puts known fields in columns and keeps unknown ones in extra', () => {
    const row = tableToRow(ORG, 'tools', {
      id: 't1',
      barcode: 'T000001',
      code: 'C1',
      name: 'Λαβίδα',
      mode: 'STOCK',
      state: 'IN_STOCK',
      uses: 3,
      sterilizations: 1,
      colorTapes: ['red'],
      futureField: {a: 1},
    });
    expect(row).toMatchObject({
      organization_id: ORG,
      id: 't1',
      barcode: 'T000001',
      uses: 3,
      color_tapes: ['red'],
      set_id: null,
      extra: {futureField: {a: 1}},
    });
    expect(row).not.toHaveProperty('futureField');
  });

  it('keeps a value of an unexpected type in extra instead of losing it', () => {
    const tool = {
      id: 't2',
      barcode: 'T2',
      code: 'C',
      name: 'N',
      mode: 'STOCK',
      state: 'IN_STOCK',
      uses: '4',
      sterilizations: 0,
    };
    const row = tableToRow(ORG, 'tools', tool);
    expect(row.uses).toBe(0);
    expect(row.extra).toEqual({uses: '4'});
    expect(roundTrip('tools', tool)).toEqual(tool);
  });

  it('reads numeric columns sent as text as numbers', () => {
    const record = tableFromRow('tools', {id: 't3', barcode: 'T3', cost: '12.50', extra: null});
    expect(record).toEqual({id: 't3', barcode: 'T3', cost: 12.5});
  });
});
