import type {ReactNode} from 'react';
import {useMemo, useState} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {
  CheckCircle2,
  ClipboardList,
  PackageCheck,
  Plus,
  RefreshCcw,
  Search,
  ShoppingCart,
  Undo2,
  X,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import AppButton from '../../components/ui/AppButton';
import FilterMenu, {type SelectFilter} from '../../components/assets/FilterMenu';
import PrintPreviewModal from '../../components/assets/PrintPreviewModal';
import {useSurgi} from '../../store/SurgiStore';
import type {ExportTable} from '../../core/exportTable';
import DownloadMenu from '../../components/ui/DownloadMenu';
import {MoreRows} from '../../components/ui/ProgressiveList';
import {useProgressiveList} from '../../core/useProgressiveList';
import {
  REASON_LABEL,
  allocateStock,
  orderLines,
  replacementItems,
  type ReplacementItem,
  type ReplacementReason,
} from '../../core/replacements';
import type {PurchaseOrder, PurchaseOrderLine} from '../../types/domain';
import OrderDialog from './OrderDialog';
import OrdersPanel from './OrdersPanel';
import ReceiveDialog from './ReceiveDialog';
import {isReceivable} from '../../core/purchaseReceipt';
import {useConfirm} from '../../components/ui/useConfirm';
import {pieces} from './pieces';
import {purchaseOrderHtml, replacementListHtml} from './replacementPrint';
import {tr, trData} from '../../i18n';

type Tab = 'ITEMS' | 'ORDERS';
type StatusFilter = '' | 'NEEDED' | 'IN_ORDER' | 'REPLACED';

/**
 * Instruments in Service, damaged, lost or out of use: whether the same instrument waits in Stock,
 * replacing them from Stock in one step, and recording purchase orders for the rest.
 */
/** `tabs`: the Issues page's tabs when embedded there, shown under these figures like on Issues. */
export default function ReplacementsPage({embedded = false, tabs}: {embedded?: boolean; tabs?: ReactNode}) {
  const store = useSurgi();
  const {tools, retiredTools, sets, issues, movements, purchaseOrders, can, organizationName} = store;
  const editable = can('stock.manage');
  const items = useMemo(
    () => replacementItems({tools, retiredTools, sets, issues, movements, purchaseOrders}),
    [tools, retiredTools, sets, issues, movements, purchaseOrders],
  );
  const [confirm, ask] = useConfirm();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get('view') === 'orders' ? 'ORDERS' : 'ITEMS');
  const [query, setQuery] = useState('');
  const [reason, setReason] = useState('');
  const [department, setDepartment] = useState('');
  const [stock, setStock] = useState('');
  const [status, setStatus] = useState<StatusFilter>('NEEDED');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ordering, setOrdering] = useState<PurchaseOrderLine[] | null>(null);
  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null);
  const [preview, setPreview] = useState<{title: string; html: string} | null>(null);

  const departments = useMemo(
    () =>
      [...new Set(items.map(i => i.department).filter((d): d is string => !!d))].sort((a, b) =>
        a.localeCompare(b, 'el'),
      ),
    [items],
  );
  const q = query.trim().toLowerCase();
  const shown = items.filter(
    item =>
      (!reason || item.reason === reason) &&
      (!department || item.department === department) &&
      (!stock || (stock === 'YES' ? item.stock.length > 0 : item.stock.length === 0)) &&
      (!status || item.status === status) &&
      (!q ||
        `${item.tool.barcode} ${item.tool.name} ${item.tool.code} ${item.tool.manufacturer || ''} ${item.set?.barcode || ''} ${item.set?.name || ''}`
          .toLowerCase()
          .includes(q)),
  );
  // The table renders the first rows at once and the rest as it scrolls; selection and exports use them all.
  const rows = useProgressiveList(shown, [reason, department, stock, status, q].join('|'), 'replacements');
  const picked = shown.filter(item => selected.has(item.tool.id));
  const target = picked.length ? picked : shown;
  const fromStock = allocateStock(picked.filter(item => item.status !== 'REPLACED'));
  const needed = items.filter(i => i.status === 'NEEDED');

  const filters: SelectFilter[] = [
    {
      key: 'status',
      placeholder: tr('Όλες οι καταστάσεις'),
      value: status,
      onChange: value => setStatus(value as StatusFilter),
      options: [
        {value: 'NEEDED', label: tr('Χρειάζεται αντικατάσταση')},
        {value: 'IN_ORDER', label: tr('Σε παραγγελία')},
        {value: 'REPLACED', label: tr('Αντικαταστάθηκε')},
      ],
    },
    {
      key: 'reason',
      placeholder: tr('Όλες οι αιτίες'),
      value: reason,
      onChange: setReason,
      options: (Object.keys(REASON_LABEL) as ReplacementReason[]).map(r => ({value: r, label: tr(REASON_LABEL[r])})),
    },
    {
      key: 'stock',
      placeholder: tr('Απόθεμα: όλα'),
      value: stock,
      onChange: setStock,
      options: [
        {value: 'YES', label: tr('Με απόθεμα')},
        {value: 'NO', label: tr('Χωρίς απόθεμα')},
      ],
    },
    {
      key: 'department',
      placeholder: tr('Όλα τα τμήματα'),
      value: department,
      onChange: setDepartment,
      options: departments.map(d => ({value: d, label: d})),
    },
  ];
  const filterText = [
    status &&
      tr(
        status === 'NEEDED' ? 'Χρειάζεται αντικατάσταση' : status === 'IN_ORDER' ? 'Σε παραγγελία' : 'Αντικαταστάθηκε',
      ),
    reason && tr(REASON_LABEL[reason as ReplacementReason]),
    stock && tr(stock === 'YES' ? 'Υπάρχει στο απόθεμα' : 'Δεν υπάρχει στο απόθεμα'),
    department && trData(department),
    q && `«${query.trim()}»`,
  ]
    .filter(Boolean)
    .join(' · ');

  const toggle = (id: string) =>
    setSelected(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allShown = shown.length > 0 && shown.every(item => selected.has(item.tool.id));
  const toggleAll = () =>
    setSelected(current => {
      const next = new Set(current);
      shown.forEach(item => (allShown ? next.delete(item.tool.id) : next.add(item.tool.id)));
      return next;
    });

  const replace = (list: ReplacementItem[]) => {
    const pairs = allocateStock(list);
    if (!pairs.length) return;
    ask({
      title: tr('Αντικατάσταση από το Απόθεμα;'),
      message: tr(
        '{0} εργαλεία από το Απόθεμα μπαίνουν στα Σετ και τα εργαλεία που αντικαθίστανται πάνε σε Service. Οι αλλαγές καταγράφονται στο Ιστορικό.',
        pairs.length,
      ),
      confirmLabel: tr('Αντικατάσταση'),
      onConfirm: () => {
        store.replaceFromStock(pairs);
        setSelected(new Set());
      },
    });
  };
  const printList = () =>
    setPreview({
      title: tr('Βλάβες & Αντικαταστάσεις'),
      html: replacementListHtml(
        target,
        [picked.length ? tr('{0} επιλεγμένα εργαλεία', picked.length) : tr('{0} εργαλεία', shown.length), filterText]
          .filter(Boolean)
          .join(' · '),
        organizationName,
      ),
    });
  const listTable = (): ExportTable => ({
    title: tr('Βλάβες & Αντικαταστάσεις'),
    subtitle: filterText || tr('Όλα τα εργαλεία'),
    headers: [
      'Barcode',
      tr('Εργαλείο'),
      tr('Κωδικός'),
      tr('Κατασκευαστής'),
      tr('Σετ'),
      tr('Τμήμα'),
      tr('Αιτία'),
      tr('Από'),
      tr('Στο απόθεμα'),
      tr('Κατάσταση'),
    ],
    rows: target.map(item => [
      item.tool.barcode,
      item.tool.name,
      item.tool.code || '',
      item.tool.manufacturer || '',
      item.set ? `${item.set.barcode} · ${item.set.name}` : '',
      trData(item.department || ''),
      tr(REASON_LABEL[item.reason]),
      item.since || '',
      item.stock.length,
      statusText(item),
    ]),
  });

  return (
    <div className={embedded ? 'replacements embedded' : 'replacements'}>
      {!embedded && (
        <PageHeader
          eyebrow={tr('ΒΛΑΒΕΣ · SERVICE · ΑΠΩΛΕΙΕΣ')}
          title={tr('Αντικαταστάσεις')}
          description={tr('Εργαλεία σε Service, με βλάβη ή χαμένα: αντικατάσταση από το Απόθεμα ή παραγγελία.')}
        />
      )}
      <div className="replacements-kpis">
        <button
          type="button"
          className={status === 'NEEDED' && !stock ? 'active warn' : 'warn'}
          onClick={() => (setStatus('NEEDED'), setStock(''))}
        >
          <span>{tr('Προς αντικατάσταση')}</span>
          <strong>{needed.length}</strong>
        </button>
        <button
          type="button"
          className={status === 'NEEDED' && stock === 'YES' ? 'active good' : 'good'}
          onClick={() => (setStatus('NEEDED'), setStock('YES'))}
        >
          <span>{tr('Με απόθεμα')}</span>
          <strong>{needed.filter(i => i.stock.length).length}</strong>
        </button>
        <button
          type="button"
          className={status === 'NEEDED' && stock === 'NO' ? 'active bad' : 'bad'}
          onClick={() => (setStatus('NEEDED'), setStock('NO'))}
        >
          <span>{tr('Χωρίς απόθεμα')}</span>
          <strong>{needed.filter(i => !i.stock.length).length}</strong>
        </button>
        <button
          type="button"
          className={status === 'IN_ORDER' ? 'active' : ''}
          onClick={() => (setStatus('IN_ORDER'), setStock(''))}
        >
          <span>{tr('Σε παραγγελία')}</span>
          <strong>{items.filter(i => i.status === 'IN_ORDER').length}</strong>
        </button>
      </div>
      {tabs}
      <div className="name-check-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'ITEMS'}
          className={tab === 'ITEMS' ? 'active' : ''}
          onClick={() => setTab('ITEMS')}
        >
          <RefreshCcw size={16} /> {tr('Εργαλεία')} <b>{shown.length}</b>
        </button>
        <button
          role="tab"
          aria-selected={tab === 'ORDERS'}
          className={tab === 'ORDERS' ? 'active' : ''}
          onClick={() => setTab('ORDERS')}
        >
          <ClipboardList size={16} /> {tr('Παραγγελίες')} <b>{purchaseOrders.filter(isReceivable).length}</b>
        </button>
      </div>

      {tab === 'ITEMS' ? (
        <section className="replacements-card">
          <div className="replacements-toolbar">
            <label className="replacements-search">
              <Search size={15} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={tr('Αναζήτηση barcode, ονομασίας, κωδικού ή Σετ…')}
              />
            </label>
            <FilterMenu filters={filters} />
            <span className="replacements-spacer" />
            {editable && (
              <AppButton icon={<Plus size={15} />} onClick={() => setOrdering([])}>
                {tr('Νέα παραγγελία')}
              </AppButton>
            )}
            <DownloadMenu
              table={listTable}
              onPrint={printList}
              printLabel={picked.length ? tr('PDF / Εκτύπωση επιλεγμένων') : undefined}
            />
          </div>
          {editable && picked.length > 0 && (
            <div className="replacements-bulk">
              <b>{tr('{0} επιλεγμένα', picked.length)}</b>
              <AppButton
                variant="primary"
                icon={<PackageCheck size={15} />}
                disabled={!fromStock.length}
                onClick={() => replace(picked)}
              >
                {tr('Αντικατάσταση από Απόθεμα ({0})', fromStock.length)}
              </AppButton>
              <AppButton
                icon={<ShoppingCart size={15} />}
                onClick={() => setOrdering(orderLines(picked.filter(item => item.status !== 'REPLACED')))}
              >
                {tr('Παραγγελία αγοράς')}
              </AppButton>
              <button type="button" className="replacements-clear" onClick={() => setSelected(new Set())}>
                <X size={14} /> {tr('Καθαρισμός επιλογής')}
              </button>
            </div>
          )}
          <div className="replacements-table">
            <table className="replacements-fixed">
              <thead>
                <tr>
                  {editable && (
                    <th className="pick">
                      <input type="checkbox" checked={allShown} onChange={toggleAll} aria-label={tr('Επιλογή όλων')} />
                    </th>
                  )}
                  <th>{tr('Εργαλείο')}</th>
                  <th className="col-set">{tr('Σετ / τμήμα')}</th>
                  <th className="col-reason">{tr('Αιτία')}</th>
                  <th className="col-stock">{tr('Απόθεμα')}</th>
                  <th className="col-status">{tr('Κατάσταση')}</th>
                  {editable && <th className="col-actions">{tr('Ενέργειες')}</th>}
                </tr>
              </thead>
              <tbody>
                {rows.visible.map(item => {
                  const canReplace = item.status !== 'REPLACED' && !!item.set && item.stock.length > 0;
                  return (
                    <tr key={item.tool.id} className={selected.has(item.tool.id) ? 'selected' : ''}>
                      {editable && (
                        <td className="pick">
                          <input
                            type="checkbox"
                            checked={selected.has(item.tool.id)}
                            onChange={() => toggle(item.tool.id)}
                            aria-label={item.tool.barcode}
                          />
                        </td>
                      )}
                      <td>
                        <strong title={item.tool.name}>
                          <Link to={`/tools/${item.tool.id}`}>{item.tool.name}</Link>
                        </strong>
                        <small>
                          <span className="mono">{item.tool.barcode}</span>
                          {item.tool.code ? ` · ${item.tool.code}` : ''}
                          {item.tool.manufacturer ? ` · ${item.tool.manufacturer}` : ''}
                        </small>
                      </td>
                      <td>
                        {item.set ? (
                          <Link to={`/sets/${item.set.id}`}>
                            <b className="mono">{item.set.barcode}</b> {item.set.name}
                          </Link>
                        ) : (
                          '—'
                        )}
                        <small>{trData(item.department || '')}</small>
                      </td>
                      <td>
                        <span className={`replacement-reason r-${item.reason}`}>{tr(REASON_LABEL[item.reason])}</span>
                        {item.reason === 'DAMAGED' && item.issueTypes.length > 0 && (
                          <small>{item.issueTypes.map(trData).join(' · ')}</small>
                        )}
                      </td>
                      <td>
                        {item.stock.length ? (
                          <span className="replacement-stock yes" title={item.stock.map(s => s.barcode).join(', ')}>
                            <CheckCircle2 size={13} /> {tr('Ναι · {0}', item.stock.length)}
                          </span>
                        ) : (
                          <span className="replacement-stock no">{tr('Όχι')}</span>
                        )}
                      </td>
                      <td>
                        <span className={`replacement-status s-${item.status}`}>{statusText(item)}</span>
                        {item.since && <small title={tr('Από')}>{item.since}</small>}
                      </td>
                      {editable && (
                        <td className="row-actions">
                          <div className="replacement-actions">
                            {canReplace ? (
                              <button
                                type="button"
                                className="primary slot-replace"
                                title={tr('Αντικατάσταση')}
                                aria-label={tr('Αντικατάσταση')}
                                onClick={() => replace([item])}
                              >
                                <PackageCheck size={13} /> <span className="btn-label">{tr('Αντικατάσταση')}</span>
                              </button>
                            ) : (
                              <span className="slot-replace" aria-hidden="true" />
                            )}
                            {item.status === 'NEEDED' ? (
                              <button
                                type="button"
                                className="slot-order"
                                title={tr('Παραγγελία')}
                                aria-label={tr('Παραγγελία')}
                                onClick={() => setOrdering(orderLines([item]))}
                              >
                                <ShoppingCart size={13} /> <span className="btn-label">{tr('Παραγγελία')}</span>
                              </button>
                            ) : (
                              <span className="slot-order" aria-hidden="true" />
                            )}
                            {item.reason === 'SERVICE' && item.status !== 'REPLACED' ? (
                              <button
                                type="button"
                                className="slot-return"
                                title={tr('Επέστρεψε επισκευασμένο: πάει στο Απόθεμα')}
                                aria-label={tr('Επιστροφή')}
                                onClick={() =>
                                  ask({
                                    title: tr('Επιστροφή από Service;'),
                                    message: tr(
                                      'Το εργαλείο {0} επέστρεψε επισκευασμένο και μπαίνει στο Απόθεμα.',
                                      item.tool.barcode,
                                    ),
                                    confirmLabel: tr('Επιστροφή στο Απόθεμα'),
                                    onConfirm: () => store.returnToService('TOOL', item.tool.id),
                                  })
                                }
                              >
                                <Undo2 size={13} /> <span className="btn-label">{tr('Επιστροφή')}</span>
                              </button>
                            ) : (
                              <span className="slot-return" aria-hidden="true" />
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {!shown.length && (
                  <tr>
                    <td colSpan={editable ? 7 : 5} className="empty">
                      {items.length
                        ? tr('Κανένα εργαλείο δεν ταιριάζει στα φίλτρα.')
                        : tr('Δεν υπάρχουν εργαλεία σε Service, με βλάβη, χαμένα ή εκτός χρήσης.')}
                    </td>
                  </tr>
                )}
                {rows.hasMore && <MoreRows colSpan={editable ? 7 : 5} onVisible={rows.showMore} />}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <OrdersPanel
          orders={purchaseOrders}
          editable={editable}
          onStatus={(order, status) =>
            ask({
              title: status === 'CANCELLED' ? tr('Ακύρωση παραγγελίας;') : tr('Σημείωση ως παραγγελθείσα;'),
              message:
                status === 'CANCELLED'
                  ? order.status === 'PARTIAL'
                    ? tr(
                        'Τα υπόλοιπα της παραγγελίας {0} δεν θα έρθουν. Όσα παραλήφθηκαν μένουν στο Απόθεμα.',
                        order.number,
                      )
                    : tr(
                        'Η παραγγελία {0} ακυρώνεται και τα εργαλεία της ξαναγίνονται «Χρειάζεται αντικατάσταση».',
                        order.number,
                      )
                  : tr('Η παραγγελία {0} στάλθηκε στον προμηθευτή.', order.number),
              confirmLabel:
                status === 'CANCELLED'
                  ? order.status === 'PARTIAL'
                    ? tr('Ακύρωση υπολοίπων')
                    : tr('Ακύρωση παραγγελίας')
                  : tr('Επιβεβαίωση'),
              danger: status === 'CANCELLED',
              onConfirm: () => store.setPurchaseOrderStatus(order.id, status),
            })
          }
          onReceive={order => setReceiving(order)}
          onNew={() => setOrdering([])}
          onPrint={order =>
            setPreview({title: tr('Παραγγελία {0}', order.number), html: purchaseOrderHtml(order, organizationName)})
          }
        />
      )}

      {ordering && (
        <OrderDialog
          initialLines={ordering}
          onClose={() => setOrdering(null)}
          onSave={(lines, details) =>
            ask({
              title: tr('Καταχώρηση παραγγελίας;'),
              message: tr('{0} είδη, {1}.', lines.length, pieces(lines.reduce((sum, line) => sum + line.quantity, 0))),
              confirmLabel: tr('Καταχώρηση'),
              onConfirm: () => {
                const number = store.createPurchaseOrder(lines, details);
                setOrdering(null);
                setSelected(new Set());
                if (number) setTab('ORDERS');
              },
            })
          }
        />
      )}
      {receiving && (
        <ReceiveDialog
          order={receiving}
          onClose={() => setReceiving(null)}
          onReceive={quantities =>
            ask({
              title: tr('Παραλαβή στο Απόθεμα;'),
              message: tr(
                'Τα {0} τεμάχια της παραγγελίας {1} μπαίνουν στο Απόθεμα με νέα barcode.',
                quantities.reduce((sum, n) => sum + n, 0),
                receiving.number,
              ),
              confirmLabel: tr('Παραλαβή'),
              onConfirm: () => {
                store.receivePurchaseOrder(receiving.id, quantities);
                setReceiving(null);
              },
            })
          }
        />
      )}
      {confirm}
      {preview && <PrintPreviewModal title={preview.title} html={preview.html} onClose={() => setPreview(null)} />}
    </div>
  );
}

const statusText = (item: ReplacementItem) =>
  item.status === 'REPLACED'
    ? item.tool.replacedBy
      ? tr('Αντικαταστάθηκε από {0}', item.tool.replacedBy)
      : tr('Παραλήφθηκε με {0}', item.order?.number || '')
    : item.status === 'IN_ORDER'
      ? tr('Σε παραγγελία {0}', item.order?.number || '')
      : tr('Χρειάζεται αντικατάσταση');
