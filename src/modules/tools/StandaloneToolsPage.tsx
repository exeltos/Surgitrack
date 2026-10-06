import {ListEmpty} from '../../components/ui/EmptyState';
import {useMemo} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {ChevronRight, Layers3, List, Plus} from 'lucide-react';
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
import IconToggleButton from '../../components/ui/IconToggleButton';
import KpiStrip from '../../components/ui/KpiStrip';
import {tr, trData} from '../../i18n';
import {useRememberedState} from '../../core/listMemory';
import ColorMarker from '../../components/assets/ColorMarker';
import {effectiveToolMarker} from '../../core/colorTapes';

export default function StandaloneToolsPage() {
  const {tools, can} = useSurgi();
  const navigate = useNavigate();
  const standalone = tools.filter(t => t.mode === 'STANDALONE');
  const [q, setQ] = useRememberedState('q', '');
  const [grouped, setGrouped] = useRememberedState('grouped', false);
  const [department, setDepartment] = useRememberedState('department', '');
  const [specialty, setSpecialty] = useRememberedState('specialty', '');
  const [manufacturer, setManufacturer] = useRememberedState('manufacturer', '');
  const [state, setState] = useRememberedState('state', '');
  const [usage, setUsage] = useRememberedState('usage', '');
  const {systemSettings} = useLibraries();
  const values = (key: 'department' | 'specialty' | 'manufacturer' | 'state') =>
    [...new Set(standalone.map(t => String(t[key] || '')).filter(Boolean))].sort();
  const kpi = kpiFilters({
    q: [q, setQ],
    department: [department, setDepartment],
    specialty: [specialty, setSpecialty],
    manufacturer: [manufacturer, setManufacturer],
    state: [state, setState],
    usage: [usage, setUsage],
  });
  const filtered = standalone.filter(
    t =>
      (!department || t.department === department) &&
      (!specialty || t.specialty === specialty) &&
      (!manufacturer || t.manufacturer === manufacturer) &&
      matchesUsage(usage, [t], systemSettings.usageWarningThreshold) &&
      (!state || t.state === state) &&
      `${t.name} ${t.code} ${t.barcode} ${t.department || ''} ${t.manufacturer} ${t.specialty}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  const filterKey = [q, department, specialty, manufacturer, state, usage, grouped].join('|');
  const groups = useMemo(() => {
    const m = new Map<string, typeof tools>();
    filtered.forEach(t => {
      const k = `${t.code}|${t.name}|${t.manufacturer}`;
      m.set(k, [...(m.get(k) || []), t]);
    });
    return [...m.values()];
  }, [filtered]);
  const rows = useProgressiveList(filtered, filterKey);
  const groupRows = useProgressiveList(groups, filterKey, 'shownGroups');
  return (
    <div className="tools-list-workspace">
      <PageHeader
        eyebrow={tr('ΜΗΤΡΩΟ ΕΞΟΠΛΙΣΜΟΥ')}
        title={tr('Μεμονωμένα εργαλεία σε χρήση')}
        description={tr(
          'Μόνο φυσικά εργαλεία που χρησιμοποιούνται αυτόνομα σε τμήματα και δεν ανήκουν αυτή τη στιγμή σε Σετ.',
        )}
        actions={
          can('asset.create') ? (
            <AppButton variant="primary" icon={<Plus size={17} />} onClick={() => navigate('/tools/new')}>
              {tr('Νέο Εργαλείο')}
            </AppButton>
          ) : undefined
        }
      />
      <KpiStrip
        compact
        items={[
          {label: tr('Σε χρήση'), value: standalone.length, ...kpi()},
          {label: tr('Τμήματα'), value: new Set(standalone.map(t => t.department).filter(Boolean)).size},
          {
            label: tr('Πολλαπλών χρήσεων (με ζωές)'),
            value: standalone.filter(t => t.maxUses).length,
            ...kpi({usage: 'LIMITED'}),
          },
          {
            label: tr('Λίγες ζωές'),
            value: standalone.filter(t => matchesUsage('LOW', [t], systemSettings.usageWarningThreshold)).length,
            ...kpi({usage: 'LOW'}),
          },
        ]}
      />
      <div className="asset-list-controls">
        <AssetFilterBar
          query={q}
          onQueryChange={setQ}
          placeholder={tr('Ονομασία, κωδικός ή barcode...')}
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
        <IconToggleButton
          active={grouped}
          activeIcon={<List size={17} />}
          inactiveIcon={<Layers3 size={17} />}
          activeTitle={tr('Εμφάνιση φυσικών εγγραφών')}
          inactiveTitle={tr('Ομαδοποίηση ίδιων εργαλείων')}
          onClick={() => setGrouped(v => !v)}
        />
      </div>
      <ScrollableListPanel withKpis ariaLabel={tr('Μεμονωμένα εργαλεία σε χρήση')}>
        {filtered.length === 0 ? (
          <ListEmpty
            total={standalone.length}
            none={{
              title: tr('Δεν υπάρχουν μεμονωμένα εργαλεία σε χρήση'),
              description: tr('Τα εργαλεία που δίνονται σε τμήμα χωρίς Σετ εμφανίζονται εδώ.'),
            }}
            onClear={() => {
              setQ('');
              setDepartment('');
              setSpecialty('');
              setManufacturer('');
              setState('');
              setUsage('');
            }}
          />
        ) : (
          <table className="asset-registry-table">
            <thead>
              <tr>
                <th>{tr('Ονομασία')}</th>
                <th>{grouped ? tr('Ποσότητα') : tr('Κωδικός')}</th>
                <th>Barcode</th>
                <th>{tr('Εταιρεία')}</th>
                <th>{tr('Τμήμα')}</th>
                <th>{tr('Υπόλοιπο χρήσεων')}</th>
                <th>{tr('Κατάσταση')}</th>
                <th>
                  <span className="visually-hidden">{tr('Άνοιγμα')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {grouped
                ? groupRows.visible.map(g => {
                    const t = g[0];
                    return (
                      <tr key={`${t.code}-${t.name}`}>
                        <td>
                          <b>{t.name}</b>
                        </td>
                        <td>
                          <span className="qty-badge">{g.length}</span>
                        </td>
                        <td className="muted">{tr('πολλαπλά')}</td>
                        <td>{t.manufacturer || '—'}</td>
                        <td>{new Set(g.map(x => x.department)).size === 1 ? t.department : tr('Πολλά τμήματα')}</td>
                        <td>—</td>
                        <td className="muted">{tr('Μικτή')}</td>
                        <td>
                          <Link className="icon-link" to={`/tools/${t.id}`} aria-label={tr('Άνοιγμα {0}', t.barcode)}>
                            <ChevronRight size={17} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                : rows.visible.map(t => (
                    <tr key={t.id}>
                      <td>
                        <div className="registry-asset-name">
                          <AssetTypeIcon kind="TOOL" maxUses={t.maxUses} framed size={15} />
                          <span>
                            <Link className="row-title-link" to={`/tools/${t.id}`}>
                              {t.name}
                            </Link>
                            <ColorMarker tapes={effectiveToolMarker(t)} size="sm" />
                          </span>
                        </div>
                      </td>
                      <td className="cell-nowrap">{t.code}</td>
                      <td className="mono cell-nowrap">{t.barcode}</td>
                      <td>{t.manufacturer || '—'}</td>
                      <td>{trData(t.department) || '—'}</td>
                      <td>
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
                  ))}
              {(grouped ? groupRows.hasMore : rows.hasMore) && (
                <MoreRows colSpan={8} onVisible={grouped ? groupRows.showMore : rows.showMore} />
              )}
            </tbody>
          </table>
        )}
      </ScrollableListPanel>
    </div>
  );
}
