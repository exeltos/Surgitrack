import {ListEmpty} from '../../components/ui/EmptyState';
import {Plus, ChevronRight, Boxes, Gauge} from 'lucide-react';
import {useMemo} from 'react';
import {Link, useNavigate, useSearchParams} from 'react-router-dom';
import {matchesUsage, usageFilterOptions} from '../../core/usageFilter';
import {useLibraries} from '../../core/LibraryStore';
import {kpiFilters} from '../../core/kpiFilters';
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
import {tr, trData} from '../../i18n';
import {presetPath, useRememberedState} from '../../core/listMemory';
import ColorMarker from '../../components/assets/ColorMarker';
import {effectiveToolMarker} from '../../core/colorTapes';

export default function StockPage() {
  const {tools, retiredTools, sets, can, purchaseOrders} = useSurgi();
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
  const kpi = kpiFilters({
    q: [q, setQ],
    specialty: [specialty, setSpecialty],
    manufacturer: [manufacturer, setManufacturer],
    state: [state, setState],
    usage: [usage, setUsage],
  });
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
          <KpiStrip
            items={[
              {label: tr('Διαθέσιμα'), value: stock.length, ...kpi()},
              {
                label: tr('Πολλαπλών χρήσεων (με ζωές)'),
                value: stock.filter(t => t.maxUses).length,
                ...kpi({usage: 'LIMITED'}),
              },
              {
                label: tr('Σετ με έλλειψη'),
                value: sets.filter(s => s.actual < s.expected).length,
                to: presetPath('/sets', {completeness: 'SHORT'}),
              },
            ]}
          />
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
                            <strong className="row-title-link" title={t.name}>
                              {t.name}
                            </strong>
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
                  {rows.hasMore && <MoreRows colSpan={5} onVisible={rows.showMore} />}
                </tbody>
              </table>
            )}
          </ScrollableListPanel>
        </>
      )}
    </div>
  );
}
