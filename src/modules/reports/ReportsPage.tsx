import {useMemo, useState} from 'react';
import {useFitWidth} from '../../components/ui/useFitWidth';
import {AlertTriangle, FileText, Search} from 'lucide-react';
import PrintPreviewModal from '../../components/assets/PrintPreviewModal';
import FilterMenu, {type SelectFilter} from '../../components/assets/FilterMenu';
import type {ExportTable} from '../../core/exportTable';
import DownloadMenu from '../../components/ui/DownloadMenu';
import {useSurgi} from '../../store/SurgiStore';
import {useLibraries} from '../../core/LibraryStore';
import {MoreRows} from '../../components/ui/ProgressiveList';
import {useProgressiveList} from '../../core/useProgressiveList';
import {compositionHtml} from '../sterilization/printUtils';
import {useCompositionOptions} from '../../components/assets/usePrintLook';
import {tr, trData} from '../../i18n';
import HistoryWindowNote from '../../components/ui/HistoryWindowNote';
import {formatDateTime} from '../../core/displayDate';
import {
  LOAD_STATUS,
  REPORT_HISTORY,
  cellText,
  genericReportHtml,
  reports,
  stateLabel,
  type ReportId,
  type Row,
} from './reportsMeta';
import {buildReport} from './buildReport';

export default function ReportsPage() {
  const {
    sets,
    tools,
    retiredTools,
    issues,
    movements,
    currentUser,
    processLoads,
    sterilizationReleases,
    receipts,
    deliveries,
  } = useSurgi();
  const warningThreshold = useLibraries().systemSettings.usageWarningThreshold;
  const compositionOptions = useCompositionOptions();
  // Sets in the composition picker, by name.
  const setsByName = useMemo(() => [...sets].sort((a, b) => a.name.localeCompare(b.name, 'el')), [sets]);
  const [active, setActive] = useState<ReportId>('composition');
  const [setId, setSetId] = useState(sets[0]?.id || '');
  const [department, setDepartment] = useState('ALL');
  const [specialty, setSpecialty] = useState('ALL');
  const [assetKind, setAssetKind] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [issueStatus, setIssueStatus] = useState('ALL');
  const [issueType, setIssueType] = useState('ALL');
  const [usageFilter, setUsageFilter] = useState('ALL');
  const [patientCode, setPatientCode] = useState('');
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
          ...tools.map(x => x.department).filter((value): value is string => Boolean(value)),
        ]),
      ).sort((a, b) => a.localeCompare(b, 'el')),
    [sets, tools],
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
  const selectedSet = sets.find(s => s.id === setId) || sets[0];
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
          movements,
          processLoads,
          sterilizationReleases,
          receipts,
          deliveries,
          warningThreshold,
        },
        {
          setId,
          department,
          specialty,
          assetKind,
          status,
          issueStatus,
          issueType,
          usageFilter,
          patientCode,
          loadStatus,
          sterilizerName,
          expiryState,
          signature,
        },
      ),
    [
      active,
      setId,
      sets,
      tools,
      retiredTools,
      processLoads,
      sterilizationReleases,
      loadStatus,
      sterilizerName,
      expiryState,
      issues,
      movements,
      department,
      specialty,
      assetKind,
      status,
      issueStatus,
      issueType,
      usageFilter,
      patientCode,
      warningThreshold,
      receipts,
      deliveries,
      signature,
    ],
  );

  const buildPreview = () => {
    if (active === 'composition' && selectedSet) {
      return {
        title: tr('Σύνθεση {0}', selectedSet.barcode),
        html: compositionHtml(
          selectedSet,
          tools.filter(t => t.setId === selectedSet.id),
          currentUser.name,
          formatDateTime(),
          issues.filter(i => i.status === 'OPEN').map(i => ({barcode: i.asset.split(' · ')[0], type: i.type})),
          compositionOptions(selectedSet.colorTapes),
        ),
      };
    }
    const subtitle =
      active === 'department'
        ? tr('Σετ και εργαλεία ανά τμήμα')
        : active === 'specialty'
          ? tr('Σετ και εργαλεία ανά ειδικότητα')
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
  const byDepartment = active === 'department' || active === 'specialty';
  const reportFilters: SelectFilter[] = [
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
    ...(byDepartment || active === 'retired'
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
            placeholder: tr('Όλα τα όρια'),
            options: [
              {value: 'CRITICAL', label: tr('Κρίσιμο · ≤ {0}', warningThreshold)},
              {value: 'EXHAUSTED', label: tr('Συμπληρωμένο όριο · 0')},
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
    reportData.rows,
    [
      active,
      setId,
      department,
      specialty,
      assetKind,
      status,
      issueStatus,
      issueType,
      usageFilter,
      patientCode,
      loadStatus,
      sterilizerName,
      expiryState,
      signature,
    ].join('|'),
  );
  const resultBody = useFitWidth<HTMLDivElement>([reportData, shownRows.visible.length]);
  const reportTable = (): ExportTable => ({
    title: active === 'composition' && selectedSet ? tr('Σύνθεση {0}', selectedSet.barcode) : tr(activeMeta.title),
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
      {/* Only the reports that read history load the rest of it, and only the kind they read. */}
      {REPORT_HISTORY[active] && <HistoryWindowNote auto collections={REPORT_HISTORY[active]} />}
      <div className="reports-workbench">
        <aside className="reports-catalog" aria-label={tr('Τύποι αναφορών')}>
          <div className="reports-catalog-head">
            <strong>{tr('Αναφορές')}</strong>
            <span>
              {reports.length} {tr('διαθέσιμες')}
            </span>
          </div>
          <div className="reports-catalog-list">
            {reports.map(report => {
              const Icon = report.icon;
              return (
                <button
                  key={report.id}
                  className={`reports-catalog-item ${active === report.id ? 'active' : ''}`}
                  onClick={() => setActive(report.id)}
                >
                  <span className="reports-catalog-icon">
                    <Icon size={18} />
                  </span>
                  <span>
                    <strong>{tr(report.title)}</strong>
                    <small>{tr(report.description)}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
        <section className="reports-stage">
          <header className="reports-stage-head">
            <div>
              <span className="eyebrow">{tr('ΕΠΙΛΕΓΜΕΝΗ ΑΝΑΦΟΡΑ')}</span>
              <h2>{tr(activeMeta.title)}</h2>
              <p>{tr(activeMeta.description)}</p>
            </div>
            <div className="reports-stage-actions" data-tour="report-download">
              <DownloadMenu variant="primary" table={reportTable} onPrint={openPreview} />
            </div>
          </header>
          <div className="reports-filter-strip">
            {active === 'composition' && (
              <label className="reports-filter-wide">
                <span>{tr('Σετ')}</span>
                <select value={selectedSet?.id || ''} onChange={e => setSetId(e.target.value)}>
                  {setsByName.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.barcode}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <FilterMenu filters={reportFilters} />
            {active === 'traceability' && (
              <label className="reports-filter-search">
                <span>{tr('Κωδικός ασθενούς')}</span>
                <div>
                  <Search size={16} />
                  <input
                    value={patientCode}
                    onChange={e => setPatientCode(e.target.value)}
                    placeholder={tr('π.χ. PT-2026-0041')}
                  />
                </div>
              </label>
            )}
          </div>
          <div className="reports-result-card">
            <div className="reports-result-head">
              <div>
                <strong>
                  {active === 'composition' && selectedSet
                    ? `${selectedSet.barcode} · ${selectedSet.name}`
                    : tr('Αποτελέσματα')}
                </strong>
                <span>
                  {reportData.rows.length} {tr('εγγραφές')}
                </span>
              </div>
              {active === 'usage' && reportData.rows.some((r: Row) => Number(r.remaining) <= warningThreshold) && (
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
              {reportData.rows.length ? (
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
                  <span>
                    {active === 'traceability' && !patientCode
                      ? tr('Πληκτρολόγησε κωδικό ασθενούς για αναζήτηση ιχνηλασιμότητας.')
                      : tr('Άλλαξε τα φίλτρα ή επίλεξε διαφορετική αναφορά.')}
                  </span>
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
