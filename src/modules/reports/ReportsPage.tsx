import {useMemo, useState} from 'react';
import {
  Activity,
  AlertTriangle,
  Archive,
  Boxes,
  CalendarClock,
  Flame,
  FileSpreadsheet,
  FileText,
  History,
  Printer,
  Search,
  Stethoscope,
  UsersRound,
  Wrench,
} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import PrintPreviewModal from '../../components/assets/PrintPreviewModal';
import FilterMenu, {type SelectFilter} from '../../components/assets/FilterMenu';
import {downloadXlsx} from '../../core/exportTable';
import {useSurgi} from '../../store/SurgiStore';
import {useLibraries} from '../../core/LibraryStore';
import {MoreRows} from '../../components/ui/ProgressiveList';
import {useProgressiveList} from '../../core/useProgressiveList';
import {compositionHtml} from '../sterilization/printUtils';
import {useCompositionOptions} from '../../components/assets/usePrintLook';
import {getI18nLang, tr, trData} from '../../i18n';
import {formatExpiry, sterileExpiryList} from '../../core/sterileExpiry';
import {EXPIRY_MARK, STERILE_MARK} from '../../core/sterileSymbols';
import HistoryWindowNote from '../../components/ui/HistoryWindowNote';

const LOAD_STATUS: Record<string, string> = {
  OPEN: 'Στον κλίβανο',
  AWAITING_RELEASE: 'Αναμονή αποδέσμευσης',
  RELEASED: 'Αποδεσμεύτηκε',
  REPROCESS: 'Μη αποδέσμευση',
  FAILED: 'Αποτυχία κύκλου',
  RECALLED: 'Ανάκληση',
};
const INDICATOR: Record<string, string> = {
  PASS: 'Επιτυχής',
  FAIL: 'Ανεπιτυχής',
  NOT_RECORDED: 'Δεν έγινε',
  PENDING: 'Σε αναμονή',
};
const indicatorText = (value?: string) => (value && INDICATOR[value] ? tr(INDICATOR[value]) : '—');

type ReportId =
  'composition' | 'department' | 'specialty' | 'issues' | 'usage' | 'retired' | 'loads' | 'expiry' | 'traceability';
type Row = Record<string, string | number>;

const stateLabel: Record<string, string> = {
  IN_DEPARTMENT: 'Στο τμήμα',
  PENDING_STERILIZATION: 'Αναμονή παραλαβής',
  IN_WASHING: 'Καθαρισμός & Απολύμανση',
  IN_PREPARATION: 'Σύνθεση & προετοιμασία',
  IN_PACKAGING: 'Συσκευασία & Σήμανση',
  IN_STERILIZATION: 'Αποστείρωση',
  AWAITING_RELEASE: 'Αναμονή αποδέσμευσης',
  IN_STORAGE: 'Αποθήκευση',
  READY_FOR_PICKUP: 'Έτοιμο για παραλαβή',
  IN_STOCK: 'Απόθεμα',
  SERVICE: 'Service',
  LOST: 'Απώλεια',
  RETIRED: 'Εκτός χρήσης',
};

const reports: Array<{id: ReportId; title: string; description: string; icon: typeof FileText}> = [
  {id: 'composition', title: 'Σύνθεση Σετ', description: 'Αναλυτική σύνθεση συγκεκριμένου Σετ.', icon: Boxes},
  {id: 'department', title: 'Ανά Τμήμα', description: 'Σετ και εργαλεία οργανωμένα ανά τμήμα.', icon: UsersRound},
  {id: 'specialty', title: 'Ανά Ειδικότητα', description: 'Κατανομή εξοπλισμού ανά ειδικότητα.', icon: Stethoscope},
  {id: 'issues', title: 'Service & Βλάβες', description: 'Βλάβες, φθορές, απώλειες και εκκρεμότητες.', icon: Wrench},
  {id: 'usage', title: 'Όρια Χρήσεων', description: 'Υπόλοιπο χρήσεων και κρίσιμα όρια.', icon: Activity},
  {
    id: 'retired',
    title: 'Εργαλεία εκτός χρήσης',
    description: 'Ιστορικό εργαλείων που τέθηκαν εκτός χρήσης (π.χ. συμπλήρωση ορίου χρήσεων).',
    icon: Archive,
  },
  {
    id: 'loads',
    title: 'Φορτία κλιβάνου',
    description: 'Φορτία, κύκλοι, δείκτες και αποδεσμεύσεις ανά κλίβανο.',
    icon: Flame,
  },
  {
    id: 'expiry',
    title: 'Λήξεις αποστείρωσης',
    description: 'Αποστειρωμένα Σετ και εργαλεία με διάρκεια και ημερομηνία λήξης.',
    icon: CalendarClock,
  },
  {
    id: 'traceability',
    title: 'Ιχνηλασιμότητα Ασθενούς',
    description: 'Κινήσεις Σετ/εργαλείων βάσει κωδικού ασθενούς.',
    icon: History,
  },
];

/** Report cells holding stored Greek values (type, department, state…) are shown in the UI language. */
const TRANSLATED_COLUMNS = new Set([
  'kind',
  'department',
  'specialty',
  'stateLabel',
  'type',
  'status',
  'from',
  'to',
  'reason',
]);
const cellText = (key: string, value: unknown) => {
  const text = String(value ?? '—');
  return TRANSLATED_COLUMNS.has(key) ? trData(text) : text;
};

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>'"]/g,
    ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'})[ch] || ch,
  );

function genericReportHtml(title: string, subtitle: string, columns: Array<{key: string; label: string}>, rows: Row[]) {
  const bodyRows = rows.length
    ? rows
        .map(
          row => `<tr>${columns.map(col => `<td>${escapeHtml(cellText(col.key, row[col.key]))}</td>`).join('')}</tr>`,
        )
        .join('')
    : `<tr><td colspan="${columns.length}" class="empty">${escapeHtml(tr('Δεν υπάρχουν εγγραφές για τα επιλεγμένα φίλτρα.'))}</td></tr>`;
  return `<!doctype html><html lang="${getI18nLang()}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172b38;margin:0;font-size:9pt}.brand{font-size:16pt;font-weight:800;color:#153f51}.head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:1px solid #d8e1e5;padding-bottom:5mm;margin-bottom:5mm}.head h1{font-size:15pt;margin:2mm 0 1mm}.head p{margin:0;color:#687b87}.meta{text-align:right;color:#72838d;font-size:8pt}.count{margin:0 0 3mm;color:#526975}table{width:100%;border-collapse:collapse;table-layout:auto}th{text-align:left;background:#f1f5f7;color:#526975;font-size:8pt;padding:2.5mm 2mm;border-bottom:.4mm solid #c9d5da}td{padding:2.4mm 2mm;border-bottom:.2mm solid #e3eaed;vertical-align:top}.empty{text-align:center;padding:15mm;color:#81909a}.footer{margin-top:5mm;padding-top:3mm;border-top:.2mm solid #d8e1e5;display:flex;justify-content:space-between;color:#7a8a94;font-size:7.5pt}</style></head><body><div class="head"><div><div class="brand">SurgiTrack</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div><div class="meta">${escapeHtml(tr('Αναφορά συστήματος'))}<br>${escapeHtml(new Date().toLocaleString(getI18nLang() === 'en' ? 'en-GB' : 'el-GR'))}</div></div><p class="count">${escapeHtml(tr('{0} εγγραφές', rows.length))}</p><table><thead><tr>${columns.map(c => `<th>${escapeHtml(c.label)}</th>`).join('')}</tr></thead><tbody>${bodyRows}</tbody></table><div class="footer"><span>SurgiTrack · Asset Management</span><span>${escapeHtml(title)}</span></div></body></html>`;
}

export default function ReportsPage() {
  const {sets, tools, retiredTools, issues, movements, currentUser, processLoads, sterilizationReleases} = useSurgi();
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

  const reportData = useMemo(() => {
    if (active === 'composition') {
      const set = sets.find(s => s.id === setId) || sets[0];
      const members = set ? tools.filter(t => t.setId === set.id) : [];
      return {
        columns: [
          {key: 'barcode', label: 'Barcode'},
          {key: 'name', label: tr('Εργαλείο')},
          {key: 'code', label: tr('Κωδικός')},
          {key: 'manufacturer', label: tr('Κατασκευαστής')},
          {key: 'uses', label: tr('Χρήσεις')},
        ],
        rows: members.map(t => ({
          barcode: t.barcode,
          name: t.name,
          code: t.code,
          manufacturer: t.manufacturer || '—',
          uses: t.maxUses ? `${t.uses}/${t.maxUses}` : String(t.uses),
        })) as Row[],
      };
    }
    if (active === 'department' || active === 'specialty') {
      const assets = [
        ...sets.map(s => ({
          kind: 'Σετ',
          barcode: s.barcode,
          name: s.name,
          department: s.department,
          specialty: s.specialty,
          state: s.state,
          manufacturer: s.manufacturer || '—',
        })),
        ...tools.map(t => ({
          kind: 'Εργαλείο',
          barcode: t.barcode,
          name: t.name,
          department: t.department || 'Απόθεμα',
          specialty: t.specialty,
          state: t.state,
          manufacturer: t.manufacturer || '—',
        })),
      ]
        .filter(a => department === 'ALL' || a.department === department)
        .filter(a => specialty === 'ALL' || a.specialty === specialty)
        .filter(a => assetKind === 'ALL' || (assetKind === 'SET' ? a.kind === 'Σετ' : a.kind === 'Εργαλείο'))
        .filter(a => status === 'ALL' || a.state === status);
      // Grouped by department (or specialty), Sets before instruments, then by name.
      const sorted = assets.sort(
        (a, b) =>
          (active === 'department'
            ? a.department.localeCompare(b.department, 'el')
            : (a.specialty || '').localeCompare(b.specialty || '', 'el')) ||
          b.kind.localeCompare(a.kind, 'el') ||
          a.name.localeCompare(b.name, 'el'),
      );
      return {
        columns: [
          {
            key: active === 'department' ? 'department' : 'specialty',
            label: active === 'department' ? tr('Τμήμα') : tr('Ειδικότητα'),
          },
          {key: 'kind', label: tr('Τύπος')},
          {key: 'barcode', label: 'Barcode'},
          {key: 'name', label: tr('Ονομασία')},
          {key: 'manufacturer', label: tr('Κατασκευαστής')},
          {key: 'stateLabel', label: tr('Κατάσταση')},
        ],
        rows: sorted.map(a => ({...a, stateLabel: stateLabel[a.state] || a.state})) as Row[],
      };
    }
    if (active === 'issues') {
      const rows = issues
        .filter(i => department === 'ALL' || i.department === department)
        .filter(i => issueType === 'ALL' || i.type === issueType)
        .filter(i => issueStatus === 'ALL' || i.status === issueStatus)
        .map(i => ({
          asset: i.asset,
          type: i.type,
          department: i.department,
          status: i.status === 'OPEN' ? 'Ανοιχτή' : 'Ολοκληρωμένη',
          created: i.created,
          note: i.note,
        }));
      return {
        columns: [
          {key: 'asset', label: tr('Σετ / Εργαλείο')},
          {key: 'type', label: tr('Τύπος')},
          {key: 'department', label: tr('Τμήμα')},
          {key: 'status', label: tr('Κατάσταση')},
          {key: 'created', label: tr('Ημερομηνία')},
          {key: 'note', label: tr('Παρατήρηση')},
        ],
        rows: rows as Row[],
      };
    }
    if (active === 'usage') {
      const assets = [
        ...sets
          .filter(s => s.maxUses)
          .map(s => ({
            kind: 'Σετ',
            barcode: s.barcode,
            name: s.name,
            department: s.department,
            uses: s.uses || 0,
            maxUses: s.maxUses || 0,
          })),
        ...tools
          .filter(t => t.maxUses)
          .map(t => ({
            kind: 'Εργαλείο',
            barcode: t.barcode,
            name: t.name,
            department: t.department || 'Απόθεμα',
            uses: t.uses,
            maxUses: t.maxUses || 0,
          })),
      ]
        .map(a => ({...a, remaining: Math.max(0, a.maxUses - a.uses)}))
        .filter(a => department === 'ALL' || a.department === department)
        .filter(a => assetKind === 'ALL' || (assetKind === 'SET' ? a.kind === 'Σετ' : a.kind === 'Εργαλείο'))
        .filter(
          a =>
            usageFilter === 'ALL' || (usageFilter === 'CRITICAL' ? a.remaining <= warningThreshold : a.remaining === 0),
        )
        .sort((a, b) => a.remaining - b.remaining);
      return {
        columns: [
          {key: 'kind', label: tr('Τύπος')},
          {key: 'barcode', label: 'Barcode'},
          {key: 'name', label: tr('Ονομασία')},
          {key: 'department', label: tr('Τμήμα')},
          {key: 'uses', label: tr('Χρήσεις')},
          {key: 'maxUses', label: tr('Όριο')},
          {key: 'remaining', label: tr('Υπόλοιπο')},
        ],
        rows: assets as Row[],
      };
    }
    if (active === 'retired') {
      const rows = retiredTools
        .filter(t => specialty === 'ALL' || t.specialty === specialty)
        .map(t => ({
          barcode: t.barcode,
          name: t.name,
          code: t.code,
          manufacturer: t.manufacturer || '—',
          specialty: t.specialty || '—',
          uses: t.maxUses !== undefined ? `${t.uses}/${t.maxUses}` : String(t.uses),
          retiredAt: t.retiredAt || '—',
          reason: t.retiredReason || '—',
          notes: t.notes || '',
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'el') || a.barcode.localeCompare(b.barcode));
      return {
        columns: [
          {key: 'barcode', label: 'Barcode'},
          {key: 'name', label: tr('Εργαλείο')},
          {key: 'code', label: tr('Κωδικός')},
          {key: 'manufacturer', label: tr('Κατασκευαστής')},
          {key: 'specialty', label: tr('Ειδικότητα')},
          {key: 'uses', label: tr('Χρήσεις')},
          {key: 'retiredAt', label: tr('Εκτός χρήσης από')},
          {key: 'reason', label: tr('Αιτία')},
          {key: 'notes', label: tr('Σημειώσεις')},
        ],
        rows: rows as Row[],
      };
    }
    if (active === 'loads') {
      const rows = processLoads
        .filter(load => load.kind === 'STERILIZATION')
        .filter(load => loadStatus === 'ALL' || load.status === loadStatus)
        .filter(load => sterilizerName === 'ALL' || load.equipment === sterilizerName)
        .map(load => {
          const release = sterilizationReleases.find(r => r.loadId === load.id);
          return {
            loaded: load.createdAt,
            equipment: load.equipment,
            cycle: load.cycleNumber,
            program: load.program,
            items: load.items.length,
            chemical: indicatorText(load.chemicalIndicatorResult),
            biological: indicatorText(load.biologicalIndicatorResult),
            loadStatus: tr(LOAD_STATUS[load.status] || load.status),
            released: load.releasedAt || '—',
            releasedBy: release?.releasedByName || '—',
            barcodes: load.items.map(item => item.barcode).join(', '),
          };
        });
      return {
        columns: [
          {key: 'loaded', label: tr('Φόρτωση')},
          {key: 'equipment', label: tr('Κλίβανος')},
          {key: 'cycle', label: tr('Κύκλος')},
          {key: 'program', label: tr('Πρόγραμμα')},
          {key: 'items', label: tr('Αντικείμενα')},
          {key: 'chemical', label: tr('Χημικός δείκτης')},
          {key: 'biological', label: tr('Βιολογικός δείκτης')},
          {key: 'loadStatus', label: tr('Κατάσταση')},
          {key: 'released', label: tr('Αποδέσμευση')},
          {key: 'releasedBy', label: tr('Αποδέσμευσε')},
          {key: 'barcodes', label: 'Barcodes'},
        ],
        rows: rows as Row[],
      };
    }
    if (active === 'expiry') {
      const rows = sterileExpiryList(sets, tools)
        .filter(e => department === 'ALL' || e.department === department)
        .filter(e => expiryState === 'ALL' || e.state === expiryState)
        .map(e => ({
          kind: e.kind === 'SET' ? 'Σετ' : 'Εργαλείο',
          barcode: e.barcode,
          name: e.name,
          department: e.department || '—',
          stateLabel: stateLabel[e.assetState] || e.assetState,
          shelfLife: e.shelfLifeMonths ? tr('{0} μήνες', e.shelfLifeMonths) : '—',
          sterilized: e.sterilizedOn ? formatExpiry(e.sterilizedOn) : '—',
          until: formatExpiry(e.sterileUntil),
          left:
            e.state === 'EXPIRED'
              ? tr('Έληξε πριν {0} ημ.', -e.daysLeft)
              : e.state === 'EXPIRING'
                ? tr('Λήγει σε {0} ημ.', e.daysLeft)
                : tr('{0} ημέρες', e.daysLeft),
        }));
      return {
        columns: [
          {key: 'kind', label: tr('Τύπος')},
          {key: 'barcode', label: 'Barcode'},
          {key: 'name', label: tr('Ονομασία')},
          {key: 'department', label: tr('Τμήμα')},
          {key: 'stateLabel', label: tr('Θέση')},
          {key: 'shelfLife', label: tr('Διάρκεια')},
          {key: 'sterilized', label: `${STERILE_MARK} · ${tr('Αποστείρωση')}`},
          {key: 'until', label: `${EXPIRY_MARK} ${tr('Λήγει')}`},
          {key: 'left', label: tr('Υπόλοιπο')},
        ],
        rows: rows as Row[],
      };
    }
    const q = patientCode.trim().toLowerCase();
    const rows = movements
      .filter(m => m.patientCode && (!q || m.patientCode.toLowerCase().includes(q)))
      .map(m => ({
        patientCode: m.patientCode || '',
        asset: m.asset,
        kind: m.assetKind === 'SET' ? 'Σετ' : 'Εργαλείο',
        from: m.from,
        to: m.to,
        status: m.status,
        at: m.at,
        by: m.by,
      }));
    return {
      columns: [
        {key: 'patientCode', label: tr('Κωδικός ασθενούς')},
        {key: 'asset', label: 'Asset'},
        {key: 'kind', label: tr('Τύπος')},
        {key: 'from', label: tr('Από')},
        {key: 'to', label: tr('Προς')},
        {key: 'status', label: tr('Κίνηση')},
        {key: 'at', label: tr('Ημερομηνία')},
        {key: 'by', label: tr('Χρήστης')},
      ],
      rows: rows as Row[],
    };
  }, [
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
  ]);

  const buildPreview = () => {
    if (active === 'composition' && selectedSet) {
      return {
        title: tr('Σύνθεση {0}', selectedSet.barcode),
        html: compositionHtml(
          selectedSet,
          tools.filter(t => t.setId === selectedSet.id),
          currentUser.name,
          new Date().toLocaleString('el-GR'),
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
    ...(byDepartment || active === 'issues' || active === 'usage' || active === 'expiry'
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
    ].join('|'),
  );
  const exportExcel = () => {
    const title =
      active === 'composition' && selectedSet ? tr('Σύνθεση {0}', selectedSet.barcode) : tr(activeMeta.title);
    downloadXlsx({
      title,
      subtitle: `${reportData.rows.length} ${tr('εγγραφές')}`,
      headers: reportData.columns.map(c => c.label),
      rows: reportData.rows.map(row => reportData.columns.map(c => cellText(c.key, row[c.key]))),
    });
  };

  return (
    <div className="reports-page-workspace">
      <div className="page-head reports-page-head">
        <div>
          <span className="eyebrow">{tr('ΑΝΑΛΥΣΗ ΔΕΔΟΜΕΝΩΝ')}</span>
          <h1>{tr('Αναφορές & Εκτυπώσεις')}</h1>
          <p>{tr('Επίλεξε αναφορά, όρισε φίλτρα και δες τα αποτελέσματα πριν από εκτύπωση ή PDF.')}</p>
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
            <div className="reports-stage-actions">
              <AppButton icon={<FileSpreadsheet size={16} />} onClick={exportExcel}>
                {tr('Εξαγωγή Excel')}
              </AppButton>
              <AppButton variant="primary" icon={<Printer size={16} />} onClick={openPreview}>
                {tr('Εκτύπωση / PDF')}
              </AppButton>
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
                    placeholder={tr('π.χ. PAT-2026-001')}
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
            <div className="reports-result-body" role="region" tabIndex={0} aria-label={tr('Αποτελέσματα')}>
              {reportData.rows.length ? (
                <table className="reports-table">
                  <thead>
                    <tr>
                      {reportData.columns.map(c => (
                        <th key={c.key}>{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shownRows.visible.map((row, index) => (
                      <tr key={index}>
                        {reportData.columns.map(c => (
                          <td key={c.key} className={c.key === 'barcode' ? 'mono' : ''}>
                            {cellText(c.key, row[c.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {shownRows.hasMore && (
                      <MoreRows colSpan={reportData.columns.length} onVisible={shownRows.showMore} />
                    )}
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
