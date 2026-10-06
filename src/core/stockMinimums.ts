import {kindKey, toolKinds} from './replacements';
import {isReceivable, lineRemaining} from './purchaseReceipt';
import type {PurchaseOrder, PurchaseOrderLine, Tool} from '../types/domain';

export type MinimumStatus = 'OK' | 'LOW' | 'OUT' | 'NONE';

/** One instrument kind with its Stock, its minimum and what is already on order. */
export type MinimumRow = {
  key: string;
  code: string;
  name: string;
  manufacturer?: string;
  /** Instruments of this kind waiting in Stock. */
  stock: number;
  /** The minimum the hospital wants in Stock (0 = none set). */
  min: number;
  /** Pieces still to arrive from orders open, placed or part-received. */
  onOrder: number;
  /** How many more to order to reach the minimum, counting what is already on order. */
  missing: number;
  status: MinimumStatus;
};

/**
 * Every instrument kind (code, else name) with its Stock against the minimum set for it. Kinds with no
 * minimum and nothing in Stock are left out; a minimum set for a kind the hospital no longer holds stays listed.
 */
export function minimumRows(
  tools: readonly Tool[],
  purchaseOrders: readonly PurchaseOrder[],
  minimums: Record<string, number> | undefined,
): MinimumRow[] {
  const mins = minimums || {};
  const stock = new Map<string, number>();
  for (const t of tools)
    if (t.mode === 'STOCK' && t.state === 'IN_STOCK') stock.set(kindKey(t), (stock.get(kindKey(t)) || 0) + 1);
  const onOrder = new Map<string, number>();
  for (const order of purchaseOrders)
    if (isReceivable(order))
      for (const line of order.lines)
        onOrder.set(kindKey(line), (onOrder.get(kindKey(line)) || 0) + lineRemaining(line));
  const kinds = new Map(toolKinds(tools).map(t => [kindKey(t), t]));
  const keys = new Set([...kinds.keys(), ...Object.keys(mins)]);
  const rows: MinimumRow[] = [];
  for (const key of keys) {
    const sample = kinds.get(key);
    const min = Math.max(0, Math.floor(mins[key] || 0));
    const inStock = stock.get(key) || 0;
    if (!min && !inStock) continue;
    const ordered = onOrder.get(key) || 0;
    rows.push({
      key,
      code: sample?.code || (key.startsWith('C:') ? key.slice(2) : ''),
      name: sample?.name || key.slice(2),
      manufacturer: sample?.manufacturer,
      stock: inStock,
      min,
      onOrder: ordered,
      missing: Math.max(0, min - inStock - ordered),
      status: !min ? 'NONE' : inStock === 0 ? 'OUT' : inStock < min ? 'LOW' : 'OK',
    });
  }
  const rank = {OUT: 0, LOW: 1, OK: 2, NONE: 3} as const;
  return rows.sort((a, b) => rank[a.status] - rank[b.status] || a.name.localeCompare(b.name, 'el'));
}

/** Rows below their minimum (Stock under it), whether or not an order already covers them. */
export const belowMinimum = (rows: readonly MinimumRow[]) => rows.filter(r => r.status === 'LOW' || r.status === 'OUT');

/** Order lines for what is still missing: one per kind, quantity = missing, nothing for kinds already covered. */
export function orderLinesForMinimums(rows: readonly MinimumRow[]): PurchaseOrderLine[] {
  return rows
    .filter(r => r.missing > 0)
    .map(r => ({
      code: r.code,
      name: r.name,
      manufacturer: r.manufacturer,
      quantity: r.missing,
      reason: 'Ελάχιστο απόθεμα',
      toolIds: [],
      barcodes: [],
    }));
}
