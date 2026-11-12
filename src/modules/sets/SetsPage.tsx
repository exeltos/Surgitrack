import {useBrowseList} from '../../core/browseList';
import {STERILE_STATES, expiryStatus, formatExpiry} from '../../core/sterileExpiry';
import {ListEmpty} from '../../components/ui/EmptyState';
import {useMemo} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {Plus, ChevronRight, FileSpreadsheet} from 'lucide-react';
import {limitFilterOptions, matchesUsage, usageFilterOptions} from '../../core/usageFilter';
import ListExport from '../../components/ui/ListExport';
import {setsExportTable} from '../../core/assetExport';
import {useLibraries} from '../../core/LibraryStore';
import {MoreRows} from '../../components/ui/ProgressiveList';
import {useProgressiveList} from '../../core/useProgressiveList';
import {SortTh} from '../../components/ui/SortHeader';
import {useTableSort} from '../../components/ui/useTableSort';
import {useSurgi} from '../../store/SurgiStore';
import StatusBadge from '../../components/ui/StatusBadge';
import AssetTypeIcon from '../../components/assets/AssetTypeIcon';
import AssetFilterBar from '../../components/assets/AssetFilterBar';
import AppButton from '../../components/ui/AppButton';
import ScrollableListPanel from '../../components/ui/ScrollableListPanel';
import {statusLabel} from '../../components/ui/statusLabel';
import PageHeader from '../../components/ui/PageHeader';
import QuickFilters from '../../components/ui/QuickFilters';
import {kpiFilters} from '../../core/kpiFilters';
import {tr, trData} from '../../i18n';
import {useRememberedState} from '../../core/listMemory';
import ColorMarker from '../../components/assets/ColorMarker';
export default function SetsPage() {
  const {sets, tools, can, organizationId} = useSurgi();
  const navigate = useNavigate();
  const [q, setQ] = useRememberedState('q', '');
  const [department, setDepartment] = useRememberedState('department', '');
  const [specialty, setSpecialty] = useRememberedState('specialty', '');
  const [manufacturer, setManufacturer] = useRememberedState('manufacturer', '');
  const [state, setState] = useRememberedState('state', '');
  const [limit, setLimit] = useRememberedState('limit', '');
  const [usage, setUsage] = useRememberedState('usage', '');
  const [completeness, setCompleteness] = useRememberedState('completeness', '');
  // Limited-use instruments per Set, for the usage filter.
  const limitedBySet = useMemo(() => {
    const map = new Map<string, typeof tools>();
    tools.forEach(t => {
      if (!t.setId || !t.maxUses) return;
      const list = map.get(t.setId);
      if (list) list.push(t);
      else map.set(t.setId, [t]);
    });
    return map;
  }, [tools]);
  const {systemSettings} = useLibraries();
  const values = (key: 'department' | 'specialty' | 'manufacturer' | 'state') =>
    [...new Set(sets.map(s => String(s[key] || '')).filter(Boolean))].sort();
  const kpi = kpiFilters({
    q: [q, setQ],
    department: [department, setDepartment],
    specialty: [specialty, setSpecialty],
    manufacturer: [manufacturer, setManufacturer],
    state: [state, setState],
    limit: [limit, setLimit],
    usage: [usage, setUsage],
    completeness: [completeness, setCompleteness],
  });
  const filtered = sets.filter(
    s =>
      (!department || s.department === department) &&
      (!specialty || s.specialty === specialty) &&
      (!manufacturer || s.manufacturer === manufacturer) &&
      matchesUsage(limit, [s, ...(limitedBySet.get(s.id) || [])], systemSettings.usageWarningThreshold) &&
      matchesUsage(usage, [s, ...(limitedBySet.get(s.id) || [])], systemSettings.usageWarningThreshold) &&
      (!state || s.state === state) &&
      (!completeness || (completeness === 'SHORT' ? s.actual < s.expected : s.actual >= s.expected)) &&
      `${s.barcode} ${s.name} ${s.code} ${s.manufacturer || ''} ${s.specialty} ${s.department} ${s.ownerName || ''}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  // Instruments per Set, counted once instead of per row.
  const memberCount = useMemo(() => {
    const map = new Map<string, number>();
    tools.forEach(t => t.setId && map.set(t.setId, (map.get(t.setId) || 0) + 1));
    return map;
  }, [tools]);
  const order = useTableSort(filtered, {
    name: s => s.name,
    barcode: s => s.barcode,
    specialty: s => trData(s.specialty),
    department: s => (s.state === 'IN_STOCK' ? tr('Απόθεμα Σετ') : trData(s.department)),
    count: s => memberCount.get(s.id) || 0,
    state: s => statusLabel(s.state),
    expiry: s =>
      s.sterileUntil && (STERILE_STATES as readonly string[]).includes(s.state) ? s.sterileUntil : undefined,
  });
  useBrowseList('/sets', order.rows);
  const rows = useProgressiveList(
    order.rows,
    [q, department, specialty, manufacturer, state, limit, usage, completeness, order.sort?.key, order.sort?.dir].join(
      '|',
    ),
  );
  return (
    <div className="tools-list-workspace">
      <PageHeader
        eyebrow={tr('ΜΗΤΡΩΟ ΕΞΟΠΛΙΣΜΟΥ')}
        title={tr('Σετ εργαλείων')}
        description={tr('Όλα τα Σετ του νοσοκομείου: πού βρίσκονται, τι τους λείπει, πότε λήγουν.')}
        actions={
          can('asset.create') ? (
            <div className="page-head-actions">
              {organizationId && (
                <AppButton icon={<FileSpreadsheet size={17} />} onClick={() => navigate('/import')}>
                  {tr('Μαζική εισαγωγή')}
                </AppButton>
              )}
              <AppButton variant="primary" icon={<Plus size={17} />} onClick={() => navigate('/sets/new')}>
                {tr('Νέο Σετ')}
              </AppButton>
            </div>
          ) : undefined
        }
      />
      <AssetFilterBar
        query={q}
        onQueryChange={setQ}
        placeholder={tr('Όνομα Σετ, κωδικός ή barcode...')}
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
            key: 'limit',
            value: limit,
            placeholder: tr('Με ή χωρίς όριο'),
            options: limitFilterOptions(),
            onChange: setLimit,
          },
          {
            key: 'usage',
            value: usage,
            placeholder: tr('Όλοι οι τύποι χρήσης'),
            options: usageFilterOptions(),
            onChange: setUsage,
          },
          {
            key: 'completeness',
            value: completeness,
            placeholder: tr('Όλα τα Σετ'),
            options: [
              {value: 'COMPLETE', label: tr('Πλήρη')},
              {value: 'SHORT', label: tr('Με έλλειψη')},
            ],
            onChange: setCompleteness,
          },
        ]}
        className="with-quick-filters"
        extra={
          <>
            <QuickFilters
              items={[
                {label: tr('Όλα'), count: sets.length, ...kpi()},
                {
                  label: tr('Στο τμήμα'),
                  count: sets.filter(x => x.state === 'IN_DEPARTMENT').length,
                  ...kpi({state: 'IN_DEPARTMENT'}),
                },
                {
                  label: tr('Έτοιμα για παραλαβή'),
                  count: sets.filter(x => x.state === 'READY_FOR_PICKUP').length,
                  ...kpi({state: 'READY_FOR_PICKUP'}),
                },
                {
                  label: tr('Με έλλειψη'),
                  tone: 'bad' as const,
                  count: sets.filter(x => x.actual < x.expected).length,
                  ...kpi({completeness: 'SHORT'}),
                },
              ]}
            />
            <ListExport
              table={() => setsExportTable(filtered, memberCount, tr('Σετ εργαλείων'))}
              disabled={filtered.length === 0}
            />
          </>
        }
      />
      <ScrollableListPanel ariaLabel={tr('Λίστα Σετ εργαλείων')}>
        {filtered.length === 0 ? (
          <ListEmpty
            total={sets.length}
            none={{
              title: tr('Δεν υπάρχουν Σετ ακόμα'),
              description: tr('Δημιούργησε το πρώτο Σετ εργαλείων ή φόρτωσε τα Σετ σου από ένα αρχείο Excel.'),
              actions: can('asset.create') ? (
                <>
                  <AppButton variant="primary" icon={<Plus size={17} />} onClick={() => navigate('/sets/new')}>
                    {tr('Νέο Σετ')}
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
              setLimit('');
              setUsage('');
              setCompleteness('');
            }}
          />
        ) : (
          <table className="asset-registry-table registry-fixed sets-registry">
            <thead>
              <tr>
                <SortTh label={tr('Όνομα Σετ')} sortKey="name" sort={order.sort} onSort={order.toggle} />
                <SortTh label="Barcode" sortKey="barcode" sort={order.sort} onSort={order.toggle} />
                <SortTh label={tr('Ειδικότητα')} sortKey="specialty" sort={order.sort} onSort={order.toggle} />
                <SortTh label={tr('Τμήμα')} sortKey="department" sort={order.sort} onSort={order.toggle} />
                <SortTh label={tr('Εργαλεία')} sortKey="count" sort={order.sort} onSort={order.toggle} />
                <SortTh label={tr('Κατάσταση')} sortKey="state" sort={order.sort} onSort={order.toggle} />
                <SortTh label={tr('Λήξη')} sortKey="expiry" sort={order.sort} onSort={order.toggle} />
                <th>
                  <span className="visually-hidden">{tr('Άνοιγμα')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.visible.map(s => {
                const count = memberCount.get(s.id) || 0;
                return (
                  <tr key={s.id}>
                    <td>
                      <div className="registry-asset-name">
                        <AssetTypeIcon kind="SET" framed size={15} />
                        <span>
                          <Link className="row-title-link" to={`/sets/${s.id}`}>
                            {s.name}
                          </Link>
                          <ColorMarker tapes={s.colorTapes} size="sm" />
                          <small className="row-sub">
                            <span className="mono registry-row-barcode">{s.barcode}</span>
                            {[s.manufacturer, s.code].filter(Boolean).map(part => ` · ${part}`)}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <Link className="mono strong-link" to={`/sets/${s.id}`}>
                        {s.barcode}
                      </Link>
                    </td>
                    <td>{trData(s.specialty) || '—'}</td>
                    <td>
                      {s.state === 'IN_STOCK' ? (
                        <span className="asset-field-na">{tr('Απόθεμα Σετ')}</span>
                      ) : (
                        trData(s.department) || '—'
                      )}
                    </td>
                    <td className={count < s.expected ? 'set-count-short' : undefined}>
                      <b>{count}</b>
                      <span className="muted"> / {s.expected}</span>
                    </td>
                    <td>
                      <StatusBadge value={s.state} />
                    </td>
                    <td>
                      {(() => {
                        // The expiry date while the Set is sterile; coloured when it is near or past.
                        if (!s.sterileUntil || !(STERILE_STATES as readonly string[]).includes(s.state)) return '—';
                        const status = expiryStatus(s.sterileUntil, s.shelfLifeMonths);
                        return (
                          <span className={`sets-expiry ${status.state.toLowerCase()}`}>
                            {formatExpiry(s.sterileUntil)}
                          </span>
                        );
                      })()}
                    </td>
                    <td>
                      <Link className="icon-link" to={`/sets/${s.id}`} aria-label={tr('Άνοιγμα {0}', s.barcode)}>
                        <ChevronRight size={17} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {rows.hasMore && <MoreRows colSpan={8} onVisible={rows.showMore} />}
            </tbody>
          </table>
        )}
      </ScrollableListPanel>
    </div>
  );
}
