import {ListEmpty} from '../../components/ui/EmptyState';
import {useBrowseList} from '../../core/browseList';
import {Fragment, useMemo, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {ChevronDown, ChevronRight, Layers3, Plus} from 'lucide-react';
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
import {STERILE_STATES, expiryStatus, formatExpiry} from '../../core/sterileExpiry';
import type {Tool} from '../../types/domain';

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
  const groupKey = (t: Tool) => `${t.code}|${t.name}|${t.manufacturer}`;
  const groups = useMemo(() => {
    const m = new Map<string, Tool[]>();
    filtered.forEach(t => {
      const k = groupKey(t);
      const list = m.get(k);
      if (list) list.push(t);
      else m.set(k, [t]);
    });
    return [...m.values()];
  }, [filtered]);
  // Groups opened in place to show their pieces.
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());
  const toggleGroup = (key: string) =>
    setOpenGroups(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  useBrowseList('/tools', filtered);
  const rows = useProgressiveList(filtered, filterKey);
  const groupRows = useProgressiveList(groups, filterKey, 'shownGroups');
  // The expiry date while the instrument is sterile, coloured when it is near or past.
  const expiryOf = (t: Tool) =>
    t.sterileUntil && (STERILE_STATES as readonly string[]).includes(t.state)
      ? {until: t.sterileUntil, status: expiryStatus(t.sterileUntil, t.shelfLifeMonths)}
      : undefined;
  const expiryCell = (entry: ReturnType<typeof expiryOf>) =>
    entry ? (
      <span className={`sets-expiry ${entry.status.state.toLowerCase()}`}>{formatExpiry(entry.until)}</span>
    ) : (
      '—'
    );
  const pieceRow = (t: Tool, nested = false) => (
    <tr key={t.id} className={nested ? 'standalone-piece' : undefined}>
      <td>
        <div className="registry-asset-name">
          <AssetTypeIcon kind="TOOL" maxUses={t.maxUses} framed size={15} />
          <span>
            <Link className="row-title-link" to={`/tools/${t.id}`}>
              {t.name}
            </Link>
            <ColorMarker tapes={effectiveToolMarker(t)} size="sm" />
            <small className="row-sub">{[t.manufacturer, t.code].filter(Boolean).join(' · ')}</small>
            {/* On a tablet the barcode sits here, so the name keeps the room of its column. */}
            <small className="row-sub mono sets-row-barcode">{t.barcode}</small>
          </span>
        </div>
      </td>
      <td>
        <Link className="mono strong-link" to={`/tools/${t.id}`}>
          {t.barcode}
        </Link>
      </td>
      <td>{trData(t.specialty) || '—'}</td>
      <td>{trData(t.department) || '—'}</td>
      <td>
        {t.maxUses ? (
          <>
            <b>{t.uses}</b>
            <span className="muted"> / {t.maxUses}</span>
          </>
        ) : (
          <span className="muted">{tr('Χωρίς όριο')}</span>
        )}
      </td>
      <td>
        <StatusBadge value={t.state} />
      </td>
      <td data-label={tr('Λήξη')}>{expiryCell(expiryOf(t))}</td>
      <td>
        <Link className="icon-link" to={`/tools/${t.id}`} aria-label={tr('Άνοιγμα {0}', t.barcode)}>
          <ChevronRight size={17} />
        </Link>
      </td>
    </tr>
  );
  return (
    <div className="tools-list-workspace">
      <PageHeader
        eyebrow={tr('ΜΗΤΡΩΟ ΕΞΟΠΛΙΣΜΟΥ')}
        title={tr('Μεμονωμένα εργαλεία σε χρήση')}
        description={tr('Εργαλεία που χρησιμοποιούνται αυτόνομα σε τμήματα, εκτός Σετ.')}
        actions={
          can('asset.create') ? (
            <AppButton
              variant="primary"
              icon={<Plus size={17} />}
              onClick={() => navigate('/tools/new?for=standalone')}
            >
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
            label: tr('Με όριο χρήσεων'),
            value: standalone.filter(t => t.maxUses).length,
            ...kpi({usage: 'LIMITED'}),
          },
          {
            label: tr('Λίγες χρήσεις'),
            value: standalone.filter(t => matchesUsage('LOW', [t], systemSettings.usageWarningThreshold)).length,
            ...kpi({usage: 'LOW'}),
          },
        ]}
      />
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
        extra={
          <button
            type="button"
            className={`asset-filter-toggle ${grouped ? 'has-active' : ''}`}
            onClick={() => setGrouped(v => !v)}
            aria-pressed={grouped}
            title={tr('Ομαδοποίηση ίδιων εργαλείων')}
          >
            <Layers3 size={15} />
            <span>{tr('Ομαδοποίηση')}</span>
          </button>
        }
      />
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
          <table className="asset-registry-table registry-fixed sets-registry standalone-registry">
            <thead>
              <tr>
                <th>{tr('Ονομασία')}</th>
                <th>Barcode</th>
                <th>{tr('Ειδικότητα')}</th>
                <th>{tr('Τμήμα')}</th>
                <th>{tr('Χρήσεις')}</th>
                <th>{tr('Κατάσταση')}</th>
                <th>{tr('Λήξη')}</th>
                <th>
                  <span className="visually-hidden">{tr('Άνοιγμα')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {grouped
                ? groupRows.visible.map(g => {
                    const t = g[0];
                    const key = groupKey(t);
                    const open = openGroups.has(key);
                    const departments = [...new Set(g.map(x => x.department).filter(Boolean))] as string[];
                    const states = [...new Set(g.map(x => x.state))];
                    const used = g.map(x => x.uses);
                    const sameLimit = t.maxUses && g.every(x => x.maxUses === t.maxUses);
                    const earliest = g
                      .map(expiryOf)
                      .filter((x): x is NonNullable<ReturnType<typeof expiryOf>> => !!x)
                      .sort((a, b) => a.until.localeCompare(b.until))[0];
                    return (
                      <Fragment key={key}>
                        <tr className={open ? 'standalone-group open' : 'standalone-group'}>
                          <td>
                            <div className="registry-asset-name">
                              <AssetTypeIcon kind="TOOL" maxUses={t.maxUses} framed size={15} />
                              <span>
                                <button type="button" className="row-title-link" onClick={() => toggleGroup(key)}>
                                  {t.name}
                                </button>
                                <small className="row-sub">
                                  {[t.manufacturer, t.code].filter(Boolean).join(' · ')}
                                </small>
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className="qty-badge">{tr('{0} τεμ.', g.length)}</span>
                          </td>
                          <td>{trData(t.specialty) || '—'}</td>
                          <td title={departments.map(d => trData(d)).join(', ')}>
                            {departments.length === 1 ? trData(departments[0]) : tr('{0} τμήματα', departments.length)}
                          </td>
                          <td>
                            {sameLimit ? (
                              <>
                                <b>
                                  {Math.min(...used) === Math.max(...used)
                                    ? used[0]
                                    : `${Math.min(...used)}–${Math.max(...used)}`}
                                </b>
                                <span className="muted"> / {t.maxUses}</span>
                              </>
                            ) : t.maxUses ? (
                              '—'
                            ) : (
                              <span className="muted">{tr('Χωρίς όριο')}</span>
                            )}
                          </td>
                          <td>
                            {states.length === 1 ? (
                              <StatusBadge value={states[0]} />
                            ) : (
                              <small className="standalone-states">
                                {states
                                  .map(st => `${g.filter(x => x.state === st).length} ${statusLabel(st)}`)
                                  .join(' · ')}
                              </small>
                            )}
                          </td>
                          <td data-label={tr('Λήξη')}>{expiryCell(earliest)}</td>
                          <td>
                            <button
                              type="button"
                              className="icon-link"
                              onClick={() => toggleGroup(key)}
                              aria-expanded={open}
                              aria-label={open ? tr('Απόκρυψη τεμαχίων') : tr('Εμφάνιση τεμαχίων')}
                            >
                              {open ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                            </button>
                          </td>
                        </tr>
                        {open && g.map(x => pieceRow(x, true))}
                      </Fragment>
                    );
                  })
                : rows.visible.map(t => pieceRow(t))}
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
