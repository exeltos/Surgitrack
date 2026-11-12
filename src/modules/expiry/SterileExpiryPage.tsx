import {statusLabel} from '../../components/ui/statusLabel';
import {SortTh} from '../../components/ui/SortHeader';
import {useTableSort} from '../../components/ui/useTableSort';
import {Link, useSearchParams} from 'react-router-dom';
import {ChevronRight} from 'lucide-react';
import {useSurgi} from '../../store/SurgiStore';
import PageHeader from '../../components/ui/PageHeader';
import QuickFilters from '../../components/ui/QuickFilters';
import AssetFilterBar from '../../components/assets/AssetFilterBar';
import ScrollableListPanel from '../../components/ui/ScrollableListPanel';
import {ListEmpty} from '../../components/ui/EmptyState';
import StatusBadge from '../../components/ui/StatusBadge';
import AssetTypeIcon from '../../components/assets/AssetTypeIcon';
import {useRememberedState} from '../../core/listMemory';
import {formatExpiry, sterileExpiryList} from '../../core/sterileExpiry';
import ExpiryBadge from '../../components/ui/ExpiryBadge';
import {tr, trData} from '../../i18n';

const VIEWS = ['ALERT', 'EXPIRING', 'EXPIRED', 'ALL'] as const;
type View = (typeof VIEWS)[number];

/** Sterile Sets and instruments with their expiry: the ones to watch first. On expiry the app only warns. */
export default function SterileExpiryPage() {
  const {sets, tools, role, currentUser} = useSurgi();
  // A department user sees only their own department's Sets and instruments (none, without a department).
  const departmentUser = role === 'DEPARTMENT';
  const own = departmentUser ? currentUser.department || '' : '';
  const [params] = useSearchParams();
  const initial = (VIEWS as readonly string[]).includes(params.get('view') || '') ? params.get('view')! : 'ALERT';
  const [view, setView] = useRememberedState<string>('expiry.view', initial);
  const [q, setQ] = useRememberedState('expiry.q', '');
  const [department, setDepartment] = useRememberedState('expiry.department', '');
  const all = sterileExpiryList(sets, tools).filter(item => !departmentUser || (!!own && item.department === own));
  const counts = {
    EXPIRING: all.filter(item => item.state === 'EXPIRING').length,
    EXPIRED: all.filter(item => item.state === 'EXPIRED').length,
  };
  // One click picks what to see; the search and the department chosen stay.
  const quick = (next: View) => ({active: view === next, onClick: () => setView(next)});
  const shown = all.filter(
    item =>
      (view === 'ALL' || (view === 'ALERT' ? item.state !== 'OK' : item.state === (view as View))) &&
      (departmentUser || !department || item.department === department) &&
      `${item.name} ${item.barcode} ${item.department || ''}`.toLowerCase().includes(q.toLowerCase()),
  );
  const order = useTableSort(shown, {
    name: item => item.name,
    department: item => trData(item.department),
    place: item => statusLabel(item.assetState),
    sterilized: item => item.sterilizedOn,
    until: item => item.sterileUntil,
    left: item => item.daysLeft,
  });
  const departments = [...new Set(all.map(item => item.department || '').filter(Boolean))].sort();
  return (
    <div className="tools-list-workspace sterile-expiry-page">
      <PageHeader
        title={tr('Λήξεις αποστείρωσης')}
        description={tr('Σετ και εργαλεία που λήγουν ή έληξαν· όταν λήξουν χρειάζονται νέα επεξεργασία.')}
      />
      <QuickFilters
        items={[
          {
            key: 'alert',
            label: tr('Χρειάζονται προσοχή'),
            count: counts.EXPIRING + counts.EXPIRED,
            ...quick('ALERT'),
          },
          {
            key: 'expiring',
            label: tr('Λήγουν σύντομα'),
            count: counts.EXPIRING,
            tone: 'warn',
            ...quick('EXPIRING'),
          },
          {key: 'expired', label: tr('Έληξαν'), count: counts.EXPIRED, tone: 'bad', ...quick('EXPIRED')},
          {key: 'all', label: tr('Όλα'), count: all.length, ...quick('ALL')},
        ]}
      />
      <div className="asset-list-controls">
        <AssetFilterBar
          query={q}
          onQueryChange={setQ}
          placeholder={tr('Ονομασία ή barcode...')}
          filters={
            own
              ? []
              : [
                  {
                    key: 'department',
                    value: department,
                    placeholder: tr('Όλα τα τμήματα'),
                    options: departments.map(value => ({value, label: trData(value)})),
                    onChange: setDepartment,
                  },
                ]
          }
        />
      </div>
      <ScrollableListPanel ariaLabel={tr('Λήξεις αποστείρωσης')}>
        {shown.length === 0 ? (
          <ListEmpty
            total={view === 'ALL' ? all.length : 0}
            none={{
              title: tr('Τίποτα δεν λήγει σύντομα'),
              description: tr(
                'Εδώ εμφανίζονται τα Σετ και τα εργαλεία στον τελευταίο μήνα της αποστείρωσής τους (10 ημέρες για δίμηνη) και όσα έληξαν.',
              ),
            }}
            onClear={() => {
              setQ('');
              setDepartment('');
              setView('ALL');
            }}
          />
        ) : (
          <table className="asset-registry-table registry-fixed expiry-table">
            <thead>
              <tr>
                <SortTh label={tr('Ονομασία')} sortKey="name" sort={order.sort} onSort={order.toggle} />
                {!departmentUser && (
                  <SortTh
                    className="col-dept"
                    label={tr('Τμήμα')}
                    sortKey="department"
                    sort={order.sort}
                    onSort={order.toggle}
                  />
                )}
                <SortTh
                  className="col-place"
                  label={tr('Θέση')}
                  sortKey="place"
                  sort={order.sort}
                  onSort={order.toggle}
                />
                <SortTh
                  className="col-sterilized"
                  label={tr('Αποστείρωση')}
                  sortKey="sterilized"
                  sort={order.sort}
                  onSort={order.toggle}
                />
                <SortTh
                  className="col-until"
                  label={tr('Λήξη')}
                  sortKey="until"
                  sort={order.sort}
                  onSort={order.toggle}
                />
                <SortTh
                  className="col-left"
                  label={tr('Υπόλοιπο')}
                  sortKey="left"
                  sort={order.sort}
                  onSort={order.toggle}
                />
                <th className="col-open">
                  <span className="visually-hidden">{tr('Άνοιγμα')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {order.rows.map(item => {
                const to = item.kind === 'SET' ? `/sets/${item.id}` : `/tools/${item.id}`;
                return (
                  <tr key={`${item.kind}:${item.id}`} className={`expiry-row ${item.state.toLowerCase()}`}>
                    <td>
                      <div className="registry-asset-name">
                        <AssetTypeIcon kind={item.kind} framed size={15} />
                        <span>
                          <Link className="row-title-link" to={to}>
                            {item.name}
                          </Link>
                          <small className="row-sub">
                            <span className="mono registry-row-barcode">{item.barcode}</span>
                          </small>
                        </span>
                      </div>
                    </td>
                    {!departmentUser && <td className="col-dept">{trData(item.department) || '—'}</td>}
                    <td className="col-place">
                      <StatusBadge value={item.assetState} />
                    </td>
                    <td className="col-sterilized" data-label={tr('Αποστείρωση')}>
                      {item.sterilizedOn ? formatExpiry(item.sterilizedOn) : '—'}
                      {item.shelfLifeMonths ? (
                        <small className="row-sub">{tr('{0} μήνες', item.shelfLifeMonths)}</small>
                      ) : null}
                    </td>
                    <td data-label={tr('Λήξη')}>{formatExpiry(item.sterileUntil)}</td>
                    <td>
                      <ExpiryBadge entry={item} />
                    </td>
                    <td>
                      <Link className="icon-link" to={to} aria-label={tr('Άνοιγμα {0}', item.barcode)}>
                        <ChevronRight size={17} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </ScrollableListPanel>
    </div>
  );
}
