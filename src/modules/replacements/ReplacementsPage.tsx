import {useMemo, useState} from 'react';
import {Link} from 'react-router-dom';
import {
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  PackageCheck,
  Printer,
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
import {downloadXlsx} from '../../core/exportTable';
import {
  REASON_LABEL,
  allocateStock,
  orderLines,
  replacementItems,
  type ReplacementItem,
  type ReplacementReason,
} from '../../core/replacements';
import type {PurchaseOrder, PurchaseOrderLine} from '../../types/domain';
import {orderStatusLabel, purchaseOrderHtml, replacementListHtml} from './replacementPrint';
import {tr, trData} from '../../i18n';

type Tab = 'ITEMS' | 'ORDERS';
type StatusFilter = '' | 'NEEDED' | 'IN_ORDER' | 'REPLACED';

/**
 * Instruments in Service, damaged, lost or out of use: whether the same instrument waits in Stock,
 * replacing them from Stock in one step, and recording purchase orders for the rest.
 */
export default function ReplacementsPage() {
  const store = useSurgi();
  const {tools, retiredTools, sets, issues, movements, purchaseOrders, can, organizationName} = store;
  const editable = can('stock.manage');
  const items = useMemo(
    () => replacementItems({tools, retiredTools, sets, issues, movements, purchaseOrders}),
    [tools, retiredTools, sets, issues, movements, purchaseOrders],
  );
  const [tab, setTab] = useState<Tab>('ITEMS');
  const [query, setQuery] = useState('');
  const [reason, setReason] = useState('');
  const [department, setDepartment] = useState('');
  const [stock, setStock] = useState('');
  const [status, setStatus] = useState<StatusFilter>('NEEDED');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ordering, setOrdering] = useState<ReplacementItem[] | null>(null);
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
        {value: 'YES', label: tr('Υπάρχει στο απόθεμα')},
        {value: 'NO', label: tr('Δεν υπάρχει στο απόθεμα')},
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
    store.replaceFromStock(pairs);
    setSelected(new Set());
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
  const exportExcel = () =>
    downloadXlsx({
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
    <div className="replacements">
      <PageHeader
        eyebrow={tr('ΒΛΑΒΕΣ · SERVICE · ΑΠΩΛΕΙΕΣ')}
        title={tr('Αντικαταστάσεις')}
        description={tr(
          'Εργαλεία σε Service, με βλάβη ή φθορά, χαμένα ή εκτός χρήσης. Για καθένα φαίνεται αν υπάρχει ίδιο στο Απόθεμα: αντικαθίσταται με ένα κλικ, αλλιώς καταχωρείται παραγγελία αγοράς.',
        )}
      />
      <div className="replacements-kpis">
        <button
          type="button"
          className={status === 'NEEDED' && !stock ? 'active warn' : 'warn'}
          onClick={() => (setStatus('NEEDED'), setStock(''))}
        >
          <span>{tr('Χρειάζονται αντικατάσταση')}</span>
          <strong>{needed.length}</strong>
        </button>
        <button
          type="button"
          className={status === 'NEEDED' && stock === 'YES' ? 'active good' : 'good'}
          onClick={() => (setStatus('NEEDED'), setStock('YES'))}
        >
          <span>{tr('Υπάρχει στο απόθεμα')}</span>
          <strong>{needed.filter(i => i.stock.length).length}</strong>
        </button>
        <button
          type="button"
          className={status === 'NEEDED' && stock === 'NO' ? 'active bad' : 'bad'}
          onClick={() => (setStatus('NEEDED'), setStock('NO'))}
        >
          <span>{tr('Δεν υπάρχει στο απόθεμα')}</span>
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
          <ClipboardList size={16} /> {tr('Παραγγελίες')}{' '}
          <b>{purchaseOrders.filter(o => o.status === 'OPEN' || o.status === 'ORDERED').length}</b>
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
            <AppButton icon={<FileSpreadsheet size={15} />} onClick={exportExcel}>
              {tr('Excel')}
            </AppButton>
            <AppButton icon={<Printer size={15} />} onClick={printList}>
              {picked.length ? tr('Εκτύπωση επιλεγμένων') : tr('Εκτύπωση λίστας')}
            </AppButton>
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
                onClick={() => setOrdering(picked.filter(item => item.status !== 'REPLACED'))}
              >
                {tr('Παραγγελία αγοράς')}
              </AppButton>
              <button type="button" className="replacements-clear" onClick={() => setSelected(new Set())}>
                <X size={14} /> {tr('Καθαρισμός επιλογής')}
              </button>
            </div>
          )}
          <div className="replacements-table">
            <table>
              <thead>
                <tr>
                  {editable && (
                    <th className="pick">
                      <input type="checkbox" checked={allShown} onChange={toggleAll} aria-label={tr('Επιλογή όλων')} />
                    </th>
                  )}
                  <th>Barcode</th>
                  <th>{tr('Εργαλείο')}</th>
                  <th>{tr('Σετ / τμήμα')}</th>
                  <th>{tr('Αιτία')}</th>
                  <th>{tr('Από')}</th>
                  <th>{tr('Απόθεμα')}</th>
                  <th>{tr('Κατάσταση')}</th>
                  {editable && <th />}
                </tr>
              </thead>
              <tbody>
                {shown.map(item => {
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
                      <td className="mono">
                        <Link to={`/tools/${item.tool.id}`}>{item.tool.barcode}</Link>
                      </td>
                      <td>
                        <strong>{item.tool.name}</strong>
                        <small>
                          {item.tool.code || '—'}
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
                      <td className="since">{item.since || '—'}</td>
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
                      </td>
                      {editable && (
                        <td className="row-actions">
                          {canReplace ? (
                            <button type="button" className="primary" onClick={() => replace([item])}>
                              <PackageCheck size={13} /> {tr('Αντικατάσταση')}
                            </button>
                          ) : item.status === 'NEEDED' ? (
                            <button type="button" onClick={() => setOrdering([item])}>
                              <ShoppingCart size={13} /> {tr('Παραγγελία')}
                            </button>
                          ) : null}
                          {item.reason === 'SERVICE' && item.status !== 'REPLACED' && (
                            <button
                              type="button"
                              title={tr('Επέστρεψε επισκευασμένο: πάει στο Απόθεμα')}
                              onClick={() => store.returnToService('TOOL', item.tool.id)}
                            >
                              <Undo2 size={13} /> {tr('Επιστροφή')}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {!shown.length && (
                  <tr>
                    <td colSpan={editable ? 9 : 7} className="empty">
                      {items.length
                        ? tr('Κανένα εργαλείο δεν ταιριάζει στα φίλτρα.')
                        : tr('Δεν υπάρχουν εργαλεία σε Service, με βλάβη, χαμένα ή εκτός χρήσης.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <Orders
          orders={purchaseOrders}
          editable={editable}
          onStatus={store.setPurchaseOrderStatus}
          onPrint={order =>
            setPreview({title: tr('Παραγγελία {0}', order.number), html: purchaseOrderHtml(order, organizationName)})
          }
        />
      )}

      {ordering && (
        <OrderDialog
          items={ordering}
          onClose={() => setOrdering(null)}
          onSave={(lines, details) => {
            const number = store.createPurchaseOrder(lines, details);
            setOrdering(null);
            setSelected(new Set());
            if (number) setTab('ORDERS');
          }}
        />
      )}
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

/** The order being recorded: one line per instrument kind, quantities editable, supplier and note. */
function OrderDialog({
  items,
  onClose,
  onSave,
}: {
  items: ReplacementItem[];
  onClose: () => void;
  onSave: (lines: PurchaseOrderLine[], details: {supplier?: string; note?: string}) => void;
}) {
  const [lines, setLines] = useState<PurchaseOrderLine[]>(() => orderLines(items));
  const [supplier, setSupplier] = useState('');
  const [note, setNote] = useState('');
  const total = lines.reduce((sum, line) => sum + line.quantity, 0);
  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="replacements-order-modal" role="dialog" aria-label={tr('Νέα παραγγελία αγοράς')}>
        <header>
          <div>
            <span className="eyebrow">{tr('ΠΑΡΑΓΓΕΛΙΑ ΑΓΟΡΑΣ')}</span>
            <h2>{tr('Νέα παραγγελία αγοράς')}</h2>
            <p>{tr('Μία γραμμή ανά είδος εργαλείου. Αλλάξτε την ποσότητα αν χρειάζεστε περισσότερα ή λιγότερα.')}</p>
          </div>
          <button type="button" className="modal-x" aria-label={tr('Κλείσιμο')} onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="replacements-order-lines">
          <table>
            <thead>
              <tr>
                <th>{tr('Κωδικός')}</th>
                <th>{tr('Εργαλείο')}</th>
                <th>{tr('Αιτία')}</th>
                <th>{tr('Αντικαθιστά')}</th>
                <th>{tr('Ποσ.')}</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={`${line.code}-${line.name}`}>
                  <td className="mono">{line.code || '—'}</td>
                  <td>
                    <strong>{line.name}</strong>
                    <small>{line.manufacturer || ''}</small>
                  </td>
                  <td>{line.reason}</td>
                  <td className="mono small">{line.barcodes.join(', ')}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={line.quantity}
                      aria-label={tr('Ποσότητα')}
                      onChange={e =>
                        setLines(current =>
                          current.map((l, i) =>
                            i === index ? {...l, quantity: Math.max(0, Math.min(999, Number(e.target.value) || 0))} : l,
                          ),
                        )
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="replacements-order-fields">
          <label>
            {tr('Προμηθευτής')}
            <input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder={tr('Προαιρετικό')} />
          </label>
          <label>
            {tr('Σημείωση')}
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={tr('Π.χ. επείγον, προϋπολογισμός…')}
            />
          </label>
        </div>
        <footer>
          <span>{tr('{0} τεμάχια', total)}</span>
          <AppButton onClick={onClose}>{tr('Ακύρωση')}</AppButton>
          <AppButton
            variant="primary"
            icon={<ShoppingCart size={15} />}
            disabled={!total}
            onClick={() => onSave(lines, {supplier, note})}
          >
            {tr('Καταχώρηση παραγγελίας')}
          </AppButton>
        </footer>
      </div>
    </div>
  );
}

/** The purchase orders, newest first, with their status and print. */
function Orders({
  orders,
  editable,
  onStatus,
  onPrint,
}: {
  orders: PurchaseOrder[];
  editable: boolean;
  onStatus: (id: string, status: PurchaseOrder['status']) => void;
  onPrint: (order: PurchaseOrder) => void;
}) {
  const [open, setOpen] = useState<string | null>(orders[0]?.id || null);
  if (!orders.length)
    return (
      <section className="replacements-card replacements-empty">
        <ClipboardList size={26} />
        <strong>{tr('Δεν υπάρχουν παραγγελίες ακόμη.')}</strong>
        <span>{tr('Επιλέξτε εργαλεία στην καρτέλα «Εργαλεία» και πατήστε «Παραγγελία αγοράς».')}</span>
      </section>
    );
  return (
    <section className="replacements-orders">
      {orders.map(order => {
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
                {tr('{0} είδη', order.lines.length)} · {tr('{0} τεμάχια', total)}
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
                        <td className="qty">{line.quantity}</td>
                        <td>{line.reason}</td>
                        <td className="mono small">{line.barcodes.join(', ')}</td>
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
                    <AppButton variant="primary" onClick={() => onStatus(order.id, 'ORDERED')}>
                      {tr('Σημείωση ως παραγγελθείσα')}
                    </AppButton>
                  )}
                  {editable && (order.status === 'OPEN' || order.status === 'ORDERED') && (
                    <>
                      <AppButton onClick={() => onStatus(order.id, 'RECEIVED')}>{tr('Παραλήφθηκε')}</AppButton>
                      <AppButton onClick={() => onStatus(order.id, 'CANCELLED')}>{tr('Ακύρωση παραγγελίας')}</AppButton>
                    </>
                  )}
                  {order.status === 'RECEIVED' && (
                    <small>
                      {tr(
                        'Παραλήφθηκε {0}. Καταχωρήστε τα νέα εργαλεία από «Εργαλεία → Νέο εργαλείο» ή «Μαζική εισαγωγή» ώστε να μπουν στο Απόθεμα.',
                        order.receivedAt || '',
                      )}
                    </small>
                  )}
                </div>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
