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

  it('takes the instruments grouped by kind: the limit, the uses made, the uses left per piece and in all', () => {
    const table = toolsGroupedExportTable(
      [
        tool({id: 'a', uses: 0, maxUses: 10}),
        tool({id: 'b', uses: 10, maxUses: 10}),
        tool({id: 'c', uses: 8, maxUses: 10, department: 'ΑΙΘΟΥΣΑ ΤΟΚΕΤΩΝ'}),
        tool({id: 'd', name: 'ΑΛΛΟ', code: 'K9', uses: 0, maxUses: undefined}),
      ],
      'Εργαλεία',
      3,
    );
    const at = (name: string) => table.headers.indexOf(name);
    // The kind's pieces in use (b: exhausted, c: low), the one without a limit, and the new piece on its own row last.
    expect(table.rows.map(r => r[0])).toEqual(['ΑΛΛΟ', 'LARGE NEEDLE DRIVER', 'LARGE NEEDLE DRIVER (αχρησιμοποίητα)']);
    const inUse = table.rows[1];
    expect(inUse[at('Τεμάχια')]).toBe(2);
    // «Με όριο χρήσεων» is not a column (it repeated «Τεμάχια»).
    expect(table.headers).not.toContain('Με όριο χρήσεων');
    expect(inUse[at('Όριο χρήσεων')]).toBe('10');
    expect(inUse[at('Χρήσεις που έγιναν')]).toBe(18);
    expect(inUse[at('Υπόλοιπο ανά τεμάχιο')]).toBe('0–2');
    // 0 + 2 uses left by the two pieces in use.
    expect(inUse[at('Σύνολο υπολοίπων χρήσεων')]).toBe(2);
    expect(inUse[at('Εξαντλημένα')]).toBe(1);
    expect(inUse[at('Λίγες χρήσεις')]).toBe(1);
    expect(inUse[at('Αχρησιμοποίητα')]).toBe(0);
    expect(String(inUse[at('Τμήμα')])).toContain('ΑΙΘΟΥΣΑ ΤΟΚΕΤΩΝ');
    const fresh = table.rows[2];
    expect(fresh[at('Τεμάχια')]).toBe(1);
    expect(fresh[at('Σύνολο υπολοίπων χρήσεων')]).toBe(10);
    expect(fresh[at('Αχρησιμοποίητα')]).toBe(1);
    // The totals count every piece; the kinds are counted once each (not once per row).
    expect(table.totals?.[at('Τεμάχια')]).toBe(4);
    expect(table.totals?.[at('Υπόλοιπο ανά τεμάχιο')]).toBe('');
    expect(table.totals?.[at('Σύνολο υπολοίπων χρήσεων')]).toBe(12);
    expect(table.totals?.[0]).toBe('Σύνολο ειδών: 2');
  });
});
