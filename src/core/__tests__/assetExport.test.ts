import {describe, expect, it} from 'vitest';
import {setsExportTable, toolsExportTable, toolsGroupedExportTable} from '../assetExport';
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

  it('has the totals under the list: the pieces, the uses made and the uses left', () => {
    const table = toolsExportTable(
      [
        tool({}),
        tool({id: 't2', barcode: 'T000002', uses: 5, maxUses: 10}),
        tool({id: 't3', barcode: 'T000003', uses: 40, maxUses: undefined}),
      ],
      'Εργαλεία',
    );
    expect(table.totals?.[0]).toBe('Σύνολο εργαλείων: 3');
    // Uses made are counted for the instruments with a limit (7 and 5 here); the one without a limit adds none.
    expect(table.totals?.[table.headers.indexOf('Χρήσεις')]).toBe(7);
    // The uses left are not added up: they are a number of nothing.
    expect(table.totals?.[table.headers.indexOf('Υπόλοιπο')]).toBe('');
  });

  it('takes the instruments grouped by kind: the limit, the uses made, and the uses left per piece, not added up', () => {
    const table = toolsGroupedExportTable(
      [
        tool({id: 'a', uses: 0, maxUses: 10, fresh: true}),
        tool({id: 'b', uses: 10, maxUses: 10}),
        tool({id: 'c', uses: 8, maxUses: 10, department: 'ΑΙΘΟΥΣΑ ΤΟΚΕΤΩΝ'}),
        tool({id: 'd', name: 'ΑΛΛΟ', code: 'K9', uses: 0, maxUses: undefined}),
      ],
      'Εργαλεία',
      3,
    );
    expect(table.rows).toHaveLength(2);
    const at = (name: string) => table.headers.indexOf(name);
    const kind = table.rows.find(r => r[0] === 'LARGE NEEDLE DRIVER')!;
    expect(kind[at('Τεμάχια')]).toBe(3);
    expect(kind[at('Με όριο χρήσεων')]).toBe(3);
    expect(kind[at('Όριο χρήσεων')]).toBe('10');
    expect(kind[at('Χρήσεις που έγιναν')]).toBe(18);
    expect(kind[at('Υπόλοιπο ανά τεμάχιο')]).toBe('0–10');
    expect(kind[at('Εξαντλημένα')]).toBe(1);
    expect(kind[at('Λίγες χρήσεις')]).toBe(1);
    expect(kind[at('Καινούργια')]).toBe(1);
    expect(String(kind[at('Τμήμα')])).toContain('ΑΙΘΟΥΣΑ ΤΟΚΕΤΩΝ');
    expect(table.totals?.[at('Τεμάχια')]).toBe(4);
    expect(table.totals?.[at('Υπόλοιπο ανά τεμάχιο')]).toBe('');
    expect(table.totals?.[0]).toBe('Σύνολο ειδών: 2');
  });
});
