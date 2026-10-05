import {ClipboardList, Images, PackageX} from 'lucide-react';
import {useSearchParams} from 'react-router-dom';
import {lazy, Suspense, useMemo} from 'react';
import {useSurgi} from '../../store/SurgiStore';
import AssetFilterBar from '../../components/assets/AssetFilterBar';
import ScrollableListPanel from '../../components/ui/ScrollableListPanel';
import PageHeader from '../../components/ui/PageHeader';
import {tr, trData} from '../../i18n';
import {useRememberedState} from '../../core/listMemory';
import Spinner from '../../components/ui/Spinner';
import {replacementItems} from '../../core/replacements';

const ReplacementsPage = lazy(() => import('../replacements/ReplacementsPage'));

export default function IssuesPage() {
  const {issues, role, currentUser, can, tools, retiredTools, sets, movements, purchaseOrders} = useSurgi();
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
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableListPanel>
        </>
      )}
    </div>
  );
}
