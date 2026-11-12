import {CheckCircle2, ClipboardList, ExternalLink, Images, PackageX, ShoppingCart, Truck} from 'lucide-react';
import {Link, useSearchParams} from 'react-router-dom';
import {lazy, Suspense, useMemo, useState} from 'react';
import {useSurgi} from '../../store/SurgiStore';
import AssetFilterBar from '../../components/assets/AssetFilterBar';
import ScrollableListPanel from '../../components/ui/ScrollableListPanel';
import {ListEmpty} from '../../components/ui/EmptyState';
import PageHeader from '../../components/ui/PageHeader';
import {tr, trData} from '../../i18n';
import {useRememberedState} from '../../core/listMemory';
import Spinner from '../../components/ui/Spinner';
import {orderLineFromTool, replacementItems} from '../../core/replacements';
import type {Issue, PurchaseOrderLine} from '../../types/domain';
import OrderDialog from '../replacements/OrderDialog';
import {pieces} from '../replacements/pieces';
import {useConfirm} from '../../components/ui/useConfirm';
import QuickFilters from '../../components/ui/QuickFilters';
import {isReceivable} from '../../core/purchaseReceipt';
import {MoreRows} from '../../components/ui/ProgressiveList';
import {useProgressiveList} from '../../core/useProgressiveList';
import {SortTh} from '../../components/ui/SortHeader';
import {useTableSort} from '../../components/ui/useTableSort';
import {daysSince, parseDisplayDate} from '../../core/displayDate';
import {useHasModule} from '../../data/cloud/modulesContext';

/** An open issue older than this many days is "waiting long" (its own card and filter). */
const OLD_ISSUE_DAYS = 7;

const ReplacementsPage = lazy(() => import('../replacements/ReplacementsPage'));

export default function IssuesPage() {
  const {
    issues,
    role,
    currentUser,
    can,
    tools,
    retiredTools,
    sets,
    movements,
    purchaseOrders,
    resolveIssues,
    createPurchaseOrder,
  } = useSurgi();
  const [ordering, setOrdering] = useState<PurchaseOrderLine[] | null>(null);
  const [confirm, ask] = useConfirm();
  // Sterilization and admins also see the instruments to replace, as a second tab (in a hospital the platform
  // owner gave the Replacements & Orders module).
  const hasReplacements = useHasModule('REPLACEMENTS');
  const withReplacements = can('stock.manage') && hasReplacements;
  const [params, setParams] = useSearchParams();
  // Three tabs: the reports, the instruments to replace and the purchase orders (`view=orders` is the old link).
  const tab = !withReplacements
    ? 'REPORTS'
    : params.get('tab') === 'orders' || (params.get('tab') === 'replacements' && params.get('view') === 'orders')
      ? 'ORDERS'
      : params.get('tab') === 'replacements'
        ? 'REPLACEMENTS'
        : 'REPORTS';
  const neededReplacements = useMemo(
    () =>
      withReplacements
        ? replacementItems({tools, retiredTools, sets, issues, movements, purchaseOrders}).filter(
            item => item.status === 'NEEDED',
          ).length
        : 0,
    [withReplacements, tools, retiredTools, sets, issues, movements, purchaseOrders],
  );
  const scopedIssues =
    role === 'DEPARTMENT' ? issues.filter(issue => issue.department === currentUser.department) : issues;
  const [q, setQ] = useRememberedState('q', '');
  const [department, setDepartment] = useRememberedState('department', '');
  const [type, setType] = useRememberedState('type', '');
  // The list opens on the open reports; the resolved ones are a click away.
  const [status, setStatus] = useRememberedState('status', 'OPEN');
  const [age, setAge] = useRememberedState('age', '');
  const isOld = (issue: Issue) => issue.status === 'OPEN' && (daysSince(issue.created) ?? 0) > OLD_ISSUE_DAYS;
  const values = (key: 'department' | 'type' | 'status') =>
    [...new Set(scopedIssues.map(i => i[key]).filter(Boolean))].sort();
  const filtered = scopedIssues.filter(
    i =>
      (!department || i.department === department) &&
      (!type || i.type === type) &&
      (!status || i.status === status) &&
      (age !== 'OLD' || isOld(i)) &&
      `${i.asset} ${i.type} ${i.department} ${i.note}`.toLowerCase().includes(q.toLowerCase()),
  );
  // Long lists render in steps as they scroll into view (a large hospital has hundreds of issues).
  const order = useTableSort(filtered, {
    asset: i => i.asset,
    note: i => i.note,
    created: i => parseDisplayDate(i.created)?.getTime(),
    status: i => i.status,
  });
  const rows = useProgressiveList(
    order.rows,
    [q, department, type, status, age, order.sort?.key, order.sort?.dir].join('|'),
  );
  // The photos column shows only when some listed issue has photos.
  const withPhotos = filtered.some(i => i.photos?.length);
  /** What an issue is about: the instrument or Set named by its barcode, to open it or order it. */
  const toolsByBarcode = useMemo(
    () => new Map([...tools, ...retiredTools].map(t => [t.barcode, t] as const)),
    [tools, retiredTools],
  );
  const setsByBarcode = useMemo(() => new Map(sets.map(s => [s.barcode, s] as const)), [sets]);
  const subject = (issue: Issue) => {
    const barcode = issue.asset.split(' ')[0];
    const tool = toolsByBarcode.get(barcode);
    const set = tool ? undefined : setsByBarcode.get(barcode);
    return {tool, set, to: tool ? `/tools/${tool.id}` : set ? `/sets/${set.id}` : undefined};
  };
  // The quick filters count within the department/type/search chosen, and set the status (and age) filters.
  const counted = scopedIssues.filter(
    i =>
      (!department || i.department === department) &&
      (!type || i.type === type) &&
      `${i.asset} ${i.type} ${i.department} ${i.note}`.toLowerCase().includes(q.toLowerCase()),
  );
  const card = (nextStatus: string, nextAge = '') => ({
    onClick: () => {
      setStatus(nextStatus);
      setAge(nextAge);
    },
    active: status === nextStatus && age === nextAge,
  });
  const tabs = withReplacements ? (
    <div className="name-check-tabs issues-tabs" role="tablist">
      <button
        role="tab"
        aria-selected={tab === 'REPORTS'}
        className={tab === 'REPORTS' ? 'active' : ''}
        onClick={() => setParams({}, {replace: true})}
      >
        <ClipboardList size={16} /> {tr('Αναφορές')} <b>{scopedIssues.filter(i => i.status === 'OPEN').length}</b>
      </button>
      <button
        role="tab"
        aria-selected={tab === 'REPLACEMENTS'}
        className={tab === 'REPLACEMENTS' ? 'active' : ''}
        onClick={() => setParams({tab: 'replacements'}, {replace: true})}
      >
        <PackageX size={16} /> {tr('Αντικαταστάσεις')} <b>{neededReplacements}</b>
      </button>
      <button
        role="tab"
        aria-selected={tab === 'ORDERS'}
        className={tab === 'ORDERS' ? 'active' : ''}
        onClick={() => setParams({tab: 'orders'}, {replace: true})}
      >
        <Truck size={16} /> {tr('Παραγγελίες')} <b>{purchaseOrders.filter(isReceivable).length}</b>
      </button>
    </div>
  ) : null;
  const goToOrders = () => setParams({tab: 'orders'}, {replace: true});
  return (
    <div className="tools-list-workspace">
      <PageHeader
        eyebrow={tr('ΠΑΡΑΚΟΛΟΥΘΗΣΗ')}
        title={tr('Εκκρεμότητες')}
        description={
          role === 'DEPARTMENT'
            ? tr('Αναφορές και εκκρεμότητες του τμήματος {0}.', trData(currentUser.department))
            : tr('Προβλήματα που αναφέρθηκαν και εργαλεία που πρέπει να αντικατασταθούν.')
        }
      />
      {tab !== 'REPORTS' ? (
        <Suspense fallback={<Spinner />}>
          <ReplacementsPage
            embedded
            tabs={tabs}
            view={tab === 'ORDERS' ? 'ORDERS' : 'ITEMS'}
            onView={view => setParams(view === 'ORDERS' ? {tab: 'orders'} : {tab: 'replacements'}, {replace: true})}
          />
        </Suspense>
      ) : (
        <>
          {tabs}
          <AssetFilterBar
            className="with-quick-filters"
            extra={
              <QuickFilters
                items={[
                  {
                    key: 'open',
                    label: tr('Ανοικτές'),
                    count: counted.filter(i => i.status === 'OPEN').length,
                    tone: 'warn',
                    ...card('OPEN'),
                  },
                  {
                    key: 'old',
                    label: tr('Πάνω από {0} ημέρες', OLD_ISSUE_DAYS),
                    count: counted.filter(isOld).length,
                    tone: 'bad',
                    ...card('OPEN', 'OLD'),
                  },
                  {
                    key: 'resolved',
                    label: tr('Επιλυμένες'),
                    count: counted.filter(i => i.status === 'RESOLVED').length,
                    ...card('RESOLVED'),
                  },
                  {key: 'all', label: tr('Όλες'), count: counted.length, ...card('')},
                ]}
              />
            }
            query={q}
            onQueryChange={setQ}
            placeholder={tr('Εργαλείο/Σετ, barcode, τύπος ή σημείωση...')}
            filters={[
              ...(role === 'DEPARTMENT'
                ? []
                : [
                    {
                      key: 'department',
                      value: department,
                      placeholder: tr('Όλα τα τμήματα'),
                      options: values('department').map(value => ({value, label: value})),
                      onChange: setDepartment,
                    },
                  ]),
              {
                key: 'type',
                value: type,
                placeholder: tr('Όλοι οι τύποι'),
                options: values('type').map(value => ({value, label: value})),
                onChange: setType,
              },
            ]}
          />
          <ScrollableListPanel ariaLabel={tr('Λίστα εκκρεμοτήτων')}>
            {filtered.length === 0 ? (
              <ListEmpty
                total={scopedIssues.length}
                none={{
                  title: tr('Δεν υπάρχουν εκκρεμότητες'),
                  description: tr(
                    'Όταν κάποιος αναφέρει φθορά, έλλειψη ή απώλεια σε Σετ ή εργαλείο, θα εμφανιστεί εδώ.',
                  ),
                }}
                onClear={() => {
                  setQ('');
                  setDepartment('');
                  setType('');
                  setStatus('');
                  setAge('');
                }}
              />
            ) : (
              <table className="asset-registry-table issues-registry-table issues-fixed">
                <thead>
                  <tr>
                    <SortTh label={tr('Αντικείμενο')} sortKey="asset" sort={order.sort} onSort={order.toggle} />
                    <SortTh label={tr('Σημείωση')} sortKey="note" sort={order.sort} onSort={order.toggle} />
                    <SortTh
                      className="col-created"
                      label={tr('Δημιουργήθηκε')}
                      sortKey="created"
                      sort={order.sort}
                      onSort={order.toggle}
                    />
                    {withPhotos && <th className="col-photos">{tr('Φωτογραφίες')}</th>}
                    <SortTh
                      className="col-status"
                      label={tr('Κατάσταση')}
                      sortKey="status"
                      sort={order.sort}
                      onSort={order.toggle}
                    />
                    {withReplacements && (
                      <th className="col-actions">
                        <span className="visually-hidden">{tr('Ενέργειες')}</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.visible.map(i => (
                    <tr key={i.id}>
                      <td>
                        {subject(i).to ? (
                          <Link className="issue-asset" to={subject(i).to!}>
                            {i.asset}
                          </Link>
                        ) : (
                          <strong className="issue-asset">{i.asset}</strong>
                        )}
                        <small className="row-sub">
                          {[trData(i.type), trData(i.department)].filter(Boolean).join(' · ')}
                        </small>
                        {i.note && <small className="issue-note-inline">{i.note}</small>}
                      </td>
                      <td className="issue-note" title={i.note}>
                        <span>{i.note}</span>
                      </td>
                      <td>{i.created}</td>
                      {withPhotos && (
                        <td>
                          {i.photos?.length ? (
                            <div className="issue-table-photos">
                              {i.photos.slice(0, 3).map(photo => (
                                <img key={photo.id} src={photo.dataUrl} alt={photo.name} />
                              ))}
                              {i.photos.length > 3 && <span>+{i.photos.length - 3}</span>}
                            </div>
                          ) : (
                            <span className="issue-no-photo">
                              <Images size={14} />—
                            </span>
                          )}
                        </td>
                      )}
                      <td>
                        <span className={`badge ${i.status === 'OPEN' ? 'warning' : ''}`}>
                          {i.status === 'OPEN' ? tr('Ανοικτή') : tr('Επιλυμένη')}
                        </span>
                      </td>
                      {withReplacements && (
                        <td className="issue-actions">
                          <div className="issue-actions-row">
                            {i.status === 'OPEN' && (
                              <button
                                type="button"
                                className="issue-action wide slot-resolve"
                                title={tr('Επίλυση')}
                                aria-label={tr('Επίλυση')}
                                onClick={() =>
                                  ask({
                                    title: tr('Επίλυση εκκρεμότητας;'),
                                    message: tr(
                                      'Η εκκρεμότητα «{0}» για {1} θα σημειωθεί ως επιλυμένη.',
                                      trData(i.type),
                                      i.asset,
                                    ),
                                    confirmLabel: tr('Επίλυση'),
                                    note: {
                                      label: tr('Πώς επιλύθηκε (προαιρετικό)'),
                                      placeholder: tr('π.χ. Αντικαταστάθηκε από το Απόθεμα'),
                                    },
                                    onConfirm: how => resolveIssues([i.id], how || tr('Επιλύθηκε χειροκίνητα')),
                                  })
                                }
                              >
                                <CheckCircle2 size={14} />
                                {tr('Επίλυση')}
                              </button>
                            )}
                            {subject(i).tool && (
                              <button
                                type="button"
                                className="issue-action slot-order"
                                title={tr('Παραγγελία αγοράς')}
                                aria-label={tr('Παραγγελία')}
                                onClick={() => setOrdering([orderLineFromTool(subject(i).tool!, trData(i.type))])}
                              >
                                <ShoppingCart size={14} />
                              </button>
                            )}
                            {subject(i).to && (
                              <Link
                                className="issue-action slot-open"
                                to={subject(i).to!}
                                title={tr('Άνοιγμα καρτέλας')}
                                aria-label={tr('Άνοιγμα καρτέλας')}
                              >
                                <ExternalLink size={14} />
                              </Link>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {rows.hasMore && (
                    <MoreRows
                      colSpan={4 + (withPhotos ? 1 : 0) + (withReplacements ? 1 : 0)}
                      onVisible={rows.showMore}
                    />
                  )}
                </tbody>
              </table>
            )}
          </ScrollableListPanel>
        </>
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
                const number = createPurchaseOrder(lines, details);
                setOrdering(null);
                if (number) goToOrders();
              },
            })
          }
        />
      )}
      {confirm}
    </div>
  );
}
