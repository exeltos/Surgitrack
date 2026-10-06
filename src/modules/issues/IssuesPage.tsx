import {CheckCircle2, ClipboardList, ExternalLink, Images, PackageX, ShoppingCart} from 'lucide-react';
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
  // Sterilization and admins also see the instruments to replace, as a second tab.
  const withReplacements = can('stock.manage');
  const [params, setParams] = useSearchParams();
  const tab = withReplacements && params.get('tab') === 'replacements' ? 'REPLACEMENTS' : 'REPORTS';
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
  const [status, setStatus] = useRememberedState('status', '');
  const values = (key: 'department' | 'type' | 'status') =>
    [...new Set(scopedIssues.map(i => i[key]).filter(Boolean))].sort();
  const filtered = scopedIssues.filter(
    i =>
      (!department || i.department === department) &&
      (!type || i.type === type) &&
      (!status || i.status === status) &&
      `${i.asset} ${i.type} ${i.department} ${i.note}`.toLowerCase().includes(q.toLowerCase()),
  );
  /** What an issue is about: the instrument or Set named by its barcode, to open it or order it. */
  const subject = (issue: Issue) => {
    const barcode = issue.asset.split(' ')[0];
    const tool = [...tools, ...retiredTools].find(t => t.barcode === barcode);
    const set = tool ? undefined : sets.find(s => s.barcode === barcode);
    return {tool, set, to: tool ? `/tools/${tool.id}` : set ? `/sets/${set.id}` : undefined};
  };
  const goToOrders = () => setParams({tab: 'replacements', view: 'orders'}, {replace: true});
  return (
    <div className="tools-list-workspace">
      <PageHeader
        eyebrow={tr('ΠΑΡΑΚΟΛΟΥΘΗΣΗ')}
        title={tr('Εκκρεμότητες')}
        description={
          role === 'DEPARTMENT'
            ? tr('Αναφορές και εκκρεμότητες του τμήματος {0}.', trData(currentUser.department))
            : tr(
                'Τα προβλήματα που αναφέρθηκαν (ελλείψεις, φθορές, βλάβες, απώλειες) και τα εργαλεία που πρέπει να αντικατασταθούν από το Απόθεμα ή με παραγγελία.',
              )
        }
      />
      {withReplacements && (
        <div className="name-check-tabs issues-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'REPORTS'}
            className={tab === 'REPORTS' ? 'active' : ''}
            onClick={() => setParams({}, {replace: true})}
          >
            <ClipboardList size={16} /> {tr('Αναφορές προβλημάτων')}{' '}
            <b>{scopedIssues.filter(i => i.status === 'OPEN').length}</b>
          </button>
          <button
            role="tab"
            aria-selected={tab === 'REPLACEMENTS'}
            className={tab === 'REPLACEMENTS' ? 'active' : ''}
            onClick={() => setParams({tab: 'replacements'}, {replace: true})}
          >
            <PackageX size={16} /> {tr('Αντικαταστάσεις & Παραγγελίες')} <b>{neededReplacements}</b>
          </button>
        </div>
      )}
      {tab === 'REPLACEMENTS' ? (
        <Suspense fallback={<Spinner />}>
          <ReplacementsPage embedded />
        </Suspense>
      ) : (
        <>
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
              {
                key: 'status',
                value: status,
                placeholder: tr('Όλες οι καταστάσεις'),
                options: [
                  {value: 'OPEN', label: tr('Ανοικτές')},
                  {value: 'RESOLVED', label: tr('Επιλυμένες')},
                ],
                onChange: setStatus,
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
                }}
              />
            ) : (
              <table className="asset-registry-table issues-registry-table">
                <thead>
                  <tr>
                    <th>{tr('Αντικείμενο')}</th>
                    <th>{tr('Τύπος')}</th>
                    <th>{tr('Τμήμα')}</th>
                    <th>{tr('Δημιουργήθηκε')}</th>
                    <th>{tr('Σημείωση')}</th>
                    <th>{tr('Φωτογραφίες')}</th>
                    <th>{tr('Κατάσταση')}</th>
                    {withReplacements && (
                      <th>
                        <span className="visually-hidden">{tr('Ενέργειες')}</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(i => (
                    <tr key={i.id}>
                      <td>
                        <strong>{i.asset}</strong>
                      </td>
                      <td>{trData(i.type)}</td>
                      <td>{trData(i.department)}</td>
                      <td>{i.created}</td>
                      <td>{i.note}</td>
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
                      <td>
                        <span className={`badge ${i.status === 'OPEN' ? 'warning' : ''}`}>
                          {i.status === 'OPEN' ? tr('Ανοικτή') : tr('Επιλυμένη')}
                        </span>
                      </td>
                      {withReplacements && (
                        <td className="issue-actions">
                          <div className="issue-actions-row">
                            {subject(i).to && (
                              <Link
                                className="issue-action"
                                to={subject(i).to!}
                                title={tr('Άνοιγμα')}
                                aria-label={tr('Άνοιγμα')}
                              >
                                <ExternalLink size={14} />
                              </Link>
                            )}
                            {subject(i).tool && (
                              <button
                                type="button"
                                className="issue-action"
                                title={tr('Παραγγελία')}
                                aria-label={tr('Παραγγελία')}
                                onClick={() => setOrdering([orderLineFromTool(subject(i).tool!, trData(i.type))])}
                              >
                                <ShoppingCart size={14} />
                              </button>
                            )}
                            {i.status === 'OPEN' && (
                              <button
                                type="button"
                                className="issue-action"
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
                                    onConfirm: () => resolveIssues([i.id], tr('Επιλύθηκε χειροκίνητα')),
                                  })
                                }
                              >
                                <CheckCircle2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
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
