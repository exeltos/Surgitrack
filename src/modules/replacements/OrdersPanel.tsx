import {useState} from 'react';
import {ClipboardList, PackageCheck, Plus, Printer} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import AssetFilterBar from '../../components/assets/AssetFilterBar';
import QuickFilters from '../../components/ui/QuickFilters';
import InfoList, {SplitEmpty} from '../traceability/InfoList';
import type {PurchaseOrder} from '../../types/domain';
import {isReceivable} from '../../core/purchaseReceipt';
import {pieces} from './pieces';
import {orderStatusLabel} from './replacementPrint';
import {tr} from '../../i18n';

/** The purchase orders: their counts, the list on the left and the one open on the right. */
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
  const [filter, setFilter] = useState<'' | 'WAITING' | 'RECEIVED' | 'CANCELLED'>('');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState('');
  const waiting = (order: PurchaseOrder) => isReceivable(order);
  const q = query.trim().toLowerCase();
  const found = orders.filter(
    order =>
      !q ||
      [order.number, order.supplier, order.createdByName, order.note, ...order.lines.map(l => `${l.name} ${l.code}`)]
        .join(' ')
        .toLowerCase()
        .includes(q),
  );
  const shown = found.filter(order =>
    filter === 'WAITING'
      ? waiting(order)
      : filter === 'RECEIVED'
        ? order.status === 'RECEIVED'
        : filter === 'CANCELLED'
          ? order.status === 'CANCELLED'
          : true,
  );
  const open = shown.find(order => order.id === openId) || shown[0];
  const tone = (status: PurchaseOrder['status']) =>
    status === 'RECEIVED' ? 'done' : status === 'CANCELLED' ? 'neutral' : status === 'PARTIAL' ? 'warn' : 'open';
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
  return (
    <>
      {/* The counts on top, the search under them, then the orders and the one open beside them. */}
      <QuickFilters
        items={[
          {key: 'all', label: tr('Όλες'), count: found.length, active: !filter, onClick: () => setFilter('')},
          {
            key: 'waiting',
            label: tr('Σε αναμονή'),
            count: found.filter(waiting).length,
            tone: 'warn',
            active: filter === 'WAITING',
            onClick: () => setFilter(filter === 'WAITING' ? '' : 'WAITING'),
          },
          {
            key: 'received',
            label: tr('Παραλήφθηκαν'),
            count: found.filter(o => o.status === 'RECEIVED').length,
            tone: 'good',
            active: filter === 'RECEIVED',
            onClick: () => setFilter(filter === 'RECEIVED' ? '' : 'RECEIVED'),
          },
          {
            key: 'cancelled',
            label: tr('Ακυρώθηκαν'),
            count: found.filter(o => o.status === 'CANCELLED').length,
            active: filter === 'CANCELLED',
            onClick: () => setFilter(filter === 'CANCELLED' ? '' : 'CANCELLED'),
          },
        ]}
      />
      <div className="trace-split issues-split">
        <aside className="trace-split-list" aria-label={tr('Παραγγελίες')}>
          <AssetFilterBar
            query={query}
            onQueryChange={setQuery}
            placeholder={tr('Αριθμός, προμηθευτής, εργαλείο…')}
            extra={
              editable ? (
                <AppButton icon={<Plus size={15} />} onClick={onNew}>
                  {tr('Νέα')}
                </AppButton>
              ) : undefined
            }
          />
          {shown.length ? (
            <section className="trace-recent-list issues-list">
              <ul>
                {shown.map(order => (
                  <li key={order.id}>
                    <button
                      type="button"
                      className={open?.id === order.id ? 'selected' : undefined}
                      aria-current={open?.id === order.id ? 'true' : undefined}
                      onClick={() => setOpenId(order.id)}
                    >
                      <b className="issue-row-name mono">{order.number}</b>
                      <span className={`issue-dot ${tone(order.status)}`}>{orderStatusLabel(order.status)}</span>
                      <small>
                        {order.lines.length === 1 ? tr('1 είδος') : tr('{0} είδη', order.lines.length)} ·{' '}
                        {pieces(order.lines.reduce((sum, line) => sum + line.quantity, 0))}
                        {order.supplier ? ` · ${order.supplier}` : ''}
                      </small>
                      <span className="issue-row-when">{order.createdAt.split(' ')[0]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="trace-hint">{tr('Καμία παραγγελία δεν ταιριάζει.')}</p>
          )}
        </aside>
        <section className="trace-split-card" aria-label={tr('Παραγγελία')}>
          {open ? (
            <OrderCard order={open} editable={editable} onStatus={onStatus} onReceive={onReceive} onPrint={onPrint} />
          ) : (
            <SplitEmpty
              icon={ClipboardList}
              title={tr('Παραγγελίες')}
              text={tr('Διαλέξτε μια παραγγελία από τη λίστα.')}
            />
          )}
        </section>
      </div>
    </>
  );
}

/** One purchase order: what it holds, its status and dates, and what can be done with it. */
function OrderCard({
  order,
  editable,
  onStatus,
  onReceive,
  onPrint,
}: {
  order: PurchaseOrder;
  editable: boolean;
  onStatus: (order: PurchaseOrder, status: PurchaseOrder['status']) => void;
  onReceive: (order: PurchaseOrder) => void;
  onPrint: (order: PurchaseOrder) => void;
}) {
  const total = order.lines.reduce((sum, line) => sum + line.quantity, 0);
  return (
    <article className="issue-card">
      <div className="trace-item-head">
        <div>
          <small>{tr('Παραγγελία αγοράς')}</small>
          <h2 className="mono">{order.number}</h2>
        </div>
      </div>
      <InfoList
        label={tr('Παραγγελία')}
        rows={[
          {label: tr('Κατάσταση'), value: <b>{orderStatusLabel(order.status)}</b>},
          {
            label: tr('Καταχωρήθηκε'),
            value: (
              <>
                <b>{order.createdAt}</b>
                <small>{order.createdByName}</small>
              </>
            ),
          },
          {label: tr('Προμηθευτής'), value: <b>{order.supplier || '—'}</b>},
          {
            label: tr('Είδη'),
            value: (
              <>
                <b>{order.lines.length === 1 ? tr('1 είδος') : tr('{0} είδη', order.lines.length)}</b>
                <small>{pieces(total)}</small>
              </>
            ),
          },
        ]}
      />
      <ul className="order-card-lines">
        {order.lines.map(line => (
          <li key={`${line.code}-${line.name}`}>
            <span>
              <b>{line.name}</b>
              <small>
                {[line.code, line.manufacturer, line.reason].filter(Boolean).join(' · ')}
                {line.barcodes.length ? ` · ${line.barcodes.join(', ')}` : ''}
              </small>
            </span>
            <span className="order-card-qty">
              {line.received ? `${line.received}/${line.quantity}` : line.quantity}
            </span>
          </li>
        ))}
      </ul>
      {order.note && (
        <div className="issue-card-note">
          <span>{tr('Σημείωση')}</span>
          <p>{order.note}</p>
        </div>
      )}
      {order.status === 'PARTIAL' && order.receivedBarcodes?.length ? (
        <p className="trace-hint">{tr('Έχουν παραληφθεί: {0}', order.receivedBarcodes.join(', '))}</p>
      ) : null}
      {order.status === 'RECEIVED' && (
        <p className="trace-hint">
          {order.receivedBarcodes?.length
            ? tr(
                'Παραλήφθηκε {0} · Νέα εργαλεία στο Απόθεμα: {1}',
                order.receivedAt || '',
                order.receivedBarcodes.join(', '),
              )
            : tr('Παραλήφθηκε {0}', order.receivedAt || '')}
        </p>
      )}
      <div className="issue-card-actions">
        {editable && isReceivable(order) && (
          <AppButton
            variant={order.status === 'OPEN' ? undefined : 'primary'}
            icon={<PackageCheck size={15} />}
            onClick={() => onReceive(order)}
          >
            {order.status === 'PARTIAL' ? tr('Παραλαβή υπολοίπων') : tr('Παραλαβή στο Απόθεμα')}
          </AppButton>
        )}
        {editable && order.status === 'OPEN' && (
          <AppButton variant="primary" onClick={() => onStatus(order, 'ORDERED')}>
            {tr('Σημείωση ως παραγγελθείσα')}
          </AppButton>
        )}
        <AppButton icon={<Printer size={15} />} onClick={() => onPrint(order)}>
          {tr('Εκτύπωση')}
        </AppButton>
        {editable && isReceivable(order) && (
          <AppButton onClick={() => onStatus(order, 'CANCELLED')}>
            {order.status === 'PARTIAL' ? tr('Ακύρωση υπολοίπων') : tr('Ακύρωση παραγγελίας')}
          </AppButton>
        )}
      </div>
    </article>
  );
}
