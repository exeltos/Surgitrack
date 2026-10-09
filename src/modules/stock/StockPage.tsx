import {ListEmpty} from '../../components/ui/EmptyState';
import {Plus, ChevronRight, Boxes, Gauge} from 'lucide-react';
import {useMemo} from 'react';
import {Link, useNavigate, useSearchParams} from 'react-router-dom';
import {matchesUsage, usageFilterOptions} from '../../core/usageFilter';
import {useLibraries} from '../../core/LibraryStore';
import {MoreRows} from '../../components/ui/ProgressiveList';
import {useProgressiveList} from '../../core/useProgressiveList';
import {statusLabel} from '../../components/ui/statusLabel';
import {useSurgi} from '../../store/SurgiStore';
import StockMinimums from './StockMinimums';
import {belowMinimum, minimumRows} from '../../core/stockMinimums';
import AssetTypeIcon from '../../components/assets/AssetTypeIcon';
import AssetFilterBar from '../../components/assets/AssetFilterBar';
import AppButton from '../../components/ui/AppButton';
import StatusBadge from '../../components/ui/StatusBadge';
import ScrollableListPanel from '../../components/ui/ScrollableListPanel';
import PageHeader from '../../components/ui/PageHeader';
import KpiStrip from '../../components/ui/KpiStrip';
import {kpiFilters} from '../../core/kpiFilters';
import {tr, trData} from '../../i18n';
import {useRememberedState} from '../../core/listMemory';
import ColorMarker from '../../components/assets/ColorMarker';
import {effectiveToolMarker} from '../../core/colorTapes';

export default function StockPage() {
  const {tools, retiredTools, can, purchaseOrders} = useSurgi();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'minimums' ? 'MIN' : 'LIST';
  const navigate = useNavigate();
  const stock = tools.filter(t => t.mode === 'STOCK');
  const [q, setQ] = useRememberedState('q', '');
  const [specialty, setSpecialty] = useRememberedState('specialty', '');
  const [manufacturer, setManufacturer] = useRememberedState('manufacturer', '');
  const [state, setState] = useRememberedState('state', '');
  const [usage, setUsage] = useRememberedState('usage', '');
  const {systemSettings} = useLibraries();
  const lowCount = useMemo(
    () => belowMinimum(minimumRows([...tools, ...retiredTools], purchaseOrders, systemSettings.stockMinimums)).length,
    [tools, retiredTools, purchaseOrders, systemSettings.stockMinimums],
  );
  const values = (key: 'specialty' | 'manufacturer' | 'state') =>
    [...new Set(stock.map(t => String(t[key] || '')).filter(Boolean))].sort();
  const filtered = stock.filter(
    t =>
      (!specialty || t.specialty === specialty) &&
      (!manufacturer || t.manufacturer === manufacturer) &&
      matchesUsage(usage, [t], systemSettings.usageWarningThreshold) &&
      (!state || t.state === state) &&
      `${t.name} ${t.code} ${t.barcode} ${t.serialNumber || ''} ${t.manufacturer} ${t.specialty}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  const rows = useProgressiveList(filtered, [q, specialty, manufacturer, state, usage].join('|'));
  // The same number cards as the other lists: each one filters the list, the last opens the minimums.
  const kpi = kpiFilters({
    q: [q, setQ],
    specialty: [specialty, setSpecialty],
    manufacturer: [manufacturer, setManufacturer],
    state: [state, setState],
    usage: [usage, setUsage],
  });
  // A filter card shows the list (from the minimums view too); the minimums view lights its own card.
  const listKpi = (preset?: Record<string, string>) => {
    const filter = kpi(preset);
    return {
      onClick: () => {
        filter.onClick();
        if (view === 'MIN') setParams({}, {replace: true});
      },
      active: view === 'LIST' && filter.active,
    };
  };
  const stockKinds = new Set(stock.map(t => `${t.code}|${t.name}`)).size;
  return (
    <div className="tools-list-workspace">
      <PageHeader
        eyebrow={tr('ΜΗΤΡΩΟ ΕΞΟΠΛΙΣΜΟΥ')}
        title={tr('Απόθεμα εργαλείων')}
        description={tr('Διαθέσιμα φυσικά εργαλεία για αντικατάσταση, σύνθεση Σετ ή αυτόνομη διάθεση.')}
        actions={
          <div className="actions asset-page-actions">
            {can('asset.create') && (
              <AppButton variant="primary" icon={<Plus size={16} />} onClick={() => navigate('/tools/new')}>
                {tr('Νέο Εργαλείο')}
              </AppButton>
            )}
          </div>
        }
      />
      {/* The numbers first, for both views; then the tabs right above what they switch. */}
      <KpiStrip
        compact
        items={[
          {label: tr('Εργαλεία Αποθέματος'), value: stock.length, ...listKpi()},
          {label: tr('Είδη εργαλείων'), value: stockKinds},
          {
            label: tr('Με όριο χρήσεων'),
            value: stock.filter(t => !!t.maxUses).length,
            ...listKpi({usage: 'LIMITED'}),
          },
          {
            label: tr('Κάτω από το ελάχιστο'),
            value: lowCount,
            onClick: () => setParams({view: 'minimums'}, {replace: true}),
            active: view === 'MIN',
          },
        ]}
      />
      <div className="name-check-tabs stock-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={view === 'LIST'}
          className={view === 'LIST' ? 'active' : ''}
          onClick={() => setParams({}, {replace: true})}
        >
          <Boxes size={16} /> {tr('Εργαλεία Αποθέματος')} <b>{stock.length}</b>
        </button>
        <button
          role="tab"
          aria-selected={view === 'MIN'}
          className={view === 'MIN' ? 'active' : ''}
          onClick={() => setParams({view: 'minimums'}, {replace: true})}
        >
          <Gauge size={16} /> {tr('Ελάχιστα αποθέματα')} {lowCount > 0 && <b className="warn">{lowCount}</b>}
        </button>
      </div>
      {view === 'MIN' ? (
        <StockMinimums />
      ) : (
        <>
          <AssetFilterBar
            query={q}
            onQueryChange={setQ}
            placeholder={tr('Ονομασία, κωδικός, barcode ή serial...')}
            filters={[
              {
                key: 'specialty',
                value: specialty,
                placeholder: tr('Όλες οι ειδικότητες'),
                options: values('specialty').map(value => ({value, label: trData(value)})),
                onChange: setSpecialty,
              },
              {
                key: 'manufacturer',
                value: manufacturer,
                placeholder: tr('Όλες οι εταιρείες'),
                options: values('manufacturer').map(value => ({value, label: value})),
                onChange: setManufacturer,
              },
              {
                key: 'state',
                value: state,
                placeholder: tr('Όλες οι καταστάσεις'),
                options: values('state').map(value => ({value, label: statusLabel(value)})),
                onChange: setState,
              },
              {
                key: 'usage',
                value: usage,
                placeholder: tr('Όλοι οι τύποι χρήσης'),
                options: usageFilterOptions(),
                onChange: setUsage,
              },
            ]}
          />
          <ScrollableListPanel withKpis ariaLabel={tr('Απόθεμα εργαλείων')}>
            {filtered.length === 0 ? (
              <ListEmpty
                total={stock.length}
                none={{
                  title: tr('Το Απόθεμα είναι άδειο'),
                  description: tr('Τα εργαλεία που δεν ανήκουν σε Σετ ή τμήμα εμφανίζονται εδώ.'),
                  actions: can('asset.create') ? (
                    <AppButton variant="primary" icon={<Plus size={16} />} onClick={() => navigate('/tools/new')}>
                      {tr('Νέο Εργαλείο')}
                    </AppButton>
                  ) : undefined,
                }}
                onClear={() => {
                  setQ('');
                  setSpecialty('');
                  setManufacturer('');
                  setState('');
                  setUsage('');
                }}
              />
            ) : (
              <table className="asset-registry-table registry-fixed">
                <thead>
                  <tr>
                    <th>{tr('Εργαλείο')}</th>
                    <th>Barcode</th>
                    <th>{tr('Ειδικότητα')}</th>
                    <th>{tr('Κατασκευαστής')}</th>
                    <th>{tr('Χρήσεις')}</th>
                    <th>{tr('Κατάσταση')}</th>
                    <th>
                      <span className="visually-hidden">{tr('Άνοιγμα')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.visible.map(t => (
                    <tr key={t.id}>
                      <td>
                        <div className="registry-asset-name">
                          <AssetTypeIcon kind="TOOL" maxUses={t.maxUses} framed size={15} />
                          <span>
                            <Link className="row-title-link" to={`/tools/${t.id}`}>
                              {t.name}
                            </Link>
                            <ColorMarker tapes={effectiveToolMarker(t)} size="sm" />
                            <small className="row-sub">{t.code}</small>
                          </span>
                        </div>
                      </td>
                      <td className="mono">{t.barcode}</td>
                      <td>{trData(t.specialty) || '—'}</td>
                      <td>{t.manufacturer || '—'}</td>
                      <td>{t.maxUses ? `${t.uses} / ${t.maxUses}` : '—'}</td>
                      <td>
                        <StatusBadge value={t.state} />
                      </td>
                      <td>
                        <Link className="icon-link" to={`/tools/${t.id}`} aria-label={tr('Άνοιγμα {0}', t.barcode)}>
                          <ChevronRight size={17} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {rows.hasMore && <MoreRows colSpan={7} onVisible={rows.showMore} />}
                </tbody>
              </table>
            )}
          </ScrollableListPanel>
        </>
      )}
    </div>
  );
}
