import {describe, expect, it} from 'vitest';
import {usesOnDay} from '../usageHistory';
import {toolsExportTable, toolsGroupedExportTable} from '../assetExport';
import type {Movement, Tool} from '../../types/domain';

const tool = (extra: Partial<Tool>) =>
  ({
    id: 't1',
    barcode: 'T000001',
    code: 'K',
    name: 'NEEDLE',
    specialty: 'Γ',
    mode: 'STANDALONE',
    state: 'IN_DEPARTMENT',
    uses: 5,
    maxUses: 15,
    ...extra,
  }) as unknown as Tool;
const move = (at: string, status: string, asset = 'T000001 · NEEDLE') =>
  ({id: at + status, asset, assetKind: 'TOOL', from: '', to: '', status, at, by: ''}) as Movement;
const now = new Date(2026, 10, 4, 12).getTime();

describe('the uses of an instrument on a past day', () => {
  const movements = [
    move('01/10/2026 09:00', 'Δημιουργία φυσικού εργαλείου'),
    move('30/10/2026 10:00', 'Διόρθωση χρήσεων · 0 → 1 · Α'),
    move('02/11/2026 10:00', 'Διόρθωση χρήσεων · 1 → 3 · Α'),
    move('03/11/2026 10:00', 'Διόρθωση χρήσεων · 3 → 5 · Α'),
  ];
  const on = (day: string, tools = [tool({})]) => usesOnDay(tools, movements, day, now).byId.get('t1')!;
  it('takes the last correction up to the end of that day', () => {
    expect(on('2026-11-01').uses).toBe(1);
    expect(on('2026-11-02').uses).toBe(3);
  });
  it('takes the first correction\'s "before" when all came later, and today\'s uses when there are none', () => {
    expect(on('2026-10-15').uses).toBe(0);
    expect(usesOnDay([tool({id: 't9', barcode: 'T9'})], movements, '2026-11-01', now).byId.get('t9')!.uses).toBe(5);
  });
  it('says an instrument created later did not exist', () => {
    expect(on('2026-09-01').existed).toBe(false);
    expect(on('2026-10-15').existed).toBe(true);
  });
});

describe('the exports compared with a day', () => {
  const onDay = {
    day: '2026-11-01',
    byId: new Map([
      ['t1', {uses: 1, existed: true}],
      ['t2', {uses: 0, existed: false}],
    ]),
  };
  const tools = [tool({}), tool({id: 't2', barcode: 'T000002'})];
  it('adds the uses then, what was left and the difference, and leaves out what did not exist', () => {
    const table = toolsExportTable(tools, 'Εργαλεία', onDay);
    expect(table.rows).toHaveLength(1);
    const at = (h: string) => table.headers.indexOf(h);
    expect(table.rows[0][at('Χρήσεις την 1/11/2026')]).toBe(1);
    expect(table.rows[0][at('Υπόλοιπο την 1/11/2026')]).toBe(14);
    expect(table.rows[0][at('Διαφορά χρήσεων')]).toBe(4);
    expect(table.totals).toHaveLength(table.headers.length);
    expect(table.title).toContain('1/11/2026');
  });
  it('does the same for the grouped list, with totals under the right columns', () => {
    const table = toolsGroupedExportTable(tools, 'Εργαλεία', 3, onDay);
    const at = (h: string) => table.headers.indexOf(h);
    expect(table.rows[0][at('Χρήσεις την 1/11/2026')]).toBe(1);
    expect(table.rows[0][at('Διαφορά χρήσεων')]).toBe(4);
    expect(table.totals).toHaveLength(table.headers.length);
    expect(table.totals?.[at('Διαφορά χρήσεων')]).toBe(4);
    expect(table.totals?.[at('Εξαντλημένα')]).toBe(0);
  });
});
