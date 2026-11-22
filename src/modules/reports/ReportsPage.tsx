import {Fragment, useEffect, useMemo, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {useFitWidth} from '../../components/ui/useFitWidth';
import {AlertTriangle, FileText, Printer} from 'lucide-react';
import PrintPreviewModal from '../../components/assets/PrintPreviewModal';
import {type SelectFilter} from '../../components/assets/FilterMenu';
import QuickFilters from '../../components/ui/QuickFilters';
import AssetFilterBar from '../../components/assets/AssetFilterBar';
import type {ExportTable} from '../../core/exportTable';
import DownloadMenu from '../../components/ui/DownloadMenu';
import {useSurgi} from '../../store/SurgiStore';
import {useLibraries} from '../../core/LibraryStore';
import {MoreRows} from '../../components/ui/ProgressiveList';
import {useProgressiveList} from '../../core/useProgressiveList';
import {SortTh} from '../../components/ui/SortHeader';
import {useTableSort} from '../../components/ui/useTableSort';
import {displaySortValue} from '../../core/tableSort';
import {tr, trData} from '../../i18n';
import HistoryWindowNote from '../../components/ui/HistoryWindowNote';
import StatusBadge from '../../components/ui/StatusBadge';
import {
  LOAD_STATUS,
  cellText,
  genericReportHtml,
  reports,
  stateLabel,
  type InventoryGroup,
  type ReportId,
  type Row,
} from './reportsMeta';
import {buildReport} from './buildReport';
import {handoverKey, handoverSlipHtml, type HandoverKind} from '../sterilization/printHandover';
import {parseDisplayDate} from '../../core/displayDate';

/** The reports of things that happened on a day, and the column with that day: they can be cut to a period. */
const DATE_OF: Partial<Record<ReportId, string>> = {issues: 'created', loads: 'loaded', handovers: 'at'};
/** A day as the date fields hold it (YYYY-MM-DD), for comparing. */
const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const showDay = (key: string) => key.split('-').reverse().join('/');
import {reportSummary} from './reportSummary';
import LoadCell from './loadCells';

export default function ReportsPage() {
  const {sets, tools, retiredTools, issues, processLoads, sterilizationReleases, receipts, deliveries} = useSurgi();
  const warningThreshold = useLibraries().systemSettings.usageWarningThreshold;
  // The report open is in the address (?report=…): «Πίσω» returns to the one before, and a link opens it.
  const [params, setParams] = useSearchParams();
  const active: ReportId = reports.some(r => r.id === params.get('report'))
    ? (params.get('report') as ReportId)
    : 'inventory';
  const setActive = (id: ReportId) => {
    if (id !== active) setParams({report: id});
  };
  // The list opens when a card or a group is pressed: the report starts with its totals.
  const [view, setView] = useState<{label: string; test: (row: Row) => boolean} | null>(null);
  // «Πίσω» to another report: its list starts closed, as when its button is pressed.
  useEffect(() => setView(null), [active]);
  const [group, setGroup] = useState<InventoryGroup>('department');
  const [department, setDepartment] = useState('ALL');
  const [specialty, setSpecialty] = useState('ALL');
  const [assetKind, setAssetKind] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [issueStatus, setIssueStatus] = useState('ALL');
  const [issueType, setIssueType] = useState('ALL');
  const [usageFilter, setUsageFilter] = useState('ALL');
  const [loadStatus, setLoadStatus] = useState('ALL');
  const [sterilizerName, setSterilizerName] = useState('ALL');
  const [expiryState, setExpiryState] = useState('ALL');
  const [signature, setSignature] = useState('ALL');
  // The period (from, to), for the reports of things that happened on a day.
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // A word in any column of the report.
  const [query, setQuery] = useState('');
  const sterilizerNames = useMemo(
    () =>
      Array.from(new Set(processLoads.filter(l => l.kind === 'STERILIZATION').map(l => l.equipment))).sort((a, b) =>
        a.localeCompare(b, 'el'),
      ),
    [processLoads],
  );
  const [preview, setPreview] = useState<{title: string; html: string} | null>(null);

  const departments = useMemo(
    () =>
      Array.from(
        new Set([
          ...sets.map(x => x.department),
          ...[...tools, ...retiredTools].map(x => x.department).filter((value): value is string => Boolean(value)),
        ]),
      ).sort((a, b) => a.localeCompare(b, 'el')),
    [sets, tools, retiredTools],
  );
  const specialties = useMemo(
    () =>
      Array.from(
        new Set([...sets.map(x => x.specialty), ...tools.map(x => x.specialty), ...retiredTools.map(x => x.specialty)]),
      ).sort((a, b) => a.localeCompare(b, 'el')),
    [sets, tools, retiredTools],
  );
  const issueTypes = useMemo(
    () => Array.from(new Set(issues.map(x => x.type))).sort((a, b) => a.localeCompare(b, 'el')),
    [issues],
  );
  const activeMeta = reports.find(r => r.id === active)!;

  const built = useMemo(
    () =>
      buildReport(
        active,
        {
          sets,
          tools,
          retiredTools,
          issues,
          processLoads,
          sterilizationReleases,
          receipts,
          deliveries,
          warningThreshold,
        },
        {
          group,
          department,
          specialty,
          assetKind,
          status,
          issueStatus,
          issueType,
          usageFilter,
          loadStatus,
          sterilizerName,
          expiryState,
          signature,
        },
      ),
    [
      active,
      group,
      sets,
      tools,
      retiredTools,
      processLoads,
      sterilizationReleases,
      loadStatus,
      sterilizerName,
      expiryState,
      issues,
      department,
      specialty,
      assetKind,
      status,
      issueStatus,
      issueType,
      usageFilter,
      warningThreshold,
      receipts,
      deliveries,
      signature,
    ],
  );

  // The period cuts the dated reports to the days in it (a record without a readable day stays).
  const dateKey = DATE_OF[active];
  const reportData = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle && (!dateKey || (!dateFrom && !dateTo))) return built;
    return {
      ...built,
      rows: built.rows.filter(row => {
        if (needle && !built.columns.some(c => cellText(c.key, row[c.key]).toLowerCase().includes(needle)))
          return false;
        if (!dateKey || (!dateFrom && !dateTo)) return true;
        const at = parseDisplayDate(String(row[dateKey] ?? ''));
        if (!at) return true;
        const day = dayKey(at);
        return (!dateFrom || day >= dateFrom) && (!dateTo || day <= dateTo);
      }),
    };
  }, [built, dateKey, dateFrom, dateTo, query]);
  const period =
    dateKey && (dateFrom || dateTo)
      ? [dateFrom ? showDay(dateFrom) : '…', dateTo ? showDay(dateTo) : '…'].join(' – ')
      : '';
  const summary = reportSummary(active, reportData.rows, warningThreshold);
  // The whole report is listed until a card or a group narrows it.
  const viewRows = useMemo(() => (view ? reportData.rows.filter(view.test) : reportData.rows), [view, reportData.rows]);
  const buildPreview = () => {
    const subtitle =
      active === 'inventory'
        ? group === 'department'
          ? tr('Σετ και εργαλεία ανά τμήμα')
          : tr('Σετ και εργαλεία ανά ειδικότητα')
        : tr(activeMeta.description);
    return {
      title: tr(activeMeta.title),
      html: genericReportHtml(
        tr(activeMeta.title),
        period ? `${subtitle} · ${tr('Περίοδος')} ${period}` : subtitle,
        reportData.columns,
        reportData.rows,
      ),
    };
  };
  const openPreview = () => setPreview(buildPreview());
  // A handover's printed slip: every record of the same handover (one batch, one signature).
  const printSlip = (kind: HandoverKind, key: string) => {
    const records = (kind === 'RECEIPT' ? receipts : deliveries).filter(r => handoverKey(r) === key);
    if (records.length)
      setPreview({
        title: kind === 'RECEIPT' ? tr('Δελτίο παραλαβής') : tr('Δελτίο παράδοσης'),
        html: handoverSlipHtml(kind, records),
      });
  };
  // Filters of the chosen report, in one "Filters" button; "ALL" is the empty choice.
  const choice = (value: string, set: (value: string) => void) => ({
    value: value === 'ALL' ? '' : value,
    onChange: (next: string) => set(next || 'ALL'),
  });
  const byDepartment = active === 'inventory';
  const reportFilters: SelectFilter[] = [
    // The inventory is grouped by department (the default) or by specialty.
    ...(byDepartment
      ? [
          {
            key: 'group',
            placeholder: tr('Ομαδοποίηση ανά τμήμα'),
            options: [{value: 'specialty', label: tr('Ομαδοποίηση ανά ειδικότητα')}],
            value: group === 'specialty' ? 'specialty' : '',
            onChange: (next: string) => setGroup(next === 'specialty' ? 'specialty' : 'department'),
          },
        ]
      : []),
    ...(byDepartment || active === 'issues' || active === 'usage' || active === 'expiry' || active === 'handovers'
      ? [
          {
            key: 'department',
            placeholder: tr('Όλα τα τμήματα'),
            options: departments.map(x => ({value: x, label: x})),
            ...choice(department, setDepartment),
          },
        ]
      : []),
    ...(byDepartment
      ? [
          {
            key: 'specialty',
            placeholder: tr('Όλες οι ειδικότητες'),
            options: specialties.map(x => ({value: x, label: x})),
            ...choice(specialty, setSpecialty),
          },
        ]
      : []),
    ...(byDepartment || active === 'usage'
      ? [
          {
            key: 'kind',
            placeholder: tr('Σετ & εργαλεία'),
            options: [
              {value: 'SET', label: tr('Μόνο Σετ')},
              {value: 'TOOL', label: tr('Μόνο εργαλεία')},
            ],
            ...choice(assetKind, setAssetKind),
          },
        ]
      : []),
    ...(byDepartment
      ? [
          {
            key: 'status',
            placeholder: tr('Όλες οι καταστάσεις'),
            options: Object.entries(stateLabel)
              .filter(([k]) => k !== 'RETIRED')
              .map(([k, v]) => ({value: k, label: tr(v)})),
            ...choice(status, setStatus),
          },
        ]
      : []),
    ...(active === 'issues'
      ? [
          {
            key: 'issueType',
            placeholder: tr('Όλοι οι τύποι'),
            options: issueTypes.map(x => ({value: x, label: x})),
            ...choice(issueType, setIssueType),
          },
          {
            key: 'issueStatus',
            placeholder: tr('Όλες οι καταστάσεις'),
            options: [
              {value: 'OPEN', label: tr('Ανοικτές')},
              {value: 'RESOLVED', label: tr('Επιλυμένες')},
            ],
            ...choice(issueStatus, setIssueStatus),
          },
        ]
      : []),
    ...(active === 'loads'
      ? [
          {
            key: 'loadStatus',
            placeholder: tr('Όλες οι καταστάσεις'),
            options: Object.entries(LOAD_STATUS).map(([value, label]) => ({value, label: tr(label)})),
            ...choice(loadStatus, setLoadStatus),
          },
          {
            key: 'sterilizer',
            placeholder: tr('Όλοι οι κλίβανοι'),
            options: sterilizerNames.map(x => ({value: x, label: trData(x)})),
            ...choice(sterilizerName, setSterilizerName),
          },
        ]
      : []),
    ...(active === 'expiry'
      ? [
          {
            key: 'expiryState',
            placeholder: tr('Όλες οι λήξεις'),
            options: [
              {value: 'EXPIRING', label: tr('Λήγουν σύντομα')},
              {value: 'EXPIRED', label: tr('Έληξαν')},
              {value: 'OK', label: tr('Σε ισχύ')},
            ],
            ...choice(expiryState, setExpiryState),
          },
        ]
      : []),
    ...(active === 'handovers'
      ? [
          {
            key: 'signature',
            placeholder: tr('Όλες οι υπογραφές'),
            options: [
              {value: 'UNVERIFIED', label: tr('Μη επιβεβαιωμένη')},
              {value: 'VERIFIED', label: tr('Επιβεβαιωμένη')},
            ],
            ...choice(signature, setSignature),
          },
        ]
      : []),
    ...(active === 'usage'
      ? [
          {
            key: 'usage',
            placeholder: tr('Σε χρήση & εκτός χρήσης'),
            options: [
              {value: 'CRITICAL', label: tr('Κρίσιμο · 1 έως {0}', warningThreshold)},
              {value: 'EXHAUSTED', label: tr('Εξαντλημένα · 0 υπόλοιπο')},
              {value: 'NEW', label: tr('Αχρησιμοποίητα')},
              {value: 'USED', label: tr('Χρησιμοποιημένα')},
              {value: 'RETIRED', label: tr('Εκτός χρήσης')},
            ],
            ...choice(usageFilter, setUsageFilter),
          },
        ]
      : []),
    ...(dateKey
      ? [
          {
            key: 'dateFrom',
            type: 'date' as const,
            placeholder: tr('Από ημερομηνία'),
            options: [],
            value: dateFrom,
            onChange: setDateFrom,
          },
          {
            key: 'dateTo',
            type: 'date' as const,
            placeholder: tr('Έως ημερομηνία'),
            options: [],
            value: dateTo,
            onChange: setDateTo,
          },
        ]
      : []),
  ];
  // On screen: the sterilizer loads in fewer, fuller columns, and no column that is empty in every row.
  const screenColumns = useMemo(() => {
    const columns =
      active === 'loads'
        ? [
            {key: 'loaded', label: tr('Φόρτωση')},
            {key: 'equipment', label: tr('Κλίβανος')},
            {key: 'cycle', label: tr('Κύκλος')},
            {key: 'program', label: tr('Πρόγραμμα')},
            {key: 'items', label: tr('Αντικείμενα')},
            {key: 'indicators', label: tr('Δείκτες')},
            {key: 'cycleReadings', label: tr('Παράμετροι κύκλου')},
            {key: 'loadStatus', label: tr('Κατάσταση')},
            {key: 'releasedInfo', label: tr('Αποδέσμευση')},
          ]
        : reportData.columns;
    // A report with a barcode and a name shows the barcode, and whether it is a Set or an instrument, under the name,
    // not in columns of their own.
    const hasName = columns.some(c => c.key === 'name');
    return columns
      .filter(c => !(hasName && (c.key === 'barcode' || c.key === 'kind')))
      .filter(c =>
        reportData.rows.some((row: Row) => {
          const value = String(row[c.key] ?? '').trim();
          return value !== '' && value !== '—';
        }),
      );
  }, [active, reportData]);
  // Every column of the report sorts by its own title.
  const order = useTableSort(
    viewRows,
    Object.fromEntries(
      screenColumns.map(c => [
        c.key,
        // A column that shows a date with a name after it (the release of a load) sorts by the date underneath.
        (row: Row) => displaySortValue(c.key === 'releasedInfo' ? row.released : row[c.key]),
      ]),
    ),
  );
  // The inventory, by department or specialty, reads as groups as it opens: the group's name heads its rows, and its
  // column goes. Sorting by any column (that one too, either way) shows the plain table; a third click on the sorted
  // column returns to the groups.
  const firstKey = screenColumns[0]?.key;
  const groupKey =
    firstKey && (firstKey === 'department' || firstKey === 'specialty') && !order.sort ? firstKey : undefined;
  const tableColumns = groupKey ? screenColumns.slice(1) : screenColumns;
  // Each group's size, and how many of it are Sets and how many instruments: «53 · 4 Σετ, 49 εργαλεία».
  const groupSizes = useMemo(() => {
    const sizes = new Map<string, string>();
    if (!groupKey) return sizes;
    const tally = new Map<string, {total: number; kinds: Map<string, number>}>();
    for (const row of viewRows) {
      const key = String(row[groupKey] ?? '');
      const entry = tally.get(key) || {total: 0, kinds: new Map<string, number>()};
      entry.total += 1;
      if (row.kind) entry.kinds.set(String(row.kind), (entry.kinds.get(String(row.kind)) || 0) + 1);
      tally.set(key, entry);
    }
    const kindCount = (kind: string, count: number) =>
      kind === 'Εργαλείο'
        ? count === 1
          ? tr('1 εργαλείο')
          : tr('{0} εργαλεία', count)
        : kind === 'Σετ'
          ? tr('{0} Σετ', count)
          : `${count} ${cellText('kind', kind)}`;
    tally.forEach(({total, kinds}, key) =>
      sizes.set(
        key,
        kinds.size > 1
          ? `${total} · ${[...kinds].map(([kind, count]) => kindCount(kind, count)).join(', ')}`
          : String(total),
      ),
    );
    return sizes;
  }, [groupKey, viewRows]);
  const shownRows = useProgressiveList(
    order.rows,
    [
      order.sort?.key,
      order.sort?.dir,
      view?.label,
      active,
      group,
      department,
      specialty,
      assetKind,
      status,
      issueStatus,
      issueType,
      usageFilter,
      loadStatus,
      sterilizerName,
      expiryState,
      signature,
      dateFrom,
      dateTo,
      query,
    ].join('|'),
  );
  // «Σετ» or «Εργαλείο» under a name only where the report holds both.
  const mixedKinds = new Set(reportData.rows.map((row: Row) => row.kind).filter(Boolean)).size > 1;
  const resultBody = useFitWidth<HTMLDivElement>([reportData, shownRows.visible.length]);
  const reportTable = (): ExportTable => ({
    title: tr(activeMeta.title),
    subtitle: [`${reportData.rows.length} ${tr('εγγραφές')}`, period && `${tr('Περίοδος')} ${period}`]
      .filter(Boolean)
      .join(' · '),
    headers: reportData.columns.map(c => c.label),
    rows: reportData.rows.map(row => reportData.columns.map(c => cellText(c.key, row[c.key]))),
  });

  return (
    <div className="reports-page-workspace">
      <div className="page-head reports-page-head">
        <div>
          <span className="eyebrow">{tr('Ανάλυση δεδομένων')}</span>
          <h1>{tr('Αναφορές')}</h1>
          <p>{tr('Επιλέξτε αναφορά, ορίστε φίλτρα και δείτε τα αποτελέσματα πριν από εκτύπωση ή PDF.')}</p>
        </div>
      </div>
      <HistoryWindowNote auto />
      <div className="reports-workbench">
        <section className="reports-stage">
          <header className="reports-stage-head">
            {/* The title of the report is its button below; the heading is for readers who navigate by headings. */}
            <h2 className="visually-hidden">{tr(activeMeta.title)}</h2>
            <div className="reports-catalog-list" role="group" aria-label={tr('Αναφορές')}>
              {/* Every report on one row of tabs (no row of categories over them): its short name, its title in the
                  tooltip and for screen readers. */}
              {reports.map(report => {
                const Icon = report.icon;
                return (
                  <button
                    key={report.id}
                    title={tr(report.purpose)}
                    aria-label={tr(report.title)}
                    className={`reports-catalog-item ${active === report.id ? 'active' : ''}`}
                    onClick={() => {
                      setActive(report.id);
                      setView(null);
                    }}
                  >
                    <span className="reports-catalog-icon">
                      <Icon size={18} />
                    </span>
                    <span>
                      <strong>{tr(report.tab)}</strong>
                      <small>{tr(report.purpose)}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </header>
          <div className="reports-overview">
            {/* The report's figures as the same small cards above every list: each narrows the list, pressed again
                shows all. */}
            <QuickFilters
              label={tr('Σύνολα')}
              items={summary.map(chip => ({
                key: chip.label,
                label: chip.label,
                count: chip.value,
                tone: chip.tone,
                active: view?.label === chip.label,
                onClick: () =>
                  view?.label === chip.label ? setView(null) : setView({label: chip.label, test: chip.test}),
              }))}
            />
          </div>
          {/* The search, Filters and the download on one bar, as above every other list. */}
          <AssetFilterBar
            className="reports-filter-bar"
            query={query}
            onQueryChange={setQuery}
            placeholder={tr('Αναζήτηση στην αναφορά…')}
            filters={reportFilters}
            extra={
              <span data-tour="report-download">
                <DownloadMenu table={reportTable} onPrint={openPreview} />
              </span>
            }
          />
          <div className="reports-result-card">
            {/* The count is the «Σύνολο» figure above: the line shows only for a list a figure narrowed (with «Εμφάνιση
                όλων») or with a warning; otherwise it is read out only. */}
            <div
              className={`reports-result-head${
                view ||
                (active === 'usage' &&
                  reportData.rows.some(
                    (r: Row) => r.stateLabel === 'Σε χρήση' && Number(r.remaining) <= warningThreshold,
                  ))
                  ? ''
                  : ' visually-hidden'
              }`}
            >
              <div>
                <strong>{view ? view.label : tr('Αποτελέσματα')}</strong>
                <span>
                  {view ? viewRows.length : reportData.rows.length} {tr('εγγραφές')}
                </span>
              </div>
              {view && (
                <button type="button" className="reports-close-list" onClick={() => setView(null)}>
                  {tr('Εμφάνιση όλων')}
                </button>
              )}
              {active === 'usage' &&
                reportData.rows.some(
                  (r: Row) => r.stateLabel === 'Σε χρήση' && Number(r.remaining) <= warningThreshold,
                ) && (
                  <span className="reports-warning">
                    <AlertTriangle size={14} /> {tr('Υπάρχουν κρίσιμα όρια')}
                  </span>
                )}
            </div>
            <div
              ref={resultBody}
              className="reports-result-body"
              role="region"
              tabIndex={0}
              aria-label={tr('Αποτελέσματα')}
            >
              {viewRows.length ? (
                <table className={`reports-table${groupKey ? ' reports-grouped' : ''}`}>
                  <thead>
                    <tr>
                      {tableColumns.map(c => (
                        <SortTh key={c.key} label={c.label} sortKey={c.key} sort={order.sort} onSort={order.toggle} />
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shownRows.visible.map((row, index) => {
                      // Grouped (by department, specialty): each group opens with a line of its own — its name and
                      // how many it holds — instead of a column written on the first row and blank below it.
                      const previous = index ? shownRows.visible[index - 1] : undefined;
                      const opens = Boolean(groupKey && (!previous || previous[groupKey] !== row[groupKey]));
                      return (
                        <Fragment key={index}>
                          {opens && (
                            <tr className="report-group-row">
                              <th colSpan={tableColumns.length} scope="rowgroup">
                                {cellText(groupKey!, row[groupKey!]) || '—'}
                                <span>{groupSizes.get(String(row[groupKey!] ?? ''))}</span>
                              </th>
                            </tr>
                          )}
                          <tr>
                            {tableColumns.map(c => (
                              <td
                                key={c.key}
                                data-label={c.label}
                                className={
                                  c.key === 'barcode'
                                    ? 'mono'
                                    : c.key === 'name'
                                      ? 'report-cell-name'
                                      : c.key === 'signature' && row.signature === tr('Μη επιβεβαιωμένη')
                                        ? 'report-cell-warn'
                                        : ''
                                }
                              >
                                {c.key === 'stateLabel' && typeof row.state === 'string' && row.state ? (
                                  <StatusBadge value={row.state} />
                                ) : active === 'loads' && ['indicators', 'loadStatus', 'items'].includes(c.key) ? (
                                  <LoadCell column={c.key} row={row} />
                                ) : (
                                  cellText(c.key, row[c.key])
                                )}
                                {active === 'handovers' && c.key === 'type' && row.slipKey ? (
                                  <button
                                    type="button"
                                    className="report-slip-button"
                                    title={tr('Δελτίο')}
                                    aria-label={`${tr('Δελτίο')} ${String(row.barcode)}`}
                                    onClick={() => printSlip(row.slipKind as HandoverKind, String(row.slipKey))}
                                  >
                                    <Printer size={13} aria-hidden="true" />
                                  </button>
                                ) : null}
                                {c.key === 'name' && (row.barcode || (mixedKinds && row.kind)) ? (
                                  <small className="row-sub registry-row-barcode">
                                    {row.barcode ? <span className="mono">{String(row.barcode)}</span> : null}
                                    {mixedKinds && row.kind
                                      ? `${row.barcode ? ' · ' : ''}${cellText('kind', row.kind)}`
                                      : ''}
                                  </small>
                                ) : null}
                              </td>
                            ))}
                          </tr>
                        </Fragment>
                      );
                    })}
                    {shownRows.hasMore && <MoreRows colSpan={tableColumns.length} onVisible={shownRows.showMore} />}
                  </tbody>
                </table>
              ) : (
                <div className="reports-empty">
                  <FileText size={30} />
                  <strong>{tr('Δεν υπάρχουν αποτελέσματα')}</strong>
                  <span>{tr('Άλλαξε τα φίλτρα ή επίλεξε διαφορετική αναφορά.')}</span>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
      {preview && <PrintPreviewModal title={preview.title} html={preview.html} onClose={() => setPreview(null)} />}
    </div>
  );
}
