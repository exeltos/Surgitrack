import {describe, expect, it} from 'vitest';
import {demoSurgiRepository} from '../../repositories/demoRepository';
import {instrumentFromRow, instrumentToRow} from '../instrumentTables';

const ORG = '11111111-2222-4333-8444-555555555555';
type Item = {id: string} & Record<string, unknown>;
/** What the database hands back: the written row, minus the bookkeeping it fills in itself. */
const roundTrip = (collection: 'sets' | 'tools', item: Item) => {
  const row = instrumentToRow(ORG, collection, item);
  return instrumentFromRow(collection, JSON.parse(JSON.stringify(row)));
};

describe('instrument tables', () => {
  const data = demoSurgiRepository.getInitialData();

  it('brings every demo Set and instrument back exactly as it was saved', () => {
    for (const set of data.sets) expect(roundTrip('sets', set as unknown as Item)).toEqual(set);
    for (const tool of data.tools) expect(roundTrip('tools', tool as unknown as Item)).toEqual(tool);
  });

  it('puts known fields in columns and keeps unknown ones in extra', () => {
    const row = instrumentToRow(ORG, 'tools', {
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
    const row = instrumentToRow(ORG, 'tools', tool);
    expect(row.uses).toBe(0);
    expect(row.extra).toEqual({uses: '4'});
    expect(roundTrip('tools', tool)).toEqual(tool);
  });

  it('reads numeric columns sent as text as numbers', () => {
    const record = instrumentFromRow('tools', {id: 't3', barcode: 'T3', cost: '12.50', extra: null});
    expect(record).toEqual({id: 't3', barcode: 'T3', cost: 12.5});
  });
});
