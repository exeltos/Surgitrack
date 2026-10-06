import type {PurchaseOrder, PurchaseOrderLine} from '../types/domain';

/** Pieces of a line still to arrive. */
export const lineRemaining = (line: Pick<PurchaseOrderLine, 'quantity' | 'received'>) =>
  Math.max(0, line.quantity - (line.received || 0));

/** Pieces of an order still to arrive. */
export const orderRemaining = (order: Pick<PurchaseOrder, 'lines'>) =>
  order.lines.reduce((sum, line) => sum + lineRemaining(line), 0);

/** Orders that can still receive something: placed or open, or part-received. */
export const isReceivable = (order: Pick<PurchaseOrder, 'status'>) =>
  order.status === 'OPEN' || order.status === 'ORDERED' || order.status === 'PARTIAL';

/**
 * What a receipt does to an order: `quantities` are the pieces arriving now per line (more than a line
 * still expects is cut to what it expects). The order is received once nothing remains, partial before that.
 */
export function applyReceipt(order: PurchaseOrder, quantities: readonly number[]) {
  const arriving = order.lines.map((line, i) =>
    Math.min(lineRemaining(line), Math.max(0, Math.floor(quantities[i] || 0))),
  );
  const lines = order.lines.map((line, i) => ({...line, received: (line.received || 0) + arriving[i]}));
  const total = arriving.reduce((sum, n) => sum + n, 0);
  const complete = lines.every(line => lineRemaining(line) === 0);
  return {lines, arriving, total, status: (complete ? 'RECEIVED' : 'PARTIAL') as PurchaseOrder['status']};
}
