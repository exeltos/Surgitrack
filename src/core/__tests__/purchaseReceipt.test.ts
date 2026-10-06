import {describe, expect, it} from 'vitest';
import {applyReceipt, isReceivable, lineRemaining, orderRemaining} from '../purchaseReceipt';
import type {PurchaseOrder} from '../../types/domain';

const order = (lines: Array<[number, number?]>, status: PurchaseOrder['status'] = 'ORDERED') =>
  ({
    id: 'o',
    number: 'ΠΑ-1',
    status,
    createdAt: '',
    createdByName: '',
    lines: lines.map(([quantity, received], i) => ({
      code: `C${i}`,
      name: `N${i}`,
      quantity,
      received,
      toolIds: [],
      barcodes: [],
    })),
  }) as PurchaseOrder;

describe('partial receipt', () => {
  it('counts what is still to arrive', () => {
    expect(lineRemaining({quantity: 5, received: 2})).toBe(3);
    expect(lineRemaining({quantity: 5})).toBe(5);
    expect(lineRemaining({quantity: 5, received: 9})).toBe(0);
    expect(orderRemaining(order([[5, 2], [3]]))).toBe(6);
  });

  it('is partial until every line is complete, then received', () => {
    const first = applyReceipt(order([[5], [3]]), [2, 3]);
    expect(first).toMatchObject({status: 'PARTIAL', total: 5, arriving: [2, 3]});
    expect(first.lines.map(l => l.received)).toEqual([2, 3]);
    const second = applyReceipt({...order([[5], [3]]), lines: first.lines}, [3, 0]);
    expect(second).toMatchObject({status: 'RECEIVED', total: 3});
    expect(second.lines.map(l => l.received)).toEqual([5, 3]);
  });

  it('never takes in more than a line expects and ignores nonsense', () => {
    const r = applyReceipt(order([[2, 1], [4]]), [10, -3]);
    expect(r.arriving).toEqual([1, 0]);
    expect(r.status).toBe('PARTIAL');
    expect(applyReceipt(order([[2]]), [Number.NaN]).total).toBe(0);
  });

  it('lets an open, placed or part-received order receive, nothing else', () => {
    expect(['OPEN', 'ORDERED', 'PARTIAL'].every(s => isReceivable({status: s as PurchaseOrder['status']}))).toBe(true);
    expect(isReceivable({status: 'RECEIVED'}) || isReceivable({status: 'CANCELLED'})).toBe(false);
  });
});
