import {nameKey} from './nameCheck';
import type {Issue, Movement, PurchaseOrder, PurchaseOrderLine, SetAsset, Tool} from '../types/domain';

/** Why an instrument is out of circulation (or about to be) and may need replacing. */
export type ReplacementReason = 'SERVICE' | 'DAMAGED' | 'LOST' | 'RETIRED';
export const REASON_LABEL: Record<ReplacementReason, string> = {
  SERVICE: 'Service',
  DAMAGED: 'Βλάβη / φθορά',
  LOST: 'Απώλεια',
  RETIRED: 'Εκτός χρήσης',
};

/** Issue types that mean the instrument itself is damaged. */
const DAMAGE_TYPES = new Set(['Βλάβη', 'Φθορά', 'Βλάβη / Service', 'Service']);

export type ReplacementItem = {
  tool: Tool;
  reason: ReplacementReason;
  /** The open issue types on it, e.g. Βλάβη. */
  issueTypes: string[];
  issueNote?: string;
  since?: string;
  /** The Set it belongs to, or the one it was last taken out of. */
  set?: SetAsset;
  department?: string;
  /** Instruments of the same kind waiting in Stock. */
  stock: Tool[];
  order?: Pick<PurchaseOrder, 'id' | 'number' | 'status'>;
  status: 'NEEDED' | 'IN_ORDER' | 'REPLACED';
};

/** What makes two instruments the same kind: the catalogue code, else the written name. */
export const kindKey = (tool: Pick<Tool, 'code' | 'name'>) => {
  const code = (tool.code || '').trim().toUpperCase();
  return code ? `C:${code}` : `N:${nameKey(tool.name)}`;
};

const lastSetBarcode = (barcode: string, movements: readonly Movement[]) => {
  // Movements are newest first: the latest one that took it out of a Set names that Set.
  const out = movements.find(m => m.asset.startsWith(barcode) && m.from.startsWith('Set '));
  return out?.from.slice(4).trim();
};

/**
 * Instruments in Service, damaged (an open damage report), lost or out of use, each with the Set it
 * serves, the matching instruments in Stock and any purchase order already covering it.
 */
export function replacementItems(data: {
  tools: readonly Tool[];
  retiredTools: readonly Tool[];
  sets: readonly SetAsset[];
  issues: readonly Issue[];
  movements: readonly Movement[];
  purchaseOrders: readonly PurchaseOrder[];
}): ReplacementItem[] {
  const {tools, retiredTools, sets, issues, movements, purchaseOrders} = data;
  const stockByKind = new Map<string, Tool[]>();
  for (const tool of tools)
    if (tool.state === 'IN_STOCK' && tool.mode === 'STOCK')
      stockByKind.set(kindKey(tool), [...(stockByKind.get(kindKey(tool)) || []), tool]);
  const openIssues = issues.filter(i => i.status === 'OPEN');
  const items: ReplacementItem[] = [];
  for (const tool of [...tools, ...retiredTools]) {
    const own = openIssues.filter(i => i.asset.startsWith(`${tool.barcode} `) || i.asset === tool.barcode);
    const damage = own.filter(i => DAMAGE_TYPES.has(i.type));
    const reason: ReplacementReason | undefined =
      tool.state === 'RETIRED'
        ? 'RETIRED'
        : tool.state === 'SERVICE'
          ? 'SERVICE'
          : tool.state === 'LOST'
            ? 'LOST'
            : damage.length
              ? 'DAMAGED'
              : undefined;
    if (!reason) continue;
    const set = tool.setId
      ? sets.find(s => s.id === tool.setId)
      : (() => {
          const barcode = lastSetBarcode(tool.barcode, movements);
          return barcode ? sets.find(s => s.barcode === barcode) : undefined;
        })();
    const order = purchaseOrders.find(o => o.status !== 'CANCELLED' && o.lines.some(l => l.toolIds.includes(tool.id)));
    items.push({
      tool,
      reason,
      issueTypes: [...new Set((damage.length ? damage : own).map(i => i.type))],
      issueNote: (damage[0] || own[0])?.note,
      since: reason === 'RETIRED' ? tool.retiredAt : (damage[0] || own[0])?.created,
      set,
      department: set?.department || (tool.department !== 'Service' ? tool.department : undefined),
      stock: (stockByKind.get(kindKey(tool)) || []).filter(s => s.id !== tool.id),
      order: order && {id: order.id, number: order.number, status: order.status},
      status: tool.replacedBy || order?.status === 'RECEIVED' ? 'REPLACED' : order ? 'IN_ORDER' : 'NEEDED',
    });
  }
  return items.sort(
    (a, b) =>
      (a.status === 'NEEDED' ? 0 : 1) - (b.status === 'NEEDED' ? 0 : 1) ||
      a.tool.name.localeCompare(b.tool.name, 'el') ||
      a.tool.barcode.localeCompare(b.tool.barcode),
  );
}

/**
 * Stock instruments for the given items, one each and never the same one twice; items with no Set
 * to go into, or no matching instrument left, get none.
 */
export function allocateStock(items: readonly ReplacementItem[]) {
  const used = new Set<string>();
  const pairs: Array<{toolId: string; stockToolId: string; setId: string}> = [];
  for (const item of items) {
    if (!item.set || item.status === 'REPLACED') continue;
    const pick = item.stock.find(s => !used.has(s.id));
    if (!pick) continue;
    used.add(pick.id);
    pairs.push({toolId: item.tool.id, stockToolId: pick.id, setId: item.set.id});
  }
  return pairs;
}

/** Order lines for the given items: one per instrument kind, with the quantity and what it replaces. */
export function orderLines(items: readonly ReplacementItem[]) {
  const lines = new Map<
    string,
    {
      code: string;
      name: string;
      manufacturer?: string;
      quantity: number;
      reasons: Set<string>;
      toolIds: string[];
      barcodes: string[];
    }
  >();
  for (const item of items) {
    const key = kindKey(item.tool);
    const line = lines.get(key) || {
      code: item.tool.code || '',
      name: item.tool.name,
      manufacturer: item.tool.manufacturer,
      quantity: 0,
      reasons: new Set<string>(),
      toolIds: [],
      barcodes: [],
    };
    line.quantity += 1;
    line.reasons.add(REASON_LABEL[item.reason]);
    line.toolIds.push(item.tool.id);
    line.barcodes.push(item.tool.barcode);
    lines.set(key, line);
  }
  return [...lines.values()]
    .map(({reasons, ...line}) => ({...line, reason: [...reasons].join(', ')}))
    .sort((a, b) => a.name.localeCompare(b.name, 'el'));
}

/** An order line for one instrument, wherever the order is started from (an issue, a Set, Stock). */
export const orderLineFromTool = (tool: Tool, reason = ''): PurchaseOrderLine => ({
  code: tool.code || '',
  name: tool.name,
  manufacturer: tool.manufacturer,
  quantity: 1,
  reason,
  toolIds: [tool.id],
  barcodes: [tool.barcode],
});

/** Adds a line to an order; the same kind (code, else name) joins the line already there. */
export function addOrderLine(lines: readonly PurchaseOrderLine[], line: PurchaseOrderLine): PurchaseOrderLine[] {
  const key = kindKey(line);
  const at = lines.findIndex(l => kindKey(l) === key);
  if (at < 0) return [...lines, line];
  return lines.map((l, i) =>
    i === at
      ? {
          ...l,
          quantity: l.quantity + line.quantity,
          reason: [...new Set([l.reason, line.reason].filter(Boolean))].join(', '),
          toolIds: [...new Set([...l.toolIds, ...line.toolIds])],
          barcodes: [...new Set([...l.barcodes, ...line.barcodes])],
        }
      : l,
  );
}

/** The instrument kinds the hospital already knows (one per code, else name), for choosing what to order. */
export function toolKinds(tools: readonly Tool[]) {
  const kinds = new Map<string, Tool>();
  for (const tool of tools) if (!kinds.has(kindKey(tool))) kinds.set(kindKey(tool), tool);
  return [...kinds.values()].sort((a, b) => a.name.localeCompare(b.name, 'el'));
}
