import {useState} from 'react';
import {ClipboardList, PackageCheck, Plus, Printer} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import type {PurchaseOrder} from '../../types/domain';
import {isReceivable} from '../../core/purchaseReceipt';
import {pieces} from './pieces';
import {orderStatusLabel} from './replacementPrint';
import {tr} from '../../i18n';

/** The purchase orders, newest first, with their status and print. */
export default function OrdersPanel({
  orders,
  editable,
  onStatus,
  onReceive,
  onNew,
  onPrint,
}: {
  orders: PurchaseOrder[];
  editable: boolean;
  onStatus: (order: PurchaseOrder, status: PurchaseOrder['status']) => void;
  onReceive: (order: PurchaseOrder) => void;
  onNew: () => void;
  onPrint: (order: PurchaseOrder) => void;
}) {
  const [open, setOpen] = useState<string | null>(orders[0]?.id || null);
  if (!orders.length)
    return (
      <section className="replacements-card replacements-empty">
        <ClipboardList size={26} />
        <strong>{tr('Δεν υπάρχουν παραγγελίες ακόμη.')}</strong>
        <span>{tr('Ξεκινήστε μια παραγγελία από οποιοδήποτε εργαλείο ή από το κουμπί «Νέα παραγγελία».')}</span>
        {editable && (
          <AppButton variant="primary" icon={<Plus size={15} />} onClick={onNew}>
            {tr('Νέα παραγγελία')}
          </AppButton>
        )}
      </section>
    );
  const active = orders.filter(o => o.status !== 'CANCELLED');
  const cancelled = orders.filter(o => o.status === 'CANCELLED');
  const card = (order: PurchaseOrder) => {
    const total = order.lines.reduce((sum, line) => sum + line.quantity, 0);
    const expanded = open === order.id;
    return (
      <article key={order.id} className={`replacements-order o-${order.status}`}>
        <header onClick={() => setOpen(expanded ? null : order.id)}>
          <div>
            <strong className="mono">{order.number}</strong>
            <small>
              {order.createdAt} · {order.createdByName}
              {order.supplier ? ` · ${order.supplier}` : ''}
            </small>
          </div>
          <span className="replacements-order-count">
            {order.lines.length === 1 ? tr('1 είδος') : tr('{0} είδη', order.lines.length)} · {pieces(total)}
          </span>
          <span className={`replacement-order-status o-${order.status}`}>{orderStatusLabel(order.status)}</span>
        </header>
        {expanded && (
          <div className="replacements-order-body">
            <table>
              <tbody>
                {order.lines.map(line => (
                  <tr key={`${line.code}-${line.name}`}>
                    <td className="mono">{line.code || '—'}</td>
                    <td>
                      <strong>{line.name}</strong>
                      <small>{line.manufacturer || ''}</small>
                    </td>
                    <td className="qty">{line.received ? `${line.received}/${line.quantity}` : line.quantity}</td>
                    <td>{line.reason}</td>
                    <td className="mono barcodes">{line.barcodes.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {order.note && <p className="replacements-order-note">{order.note}</p>}
            <div className="replacements-order-actions">
              <AppButton icon={<Printer size={15} />} onClick={() => onPrint(order)}>
                {tr('Εκτύπωση')}
              </AppButton>
              {editable && order.status === 'OPEN' && (
                <AppButton variant="primary" onClick={() => onStatus(order, 'ORDERED')}>
                  {tr('Σημείωση ως παραγγελθείσα')}
                </AppButton>
              )}
              {editable && isReceivable(order) && (
                <>
                  <AppButton
                    variant={order.status === 'OPEN' ? undefined : 'primary'}
                    icon={<PackageCheck size={15} />}
                    onClick={() => onReceive(order)}
                  >
                    {order.status === 'PARTIAL' ? tr('Παραλαβή υπολοίπων') : tr('Παραλαβή στο Απόθεμα')}
                  </AppButton>
                  <AppButton onClick={() => onStatus(order, 'CANCELLED')}>
                    {order.status === 'PARTIAL' ? tr('Ακύρωση υπολοίπων') : tr('Ακύρωση παραγγελίας')}
                  </AppButton>
                </>
              )}
              {order.status === 'PARTIAL' && order.receivedBarcodes?.length ? (
                <small>{tr('Έχουν παραληφθεί: {0}', order.receivedBarcodes.join(', '))}</small>
              ) : null}
              {order.status === 'RECEIVED' && (
                <small>
                  {order.receivedBarcodes?.length
                    ? tr(
                        'Παραλήφθηκε {0} · Νέα εργαλεία στο Απόθεμα: {1}',
                        order.receivedAt || '',
                        order.receivedBarcodes.join(', '),
                      )
                    : tr('Παραλήφθηκε {0}', order.receivedAt || '')}
                </small>
              )}
            </div>
          </div>
        )}
      </article>
    );
  };
  return (
    <section className="replacements-orders">
      {editable && (
        <div className="replacements-orders-bar">
          <AppButton icon={<Plus size={15} />} onClick={onNew}>
            {tr('Νέα παραγγελία')}
          </AppButton>
        </div>
      )}
      {active.map(card)}
      {cancelled.length > 0 && (
        <details className="replacements-cancelled">
          <summary>{tr('Ακυρωμένες παραγγελίες ({0})', cancelled.length)}</summary>
          {cancelled.map(card)}
        </details>
      )}
    </section>
  );
}
