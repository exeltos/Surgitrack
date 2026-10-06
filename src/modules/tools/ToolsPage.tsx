import {ListEmpty} from '../../components/ui/EmptyState';
import {useMemo} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {Plus, ChevronRight, FileSpreadsheet, SpellCheck2} from 'lucide-react';
import {matchesUsage, usageFilterOptions} from '../../core/usageFilter';
import {useLibraries} from '../../core/LibraryStore';
import {kpiFilters} from '../../core/kpiFilters';
import {MoreRows} from '../../components/ui/ProgressiveList';
import {useProgressiveList} from '../../core/useProgressiveList';
import {statusLabel} from '../../components/ui/statusLabel';
import {useSurgi} from '../../store/SurgiStore';
import StatusBadge from '../../components/ui/StatusBadge';
import AssetTypeIcon from '../../components/assets/AssetTypeIcon';
import AssetFilterBar from '../../components/assets/AssetFilterBar';
import AppButton from '../../components/ui/AppButton';
import ScrollableListPanel from '../../components/ui/ScrollableListPanel';
import PageHeader from '../../components/ui/PageHeader';
import KpiStrip from '../../components/ui/KpiStrip';
import {tr, trData} from '../../i18n';
import {useRememberedState} from '../../core/listMemory';
import ColorMarker from '../../components/assets/ColorMarker';
import {effectiveToolMarker} from '../../core/colorTapes';

export default function ToolsPage() {
  const {tools, sets, can, organizationId} = useSurgi();
  const navigate = useNavigate();
  const [q, setQ] = useRememberedState('q', '');
  const [department, setDepartment] = useRememberedState('department', '');
  const [specialty, setSpecialty] = useRememberedState('specialty', '');
  const [manufacturer, setManufacturer] = useRememberedState('manufacturer', '');
  const [state, setState] = useRememberedState('state', '');
  const [usage, setUsage] = useRememberedState('usage', '');
  const {systemSettings} = useLibraries();
  const [mode, setMode] = useRememberedState('mode', '');
  const kpi = kpiFilters({
    q: [q, setQ],
    department: [department, setDepartment],
    specialty: [specialty, setSpecialty],
    manufacturer: [manufacturer, setManufacturer],
    state: [state, setState],
    mode: [mode, setMode],
    usage: [usage, setUsage],
  });
  const filtered = tools.filter(
    t =>
      (!department || t.department === department) &&
      (!specialty || t.specialty === specialty) &&
      (!manufacturer || t.manufacturer === manufacturer) &&
      matchesUsage(usage, [t], systemSettings.usageWarningThreshold) &&
      (!state || t.state === state) &&
      (!mode || t.mode === mode) &&
      `${t.barcode} ${t.name} ${t.code} ${t.serialNumber || ''} ${t.manufacturer} ${t.specialty} ${t.department || ''} ${t.ownerName || ''}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  const values = (key: 'department' | 'specialty' | 'manufacturer' | 'state' | 'mode') =>
    [...new Set(tools.map(t => String(t[key] || '')).filter(Boolean))].sort();
  const setsById = useMemo(() => new Map(sets.map(s => [s.id, s])), [sets]);
  const filterKey = [q, department, specialty, manufacturer, state, mode, usage].join('|');
  const rows = useProgressiveList(filtered, filterKey);
  return (
    <div className="tools-list-workspace">
      <PageHeader
        title={tr('Εργαλεία')}
        description={tr('Όλα τα φυσικά εργαλεία: σε απόθεμα, σε σετ ή μεμονωμένα.')}
        actions={
          can('asset.create') ? (
            <div className="page-head-actions">
              {can('asset.edit') && (
                <AppButton icon={<SpellCheck2 size={17} />} onClick={() => navigate('/tools/names')}>
                  {tr('Έλεγχος ονομασιών')}
                </AppButton>
              )}
              {organizationId && (
                <AppButton icon={<FileSpreadsheet size={17} />} onClick={() => navigate('/import')}>
                  {tr('Μαζική εισαγωγή')}
                </AppButton>
              )}
              <AppButton variant="primary" icon={<Plus size={17} />} onClick={() => navigate('/tools/new')}>
                {tr('Νέο Εργαλείο')}
              </AppButton>
            </div>
          ) : undefined
        }
      />
      <KpiStrip
        compact
        items={[
          {label: tr('Σύνολο εργαλείων'), value: tools.length, ...kpi()},
          {label: tr('Σε Σετ'), value: tools.filter(t => t.mode === 'SET_MEMBER').length, ...kpi({mode: 'SET_MEMBER'})},
          {
            label: tr('Μεμονωμένα σε χρήση'),
            value: tools.filter(t => t.mode === 'STANDALONE').length,
            ...kpi({mode: 'STANDALONE'}),
          },
          {label: tr('Απόθεμα'), value: tools.filter(t => t.mode === 'STOCK').length, ...kpi({mode: 'STOCK'})},
        ]}
      />
      <div className="asset-list-controls">
        <AssetFilterBar
          query={q}
          onQueryChange={setQ}
          placeholder={tr('Ονομασία, κωδικός, barcode, serial...')}
          filters={[
            {
              key: 'department',
              value: department,
              placeholder: tr('Όλα τα τμήματα'),
              options: values('department').map(value => ({value, label: trData(value)})),
              onChange: setDepartment,
            },
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
              key: 'mode',
              value: mode,
              placeholder: tr('Όλες οι θέσεις'),
              options: [
                {value: 'STOCK', label: tr('Απόθεμα')},
                {value: 'SET_MEMBER', label: tr('Σετ εργαλείων')},
                {value: 'STANDALONE', label: tr('Μεμονωμένα σε χρήση')},
              ],
              onChange: setMode,
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
      </div>
      <ScrollableListPanel withKpis ariaLabel={tr('Λίστα εργαλείων')}>
        {filtered.length === 0 ? (
          <ListEmpty
            total={tools.length}
            none={{
              title: tr('Δεν υπάρχουν εργαλεία ακόμα'),
              description: tr('Πρόσθεσε το πρώτο εργαλείο ή φόρτωσε όλο το μητρώο σου από ένα αρχείο Excel.'),
              actions: can('asset.create') ? (
                <>
                  <AppButton variant="primary" icon={<Plus size={17} />} onClick={() => navigate('/tools/new')}>
                    {tr('Νέο Εργαλείο')}
                  </AppButton>
                  {organizationId && (
                    <AppButton icon={<FileSpreadsheet size={17} />} onClick={() => navigate('/import')}>
                      {tr('Μαζική εισαγωγή')}
                    </AppButton>
                  )}
                </>
              ) : undefined,
            }}
            onClear={() => {
              setQ('');
              setDepartment('');
              setSpecialty('');
              setManufacturer('');
              setState('');
              setMode('');
              setUsage('');
            }}
          />
        ) : (
          <table className="asset-registry-table registry-fixed">
            <thead>
              <tr>
                <th>{tr('Ονομασία')}</th>
                <th>Barcode</th>
                <th>{tr('Ειδικότητα')}</th>
                <th>{tr('Θέση')}</th>
                <th>{tr('Χρήσεις')}</th>
                <th>{tr('Κατάσταση')}</th>
                <th>
                  <span className="visually-hidden">{tr('Άνοιγμα')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.visible.map(t => {
                const set = t.setId ? setsById.get(t.setId) : undefined;
                return (
                  <tr key={t.id}>
                    <td>
                      <div className="registry-asset-name">
                        <AssetTypeIcon kind="TOOL" maxUses={t.maxUses} framed size={15} />
                        <span>
                          <Link className="row-title-link" to={`/tools/${t.id}`}>
                            {t.name}
                          </Link>
                          <ColorMarker tapes={effectiveToolMarker(t, set)} size="sm" />
                          <small className="row-sub">
                            {[t.manufacturer, t.code, t.serialNumber && `S/N ${t.serialNumber}`]
                              .filter(Boolean)
                              .join(' · ')}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <Link className="mono strong-link" to={`/tools/${t.id}`}>
                        {t.barcode}
                      </Link>
                    </td>
                    <td className="cell-nowrap">{trData(t.specialty) || '—'}</td>
                    <td>
                      {t.mode === 'SET_MEMBER' && set ? (
                        <>
                          <b>{tr('Σετ')}</b>
                          <small className="row-sub">
                            {set.barcode} · {set.name}
                          </small>
                        </>
                      ) : t.mode === 'STOCK' ? (
                        <b>{tr('Απόθεμα')}</b>
                      ) : (
                        <>
                          <b>{tr('Μεμονωμένο')}</b>
                          <small className="row-sub">{trData(t.department) || '—'}</small>
                        </>
                      )}
                    </td>
                    <td className="cell-nowrap">
                      {t.maxUses ? (
                        <>
                          <b>{Math.max(0, t.maxUses - t.uses)}</b>
                          <span className="muted"> / {t.maxUses}</span>
                        </>
                      ) : (
                        <span className="muted">{tr('Χωρίς όριο')}</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge value={t.state} />
                    </td>
                    <td>
                      <Link className="icon-link" to={`/tools/${t.id}`} aria-label={tr('Άνοιγμα {0}', t.barcode)}>
                        <ChevronRight size={17} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {rows.hasMore && <MoreRows colSpan={5} onVisible={rows.showMore} />}
            </tbody>
          </table>
        )}
      </ScrollableListPanel>
    </div>
  );
}
