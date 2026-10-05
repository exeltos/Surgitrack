import type {ReactNode} from 'react';
import {act, renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it} from 'vitest';
import {LibraryStoreProvider} from '../../core/LibraryStore';
import {SurgiProvider, useSurgi} from '../SurgiStore';

const wrapper = ({children}: {children: ReactNode}) => (
  <LibraryStoreProvider>
    <SurgiProvider dataMode="DEMO">{children}</SurgiProvider>
  </LibraryStoreProvider>
);

describe('purchase orders', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('surgitrack-demo-role', 'STERILIZATION');
  });

  it('puts every piece of a received order into Stock with its own barcode', () => {
    const {result} = renderHook(() => useSurgi(), {wrapper});
    const [a, b] = result.current.retiredTools;
    const stockBefore = result.current.tools.filter(t => t.state === 'IN_STOCK').length;
    act(() => {
      result.current.createPurchaseOrder([
        {code: a.code, name: a.name, quantity: 2, toolIds: [a.id], barcodes: [a.barcode]},
        {code: 'NEW-1', name: 'ΝΕΟ ΕΡΓΑΛΕΙΟ', quantity: 1, toolIds: [b.id], barcodes: [b.barcode]},
      ]);
    });
    const order = result.current.purchaseOrders[0];
    expect(order.status).toBe('OPEN');
    act(() => result.current.receivePurchaseOrder(order.id));

    const received = result.current.purchaseOrders.find(o => o.id === order.id)!;
    expect(received.status).toBe('RECEIVED');
    expect(received.receivedBarcodes).toHaveLength(3);
    const all = [...result.current.tools, ...result.current.retiredTools].map(t => t.barcode);
    expect(new Set(all).size).toBe(all.length);
    expect(result.current.tools.filter(t => t.state === 'IN_STOCK').length).toBe(stockBefore + 3);
    // A second receipt adds nothing.
    act(() => result.current.receivePurchaseOrder(order.id));
    expect(result.current.tools.filter(t => t.state === 'IN_STOCK').length).toBe(stockBefore + 3);
  });
});
