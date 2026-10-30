import {useMemo, useState} from 'react';
import {useFitWidth} from '../../components/ui/useFitWidth';
import {AlertTriangle, FileText} from 'lucide-react';
import PrintPreviewModal from '../../components/assets/PrintPreviewModal';
import FilterMenu, {type SelectFilter} from '../../components/assets/FilterMenu';
import type {ExportTable} from '../../core/exportTable';
import DownloadMenu from '../../components/ui/DownloadMenu';
import {useSurgi} from '../../store/SurgiStore';
import {useLibraries} from '../../core/LibraryStore';
import {MoreRows} from '../../components/ui/ProgressiveList';
import {useProgressiveList} from '../../core/useProgressiveList';
import {tr, trData} from '../../i18n';
import HistoryWindowNote from '../../components/ui/HistoryWindowNote';
import {
  LOAD_STATUS,
  cellText,
  genericReportHtml,
  reportGroups,
  reports,
  stateLabel,
  type InventoryGroup,
  type ReportId,
  type Row,
} from './reportsMeta';
import {buildReport} from './buildReport';
import {reportGroups as splitRows, reportSummary} from './reportSummary';

export default function ReportsPage() {
  const {sets, tools, retiredTools, issues, processLoads, sterilizationReleases, receipts, deliveries, movements} =
    useSurgi();
  const warningThreshold = useLibraries().systemSettings.usageWarningThreshold;
  const [active, setActive] = useState<ReportId>('inventory');
  // The list opens when a card or a group is pressed: the report starts with its totals.
  const [view, setView] = useState<{label: string; test: (row: Row) => boolean} | null>(null);
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

  const reportData = useMemo(
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
          movements,
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
      movements,
      signature,
    ],
  );

  const summary = reportSummary(active, reportData.rows, warningThreshold);
  const split = splitRows(active, reportData.rows);
  const viewRows = useMemo(() => (view ? reportData.rows.filter(view.test) : []), [view, reportData.rows]);
  const buildPreview = () => {
    const subtitle =
      active === 'inventory'
        ? group === 'department'
          ? tr('Σετ και εργαλεία ανά τμήμα')
          : tr('Σετ και εργαλεία ανά ειδικότητα')
        : tr(activeMeta.description);
    return {
      title: tr(activeMeta.title),
      html: genericReportHtml(tr(activeMeta.title), subtitle, reportData.columns, reportData.rows),
    };
  };
  const openPreview = () => setPreview(buildPreview());
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
              {value: 'OPEN', label: tr('Ανοιχτές')},
              {value: 'RESOLVED', label: tr('Ολοκληρωμένες')},
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
              {value: 'CRITICAL', label: tr('Κρίσιμο · ≤ {0}', warningThreshold)},
              {value: 'EXHAUSTED', label: tr('Συμπληρωμένο όριο · 0')},
              {value: 'RETIRED', label: tr('Εκτός χρήσης')},
            ],
            ...choice(usageFilter, setUsageFilter),
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
            {key: 'cycleProgram', label: tr('Κύκλος')},
            {key: 'items', label: tr('Αντικείμενα')},
            {key: 'indicators', label: tr('Δείκτες')},
            {key: 'loadStatus', label: tr('Κατάσταση')},
            {key: 'releasedInfo', label: tr('Αποδέσμευση')},
            {key: 'barcodes', label: 'Barcodes'},
          ]
        : reportData.columns;
    return columns.filter(c =>
      reportData.rows.some((row: Row) => {
        const value = String(row[c.key] ?? '').trim();
        return value !== '' && value !== '—';
      }),
    );
  }, [active, reportData]);
  const shownRows = useProgressiveList(
    viewRows,
    [
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
    ].join('|'),
  );
  const resultBody = useFitWidth<HTMLDivElement>([reportData, shownRows.visible.length]);
  const reportTable = (): ExportTable => ({
    title: tr(activeMeta.title),
    subtitle: `${reportData.rows.length} ${tr('εγγραφές')}`,
    headers: reportData.columns.map(c => c.label),
    rows: reportData.rows.map(row => reportData.columns.map(c => cellText(c.key, row[c.key]))),
  });

  return (
    <div className="reports-page-workspace">
      <div className="page-head reports-page-head">
        <div>
          <span className="eyebrow">{tr('ΑΝΑΛΥΣΗ ΔΕΔΟΜΕΝΩΝ')}</span>
          <h1>{tr('Αναφορές')}</h1>
          <p>{tr('Επιλέξτε αναφορά, ορίστε φίλτρα και δείτε τα αποτελέσματα πριν από εκτύπωση ή PDF.')}</p>
        </div>
      </div>
      <HistoryWindowNote auto />
      <div className="reports-workbench">
        <aside className="reports-catalog" aria-label={tr('Τύποι αναφορών')}>
          <div className="reports-catalog-head">
            <strong>{tr('Αναφορές')}</strong>
            <span>
              {reports.length} {tr('διαθέσιμες')}
            </span>
          </div>
          <div className="reports-catalog-list">
            {reportGroups.map(group => (
              <div className="reports-catalog-group" key={group.id} role="group" aria-label={tr(group.title)}>
                <h3>{tr(group.title)}</h3>
                {reports
                  .filter(report => report.group === group.id)
                  .map(report => {
                    const Icon = report.icon;
                    return (
                      <button
                        key={report.id}
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
                          <strong>{tr(report.title)}</strong>
                          <small>{tr(report.purpose)}</small>
                        </span>
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </aside>
        <section className="reports-stage">
          <header className="reports-stage-head">
            <div>
              <span className="eyebrow">{tr('ΕΠΙΛΕΓΜΕΝΗ ΑΝΑΦΟΡΑ')}</span>
              <h2>{tr(activeMeta.title)}</h2>
              <p>
                {tr(activeMeta.description)} {tr(activeMeta.purpose)}
              </p>
            </div>
            <div className="reports-stage-actions" data-tour="report-download">
              <DownloadMenu variant="primary" table={reportTable} onPrint={openPreview} />
            </div>
          </header>
          <div className="reports-filter-strip">
            <FilterMenu filters={reportFilters} />
          </div>
          <div className="reports-overview">
            <ul className="reports-summary" aria-label={tr('Σύνολα')}>
              {summary.map(chip => (
                <li key={chip.label}>
                  <button
                    type="button"
                    className={`${chip.tone && chip.value > 0 ? chip.tone : ''} ${view?.label === chip.label ? 'active' : ''}`}
                    aria-pressed={view?.label === chip.label}
                    disabled={chip.value === 0}
                    onClick={() => setView({label: chip.label, test: chip.test})}
                  >
                    <b>{chip.value}</b>
                    <span>{chip.label}</span>
                  </button>
                </li>
              ))}
            </ul>
            {split.items.length > 1 && (
              <div className="reports-split" role="group" aria-label={split.title}>
                <strong>{split.title}</strong>
                {split.items.map(item => (
                  <button
                    type="button"
                    key={item.label}
                    className={view?.label === `${split.title}: ${item.label}` ? 'active' : ''}
                    onClick={() =>
                      setView({
                        label: `${split.title}: ${item.label}`,
                        test: row => String(row[split.key] ?? '—') === item.label,
                      })
                    }
                  >
                    <span>{cellText(split.key, item.label)}</span>
                    <i style={{width: `${Math.max(4, (item.value / split.items[0].value) * 100)}%`}} />
                    <b>{item.value}</b>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="reports-result-card">
            <div className="reports-result-head">
              <div>
                <strong>{view ? view.label : tr('Αποτελέσματα')}</strong>
                <span>
                  {view ? viewRows.length : reportData.rows.length} {tr('εγγραφές')}
                </span>
              </div>
              {view && (
                <button type="button" className="reports-close-list" onClick={() => setView(null)}>
                  {tr('Κλείσιμο λίστας')}
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
              {!view ? (
                <div className="reports-empty">
                  <FileText size={30} />
                  <strong>{tr('Πατήστε μια κάρτα ή μια ομάδα για να δείτε τη λίστα')}</strong>
                  <button
                    type="button"
                    className="app-button"
                    onClick={() => setView({label: tr('Σύνολο'), test: () => true})}
                  >
                    {tr('Εμφάνιση όλων')}
                  </button>
                </div>
              ) : viewRows.length ? (
                <table className="reports-table">
                  <thead>
                    <tr>
                      {screenColumns.map(c => (
                        <th key={c.key}>{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shownRows.visible.map((row, index) => (
                      <tr key={index}>
                        {screenColumns.map(c => (
                          <td
                            key={c.key}
                            data-label={c.label}
                            className={
                              c.key === 'barcode'
                                ? 'mono'
                                : c.key === 'signature' && row.signature === tr('Μη επιβεβαιωμένη')
                                  ? 'report-cell-warn'
                                  : ''
                            }
                          >
                            {cellText(c.key, row[c.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {shownRows.hasMore && <MoreRows colSpan={screenColumns.length} onVisible={shownRows.showMore} />}
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
