import type {PurchaseOrderLine, PurchaseOrderStatus, Tool} from '../../types/domain';
import {formatStoreDateTime, uniqueStamp} from '../helpers';
import {tr} from '../../i18n';
import type {useSurgiSession} from './useSurgiSession';
import type {useSurgiRecords} from './useSurgiRecords';
import type {useSurgiHelpers} from './useSurgiHelpers';
import type {useReceiptAndCycleActions} from './useReceiptAndCycleActions';
import type {useLoadActions} from './useLoadActions';
import type {useAssetHelpers} from './useAssetHelpers';
import type {useAssetCatalogActions} from './useAssetCatalogActions';
import type {useAssetStatusActions} from './useAssetStatusActions';
import type {useAssetEditActions} from './useAssetEditActions';

export function usePurchaseActions(
  p: ReturnType<typeof useSurgiSession> &
    ReturnType<typeof useSurgiRecords> &
    ReturnType<typeof useSurgiHelpers> &
    ReturnType<typeof useReceiptAndCycleActions> &
    ReturnType<typeof useLoadActions> &
    ReturnType<typeof useAssetHelpers> &
    ReturnType<typeof useAssetCatalogActions> &
    ReturnType<typeof useAssetStatusActions> &
    ReturnType<typeof useAssetEditActions>,
) {
  const {
    addMovement,
    currentUser,
    notify,
    openIssue,
    purchaseOrders,
    setPurchaseOrders,
    setSets,
    setTools,
    sets,
    tools,
  } = p;

  /**
   * Puts Stock instruments in the place of damaged, serviced, lost or out-of-use ones: each goes into
   * the Set; an outgoing instrument still in that Set leaves it for Service. All in one step.
   */
  const replaceFromStock = (pairs: Array<{toolId: string; stockToolId: string; setId: string}>) => {
    const valid = pairs.filter(
      p =>
        sets.some(s => s.id === p.setId) &&
        tools.some(t => t.id === p.stockToolId && t.state === 'IN_STOCK') &&
        tools.some(t => t.id === p.toolId),
    );
    if (!valid.length) return;
    const incoming = new Map(valid.map(p => [p.stockToolId, p]));
    const replaced = new Map(valid.map(p => [p.toolId, p]));
    const leaving = valid.filter(p => tools.find(t => t.id === p.toolId)?.setId === p.setId);
    const barcodeOf = (id: string) => tools.find(t => t.id === id)?.barcode || '';
    setTools(list =>
      list.map(t => {
        const into = incoming.get(t.id);
        if (into) {
          const target = sets.find(s => s.id === into.setId)!;
          return {
            ...t,
            mode: 'SET_MEMBER' as const,
            setId: target.id,
            department: target.department,
            state: target.state,
          };
        }
        const out = replaced.get(t.id);
        if (!out) return t;
        const replacedBy = barcodeOf(out.stockToolId);
        return t.setId === out.setId
          ? {
              ...t,
              mode: 'STANDALONE' as const,
              setId: undefined,
              department: 'Service',
              state: 'SERVICE' as const,
              replacedBy,
            }
          : {...t, replacedBy};
      }),
    );
    // A Set gains one for each instrument added and loses one for each sent to Service.
    const delta = new Map<string, number>();
    valid.forEach(p => delta.set(p.setId, (delta.get(p.setId) || 0) + 1));
    leaving.forEach(p => delta.set(p.setId, (delta.get(p.setId) || 0) - 1));
    setSets(list => list.map(s => (delta.get(s.id) ? {...s, actual: Math.max(0, s.actual + delta.get(s.id)!)} : s)));
    for (const p of valid) {
      const out = tools.find(t => t.id === p.toolId)!;
      const into = tools.find(t => t.id === p.stockToolId)!;
      const target = sets.find(s => s.id === p.setId)!;
      if (out.setId === p.setId) {
        openIssue(
          out,
          'Βλάβη / Service',
          target.department,
          `Αντικαταστάθηκε από ${into.barcode} και μεταφέρθηκε στα χαλασμένα / Service.`,
        );
        addMovement({
          asset: `${out.barcode} · ${out.name}`,
          assetKind: 'TOOL',
          from: `Set ${target.barcode}`,
          to: 'Χαλασμένα / Service',
          status: `Αντικατάσταση στη σύνθεση από ${into.barcode}`,
          by: currentUser.name,
        });
      }
      addMovement({
        asset: `${into.barcode} · ${into.name}`,
        assetKind: 'TOOL',
        from: 'Απόθεμα',
        to: `Set ${target.barcode}`,
        status: `Αντικατάσταση εργαλείου ${out.barcode}`,
        by: currentUser.name,
      });
    }
    notify(tr('{0} εργαλεία αντικαταστάθηκαν από το Απόθεμα.', valid.length));
  };
  /** Records an order to buy replacement instruments; returns its number. */
  const createPurchaseOrder = (lines: PurchaseOrderLine[], details: {supplier?: string; note?: string} = {}) => {
    const kept = lines.filter(line => line.quantity > 0);
    if (!kept.length) return '';
    const year = new Date().getFullYear();
    const sameYear = purchaseOrders.filter(o => o.number.startsWith(`ΠΑ-${year}-`)).length;
    const number = `ΠΑ-${year}-${String(sameYear + 1).padStart(3, '0')}`;
    setPurchaseOrders(x => [
      {
        id: `po${uniqueStamp()}`,
        number,
        status: 'OPEN',
        supplier: details.supplier?.trim() || undefined,
        note: details.note?.trim() || undefined,
        lines: kept,
        createdAt: formatStoreDateTime(),
        createdByName: currentUser.name,
      },
      ...x,
    ]);
    for (const line of kept)
      for (const barcode of line.barcodes)
        addMovement({
          asset: `${barcode} · ${line.name}`,
          assetKind: 'TOOL',
          from: '—',
          to: '—',
          status: tr('Παραγγελία αντικατάστασης {0}', number),
          by: currentUser.name,
        });
    notify(tr('Καταχωρήθηκε η παραγγελία {0}.', number));
    return number;
  };
  /**
   * An order arrives: its instruments go into Stock as new instruments (one per piece, unique
   * barcodes, the details of the instruments they replace) and the order is marked received.
   */
  const receivePurchaseOrder = (id: string) => {
    const order = purchaseOrders.find(o => o.id === id);
    if (!order || order.status === 'RECEIVED' || order.status === 'CANCELLED') return;
    let max = tools
      .flatMap(t => [t.barcode, ...(t.legacyBarcodes || [])])
      .reduce((m, barcode) => Math.max(m, Number(barcode.replace(/\D/g, '')) || 0), 0);
    const stamp = Date.now();
    const created: Tool[] = order.lines.flatMap((line, lineIndex) => {
      const model = tools.find(t => line.toolIds.includes(t.id));
      return Array.from({length: line.quantity}, (_, i) => ({
        id: `tool-${stamp}-${lineIndex}-${i}`,
        barcode: `T${String(++max).padStart(6, '0')}`,
        code: line.code,
        name: line.name,
        specialty: model?.specialty || '',
        manufacturer: line.manufacturer || model?.manufacturer,
        mode: 'STOCK' as const,
        state: 'IN_STOCK' as const,
        uses: 0,
        maxUses: model?.maxUses,
        sterilizations: 0,
        notes: `Παραγγελία ${order.number}`,
      }));
    });
    setTools(x => [...created, ...x]);
    created.forEach(t =>
      addMovement({
        asset: `${t.barcode} · ${t.name}`,
        assetKind: 'TOOL',
        from: `Παραγγελία ${order.number}`,
        to: 'Απόθεμα εργαλείων',
        status: 'Παραλαβή παραγγελίας · νέο εργαλείο στο Απόθεμα',
        by: currentUser.name,
      }),
    );
    setPurchaseOrders(x =>
      x.map(o =>
        o.id === id
          ? {...o, status: 'RECEIVED', receivedAt: formatStoreDateTime(), receivedBarcodes: created.map(t => t.barcode)}
          : o,
      ),
    );
    notify(tr('Η παραγγελία {0} παραλήφθηκε: {1} νέα εργαλεία στο Απόθεμα.', order.number, created.length));
  };
  const setPurchaseOrderStatus = (id: string, status: PurchaseOrderStatus) => {
    const at = formatStoreDateTime();
    setPurchaseOrders(x =>
      x.map(o =>
        o.id !== id
          ? o
          : {
              ...o,
              status,
              ...(status === 'ORDERED' ? {orderedAt: at} : {}),
              ...(status === 'RECEIVED' ? {receivedAt: at} : {}),
              ...(status === 'CANCELLED' ? {cancelledAt: at} : {}),
            },
      ),
    );
  };
  return {createPurchaseOrder, receivePurchaseOrder, replaceFromStock, setPurchaseOrderStatus};
}
