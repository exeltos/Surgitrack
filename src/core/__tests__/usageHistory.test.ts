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

describe('ties and earlier barcodes', () => {
  it('keeps corrections of the same minute in order (movements are kept newest first)', () => {
    const newestFirst = [
      move('02/11/2026 10:00', 'Διόρθωση χρήσεων · 1 → 2 · Α'),
      move('02/11/2026 10:00', 'Διόρθωση χρήσεων · 0 → 1 · Α'),
    ];
    const t = [tool({uses: 2})];
    expect(usesOnDay(t, newestFirst, '2026-11-02', now).byId.get('t1')!.uses).toBe(2);
    expect(usesOnDay(t, newestFirst, '2026-11-01', now).byId.get('t1')!.uses).toBe(0);
  });
  it('counts the history under an earlier barcode', () => {
    const old = [
      move('30/10/2026 10:00', 'Διόρθωση χρήσεων · 0 → 1 · Α', 'T000009 · NEEDLE'),
      move('01/10/2026 09:00', 'Δημιουργία φυσικού εργαλείου', 'T000009 · NEEDLE'),
    ];
    const t = [tool({uses: 2, legacyBarcodes: ['T000009']})];
    expect(usesOnDay(t, old, '2026-11-01', now).byId.get('t1')!.uses).toBe(1);
    expect(usesOnDay(t, old, '2026-09-01', now).byId.get('t1')!.existed).toBe(false);
  });
});

describe('the exports on a day', () => {
  const onDay = {
    day: '2026-11-01',
    byId: new Map([
      ['t1', {uses: 1, existed: true}],
      ['t2', {uses: 0, existed: false}],
    ]),
  };
  const tools = [tool({}), tool({id: 't2', barcode: 'T000002'})];
  it('shows the uses and what was left on that day, and leaves out what did not exist', () => {
    const table = toolsExportTable(tools, 'Εργαλεία', onDay);
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0][table.headers.indexOf('Χρήσεις')]).toBe(1);
    expect(table.rows[0][table.headers.indexOf('Υπόλοιπο')]).toBe(14);
    expect(table.title).toContain('1/11/2026');
    expect(table.totals).toHaveLength(table.headers.length);
  });
  it('does the same for the grouped list', () => {
    const table = toolsGroupedExportTable(tools, 'Εργαλεία', 3, onDay);
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0][table.headers.indexOf('Χρήσεις που έγιναν')]).toBe(1);
    expect(table.rows[0][table.headers.indexOf('Υπόλοιπο ανά τεμάχιο')]).toBe('14');
    expect(table.title).toContain('1/11/2026');
  });
});
