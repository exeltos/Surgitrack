import {describe, expect, it} from 'vitest';
import {belowMinimum, minimumRows, orderLinesForMinimums} from '../stockMinimums';
import type {PurchaseOrder, Tool} from '../../types/domain';

const tool = (id: string, patch: Partial<Tool> = {}): Tool => ({
  id,
  barcode: `T${id}`,
  code: 'KOCH',
  name: 'ΛΑΒΙΔΑ KOCHER',
  specialty: '',
  mode: 'STOCK',
  state: 'IN_STOCK',
  uses: 0,
  sterilizations: 0,
  ...patch,
});
const order = (status: PurchaseOrder['status'], quantity: number): PurchaseOrder =>
  ({
    id: 'o',
    number: 'ΠΑ-1',
    status,
    createdAt: '',
    createdByName: '',
    lines: [{code: 'KOCH', name: 'ΛΑΒΙΔΑ KOCHER', quantity, toolIds: [], barcodes: []}],
  }) as PurchaseOrder;

describe('stock minimums', () => {
  it('counts only idle Stock instruments against the minimum', () => {
    const tools = [
      tool('1'),
      tool('2'),
      tool('3', {mode: 'SET_MEMBER', state: 'IN_DEPARTMENT'}),
      tool('4', {state: 'SERVICE'}),
    ];
    const [row] = minimumRows(tools, [], {'C:KOCH': 4});
    expect(row).toMatchObject({stock: 2, min: 4, onOrder: 0, missing: 2, status: 'LOW'});
  });

  it('says OUT when none is left, OK at or above the minimum, NONE when no minimum is set', () => {
    expect(minimumRows([], [], {'C:KOCH': 3})[0]).toMatchObject({status: 'OUT', stock: 0, missing: 3, name: 'KOCH'});
    expect(minimumRows([tool('1'), tool('2')], [], {'C:KOCH': 2})[0].status).toBe('OK');
    expect(minimumRows([tool('1')], [], {})[0].status).toBe('NONE');
    expect(minimumRows([], [], {})).toEqual([]);
  });

  it('counts open and placed orders as coming, not received or cancelled ones', () => {
    const tools = [tool('1')];
    const mins = {'C:KOCH': 5};
    expect(minimumRows(tools, [order('OPEN', 2)], mins)[0]).toMatchObject({onOrder: 2, missing: 2, status: 'LOW'});
    expect(minimumRows(tools, [order('ORDERED', 4)], mins)[0].missing).toBe(0);
    expect(minimumRows(tools, [order('RECEIVED', 4), order('CANCELLED', 4)], mins)[0]).toMatchObject({
      onOrder: 0,
      missing: 4,
    });
  });

  it('puts the worst first and orders only what is still missing', () => {
    const tools = [
      tool('1'),
      tool('2', {code: 'MAYO', name: 'ΨΑΛΙΔΙ MAYO'}),
      tool('3', {code: 'MAYO', name: 'ΨΑΛΙΔΙ MAYO'}),
    ];
    const rows = minimumRows(tools, [order('OPEN', 3)], {'C:KOCH': 4, 'C:MAYO': 2, 'C:ZZZ': 1});
    expect(rows.map(r => [r.code, r.status])).toEqual([
      ['ZZZ', 'OUT'],
      ['KOCH', 'LOW'],
      ['MAYO', 'OK'],
    ]);
    expect(belowMinimum(rows)).toHaveLength(2);
    expect(orderLinesForMinimums(rows).map(l => [l.code, l.quantity])).toEqual([['ZZZ', 1]]);
  });
});
