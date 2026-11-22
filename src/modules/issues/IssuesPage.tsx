import {ClipboardList, PackageX, Truck} from 'lucide-react';
import {useSearchParams} from 'react-router-dom';
import {lazy, Suspense, useMemo, useState} from 'react';
import {useSurgi} from '../../store/SurgiStore';
import AssetFilterBar from '../../components/assets/AssetFilterBar';
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
import {useTableSort} from '../../components/ui/useTableSort';
import {daysSince, parseDisplayDate} from '../../core/displayDate';
import {useHasModule} from '../../data/cloud/modulesContext';

/** An open issue older than this many days is "waiting long" (its own card and filter). */
const OLD_ISSUE_DAYS = 7;

/** The colour of a report's kind: damage or loss red, wear amber, a missing piece violet, anything else grey. */
const issueTone = (type: string) =>
  /Βλάβη|Απώλεια/.test(type) && !/Service/.test(type)
    ? 'bad'
    : /Φθορά/.test(type)
      ? 'warn'
      : /Έλλειψη/.test(type)
        ? 'missing'
        : 'neutral';

/** How long an open issue has waited: «Από σήμερα», «1 ημέρα», «N ημέρες». */
const issueAge = (created: string) => {
  const days = daysSince(created) ?? 0;
  return days <= 0 ? tr('Από σήμερα') : days === 1 ? tr('1 ημέρα') : tr('{0} ημέρες', days);
};

/** «S000334 · ΥΣΤΕΡΟΣΚΟΠΗΣΗΣ» → its barcode and its name. */
const assetParts = (asset: string) => {
  const [barcode, ...rest] = asset.split(' · ');
  return {barcode, name: rest.join(' · ') || asset};
};
/** «21/11/2026 10:20» → «21/11 10:20»: the year is the list's own. */
const shortDate = (at: string) => at.replace(/^(\d{1,2}\/\d{1,2})\/\d{4}/, '$1');

const ReplacementsPage = lazy(() => import('../replacements/ReplacementsPage'));
import IssueCard from './IssueCard';
import {SplitEmpty} from '../traceability/InfoList';
import {askDeleteIssue, askEditIssueNote} from '../../components/assets/issueDialogs';
import ResolveIssueDialog from '../../components/assets/ResolveIssueDialog';

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
    deleteIssue,
    editIssueNote,
    createPurchaseOrder,
  } = useSurgi();
  // Only the hospital admin (or the owner acting as one) deletes a report someone wrote.
  const canDelete = role === 'ADMIN';
  const [ordering, setOrdering] = useState<PurchaseOrderLine[] | null>(null);
  const [confirm, ask] = useConfirm();
  const [resolving, setResolving] = useState<Issue | null>(null);
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
  // The report open in the card: the one picked, while it is in the list; otherwise the first of the list.
  const [openId, setOpenId] = useState('');
  const open = filtered.find(i => i.id === openId) || order.rows[0];
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
        onClick={() => setParams({})}
      >
        <ClipboardList size={16} /> {tr('Προβλήματα')} <b>{scopedIssues.filter(i => i.status === 'OPEN').length}</b>
      </button>
      <button
        role="tab"
        aria-selected={tab === 'REPLACEMENTS'}
        className={tab === 'REPLACEMENTS' ? 'active' : ''}
        onClick={() => setParams({tab: 'replacements'})}
      >
        <PackageX size={16} /> {tr('Αντικαταστάσεις')} <b>{neededReplacements}</b>
      </button>
      <button
        role="tab"
        aria-selected={tab === 'ORDERS'}
        className={tab === 'ORDERS' ? 'active' : ''}
        onClick={() => setParams({tab: 'orders'})}
      >
        <Truck size={16} /> {tr('Παραγγελίες')} <b>{purchaseOrders.filter(isReceivable).length}</b>
      </button>
    </div>
  ) : null;
  const goToOrders = () => setParams({tab: 'orders'});
  return (
    <div className="tools-list-workspace">
      <PageHeader eyebrow={tr('Παρακολούθηση')} title={tr('Εκκρεμότητες')} />
      {/* The records in the middle, with the whole height; beside them, on the right, the instruments out of order
          (the same on every tab), each opening the instruments to replace by it. */}
      <div className="issues-layout solo">
        {/* A workspace of its own: its header and filters stay still and only its list scrolls, as on the page. */}
        <div className="issues-main tools-list-workspace">
          {tab !== 'REPORTS' ? (
            <Suspense fallback={<Spinner />}>
              <ReplacementsPage
                reason={params.get('reason') || ''}
                onReason={reason => setParams(reason ? {tab: 'replacements', reason} : {tab: 'replacements'})}
                embedded
                tabs={tabs}
                view={tab === 'ORDERS' ? 'ORDERS' : 'ITEMS'}
                onView={view => setParams(view === 'ORDERS' ? {tab: 'orders'} : {tab: 'replacements'})}
              />
            </Suspense>
          ) : (
            <>
              {tabs}
              <QuickFilters
                items={[
                  {key: 'all', label: tr('Όλες'), count: counted.length, ...card('')},
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
                ]}
              />
              {/* The reports on the left, the one picked on the right: picking another changes only the card. */}
              <div className="trace-split issues-split">
                <aside className="trace-split-list" aria-label={tr('Λίστα εκκρεμοτήτων')}>
                  <AssetFilterBar
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
                    <section className="trace-recent-list issues-list">
                      <ul>
                        {rows.visible.map(i => {
                          const {barcode, name} = assetParts(i.asset);
                          return (
                            <li key={i.id}>
                              <button
                                type="button"
                                className={open?.id === i.id ? 'selected' : undefined}
                                aria-current={open?.id === i.id ? 'true' : undefined}
                                onClick={() => setOpenId(i.id)}
                              >
                                <b className="issue-row-name">{name}</b>
                                <span className={`issue-row-when${isOld(i) ? ' old' : ''}`}>
                                  {i.status === 'OPEN' && isOld(i) ? issueAge(i.created) : shortDate(i.created)}
                                </span>
                                <small>
                                  <span className="mono">{barcode}</span>
                                  {i.department && ` · ${trData(i.department)}`}
                                </small>
                                <span className={`issue-dot ${i.status === 'OPEN' ? issueTone(i.type) : 'done'}`}>
                                  {i.status === 'OPEN' ? trData(i.type) || tr('Πρόβλημα') : tr('Επιλυμένη')}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                        {rows.hasMore && (
                          <li>
                            <MoreRows onVisible={rows.showMore} />
                          </li>
                        )}
                      </ul>
                    </section>
                  )}
                </aside>
                <section className="trace-split-card" aria-label={tr('Πρόβλημα')}>
                  {open ? (
                    <IssueCard
                      issue={open}
                      kind={subject(open).set ? tr('Σετ') : subject(open).tool ? tr('Εργαλείο') : ''}
                      to={subject(open).to}
                      age={issueAge(open.created)}
                      old={isOld(open)}
                      tone={issueTone(open.type)}
                      onResolve={withReplacements && open.status === 'OPEN' ? () => setResolving(open) : undefined}
                      onOrder={
                        withReplacements && subject(open).tool
                          ? () => setOrdering([orderLineFromTool(subject(open).tool!, trData(open.type))])
                          : undefined
                      }
                      onEdit={canDelete ? () => askEditIssueNote(open, ask, editIssueNote) : undefined}
                      onDelete={canDelete ? () => askDeleteIssue(open, ask, deleteIssue) : undefined}
                    />
                  ) : (
                    <SplitEmpty
                      icon={ClipboardList}
                      title={tr('Εκκρεμότητες')}
                      text={tr('Διαλέξτε ένα πρόβλημα από τη λίστα για να δείτε τι αναφέρθηκε και τι μπορεί να γίνει.')}
                    />
                  )}
                </section>
              </div>
            </>
          )}
        </div>
      </div>
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
      {resolving && (
        <ResolveIssueDialog issue={resolving} tool={subject(resolving).tool} onClose={() => setResolving(null)} />
      )}
    </div>
  );
}
