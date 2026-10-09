import {Link, useSearchParams} from 'react-router-dom';
import {ChevronRight} from 'lucide-react';
import {useSurgi} from '../../store/SurgiStore';
import PageHeader from '../../components/ui/PageHeader';
import KpiStrip from '../../components/ui/KpiStrip';
import AssetFilterBar from '../../components/assets/AssetFilterBar';
import ScrollableListPanel from '../../components/ui/ScrollableListPanel';
import {ListEmpty} from '../../components/ui/EmptyState';
import StatusBadge from '../../components/ui/StatusBadge';
import AssetTypeIcon from '../../components/assets/AssetTypeIcon';
import {kpiFilters} from '../../core/kpiFilters';
import {useRememberedState} from '../../core/listMemory';
import {formatExpiry, sterileExpiryList} from '../../core/sterileExpiry';
import ExpiryBadge from '../../components/ui/ExpiryBadge';
import {ExpirySymbol, SterileSymbol} from '../../components/ui/SterileDates';
import {tr, trData} from '../../i18n';

const VIEWS = ['ALERT', 'EXPIRING', 'EXPIRED', 'ALL'] as const;
type View = (typeof VIEWS)[number];

/** Sterile Sets and instruments with their expiry: the ones to watch first. On expiry the app only warns. */
export default function SterileExpiryPage() {
  const {sets, tools} = useSurgi();
  const [params] = useSearchParams();
  const initial = (VIEWS as readonly string[]).includes(params.get('view') || '') ? params.get('view')! : 'ALERT';
  const [view, setView] = useRememberedState<string>('expiry.view', initial);
  const [q, setQ] = useRememberedState('expiry.q', '');
  const [department, setDepartment] = useRememberedState('expiry.department', '');
  const all = sterileExpiryList(sets, tools);
  const counts = {
    EXPIRING: all.filter(item => item.state === 'EXPIRING').length,
    EXPIRED: all.filter(item => item.state === 'EXPIRED').length,
  };
  const kpi = kpiFilters({view: [view, setView], q: [q, setQ], department: [department, setDepartment]});
  const shown = all.filter(
    item =>
      (view === 'ALL' || (view === 'ALERT' ? item.state !== 'OK' : item.state === (view as View))) &&
      (!department || item.department === department) &&
      `${item.name} ${item.barcode} ${item.department || ''}`.toLowerCase().includes(q.toLowerCase()),
  );
  const departments = [...new Set(all.map(item => item.department || '').filter(Boolean))].sort();
  return (
    <div className="tools-list-workspace sterile-expiry-page">
      <PageHeader
        title={tr('Λήξεις αποστείρωσης')}
        description={tr('Σετ και εργαλεία που λήγουν ή έληξαν· όταν λήξουν χρειάζονται νέα επεξεργασία.')}
      />
      <KpiStrip
        compact
        items={[
          {label: tr('Χρειάζονται προσοχή'), value: counts.EXPIRING + counts.EXPIRED, ...kpi({view: 'ALERT'})},
          {label: tr('Λήγουν σύντομα'), value: counts.EXPIRING, ...kpi({view: 'EXPIRING'})},
          {label: tr('Έληξαν'), value: counts.EXPIRED, ...kpi({view: 'EXPIRED'})},
          {label: tr('Αποστειρωμένα'), value: all.length, ...kpi({view: 'ALL'})},
        ]}
      />
      <div className="asset-list-controls">
        <AssetFilterBar
          query={q}
          onQueryChange={setQ}
          placeholder={tr('Ονομασία ή barcode...')}
          filters={[
            {
              key: 'department',
              value: department,
              placeholder: tr('Όλα τα τμήματα'),
              options: departments.map(value => ({value, label: trData(value)})),
              onChange: setDepartment,
            },
          ]}
        />
      </div>
      <ScrollableListPanel withKpis ariaLabel={tr('Λήξεις αποστείρωσης')}>
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
                <th>{tr('Ονομασία')}</th>
                <th>Barcode</th>
                <th>{tr('Τμήμα')}</th>
                <th>{tr('Θέση')}</th>
                <th>{tr('Διάρκεια')}</th>
                <th>
                  <span className="th-sym">
                    <SterileSymbol /> {tr('Αποστείρωση')}
                  </span>
                </th>
                <th>
                  <span className="th-sym">
                    <ExpirySymbol /> {tr('Λήγει')}
                  </span>
                </th>
                <th>{tr('Υπόλοιπο')}</th>
                <th>
                  <span className="visually-hidden">{tr('Άνοιγμα')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map(item => {
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
                          <small className="row-sub">{item.kind === 'SET' ? tr('Σετ') : tr('Εργαλείο')}</small>
                        </span>
                      </div>
                    </td>
                    <td className="mono">{item.barcode}</td>
                    <td>{trData(item.department) || '—'}</td>
                    <td>
                      <StatusBadge value={item.assetState} />
                    </td>
                    <td data-label={tr('Διάρκεια')}>
                      {item.shelfLifeMonths ? tr('{0} μήνες', item.shelfLifeMonths) : '—'}
                    </td>
                    <td className="mono" data-label={tr('Αποστείρωση')}>
                      {item.sterilizedOn ? formatExpiry(item.sterilizedOn) : '—'}
                    </td>
                    <td className="mono" data-label={tr('Λήγει')}>
                      {formatExpiry(item.sterileUntil)}
                    </td>
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
