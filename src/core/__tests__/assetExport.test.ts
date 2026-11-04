import {describe, expect, it} from 'vitest';
import {setsExportTable, toolsExportTable} from '../assetExport';
import type {SetAsset, Tool} from '../../types/domain';

const tool = (extra: Partial<Tool>) =>
  ({
    id: 't1',
    barcode: 'T000001',
    code: 'K1',
    name: 'LARGE NEEDLE DRIVER',
    manufacturer: 'Aesculap',
    specialty: 'Γενική',
    department: 'ΧΕΙΡΟΥΡΓΕΙΟ',
    state: 'IN_DEPARTMENT',
    mode: 'STANDALONE',
    uses: 2,
    maxUses: 15,
    ...extra,
  }) as unknown as Tool;

describe('the exports of the tool and Set lists', () => {
  it('has the uses made, the limit and what remains, and says so for an instrument without a limit', () => {
    const table = toolsExportTable(
      [tool({}), tool({id: 't2', barcode: 'T000002', uses: 40, maxUses: undefined})],
      'Εργαλεία',
    );
    expect(table.title).toBe('Εργαλεία');
    const used = table.headers.indexOf('Χρήσεις');
    const limit = table.headers.indexOf('Όριο χρήσεων');
    const left = table.headers.indexOf('Υπόλοιπο');
    expect(table.rows[0].slice(used, left + 1)).toEqual([2, 15, 13]);
    expect(table.rows[1].slice(used, left + 1)).toEqual([40, '', 'Χωρίς όριο']);
    expect(limit).toBe(used + 1);
  });

  it('shows a new instrument with its whole limit left', () => {
    const table = toolsExportTable([tool({uses: 0})], 'Εργαλεία');
    const left = table.headers.indexOf('Υπόλοιπο');
    expect(table.rows[0][left]).toBe(15);
  });

  it('has one row per Set with its instruments over those expected', () => {
    const set = {
      id: 's1',
      barcode: 'S000001',
      code: '',
      name: 'ΒΑΣΙΚΟ',
      specialty: 'Γενική',
      department: 'ΧΕΙΡΟΥΡΓΕΙΟ',
      state: 'READY_FOR_PICKUP',
      expected: 12,
      actual: 11,
      uses: 3,
      maxUses: 30,
    } as unknown as SetAsset;
    const table = setsExportTable([set], new Map([['s1', 11]]), 'Σετ εργαλείων');
    expect(table.rows[0][table.headers.indexOf('Εργαλεία')]).toBe('11/12');
    expect(table.rows[0][table.headers.indexOf('Υπόλοιπο')]).toBe(27);
  });
});
