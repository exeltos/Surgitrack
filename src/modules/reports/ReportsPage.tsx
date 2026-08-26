import {useMemo, useState} from 'react';
import {
  Activity,
  AlertTriangle,
  Boxes,
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
import {useSurgi} from '../../store/SurgiStore';
import {compositionHtml} from '../sterilization/printUtils';

type ReportId = 'composition' | 'department' | 'specialty' | 'issues' | 'usage' | 'traceability';
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
  IN_STOCK: 'Stock',
  SERVICE: 'Service',
  LOST: 'Απώλεια',
};

const reports: Array<{id: ReportId; title: string; description: string; icon: typeof FileText}> = [
  {id: 'composition', title: 'Σύνθεση Σετ', description: 'Αναλυτική σύνθεση συγκεκριμένου Σετ.', icon: Boxes},
  {id: 'department', title: 'Ανά Τμήμα', description: 'Σετ και εργαλεία οργανωμένα ανά τμήμα.', icon: UsersRound},
  {id: 'specialty', title: 'Ανά Ειδικότητα', description: 'Κατανομή εξοπλισμού ανά ειδικότητα.', icon: Stethoscope},
  {id: 'issues', title: 'Service & Βλάβες', description: 'Βλάβες, φθορές, απώλειες και εκκρεμότητες.', icon: Wrench},
  {id: 'usage', title: 'Όρια Χρήσεων', description: 'Υπόλοιπο κύκλου ζωής και κρίσιμα όρια.', icon: Activity},
  {
    id: 'traceability',
    title: 'Ιχνηλασιμότητα Ασθενούς',
    description: 'Κινήσεις Σετ/εργαλείων βάσει κωδικού ασθενούς.',
    icon: History,
  },
];

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>'"]/g,
    ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'})[ch] || ch,
  );

function genericReportHtml(title: string, subtitle: string, columns: Array<{key: string; label: string}>, rows: Row[]) {
  const bodyRows = rows.length
    ? rows.map(row => `<tr>${columns.map(col => `<td>${escapeHtml(row[col.key] ?? '—')}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${columns.length}" class="empty">Δεν υπάρχουν εγγραφές για τα επιλεγμένα φίλτρα.</td></tr>`;
  return `<!doctype html><html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172b38;margin:0;font-size:9pt}.brand{font-size:16pt;font-weight:800;color:#153f51}.head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:1px solid #d8e1e5;padding-bottom:5mm;margin-bottom:5mm}.head h1{font-size:15pt;margin:2mm 0 1mm}.head p{margin:0;color:#687b87}.meta{text-align:right;color:#72838d;font-size:8pt}.count{margin:0 0 3mm;color:#526975}table{width:100%;border-collapse:collapse;table-layout:auto}th{text-align:left;background:#f1f5f7;color:#526975;font-size:8pt;padding:2.5mm 2mm;border-bottom:.4mm solid #c9d5da}td{padding:2.4mm 2mm;border-bottom:.2mm solid #e3eaed;vertical-align:top}.empty{text-align:center;padding:15mm;color:#81909a}.footer{margin-top:5mm;padding-top:3mm;border-top:.2mm solid #d8e1e5;display:flex;justify-content:space-between;color:#7a8a94;font-size:7.5pt}</style></head><body><div class="head"><div><div class="brand">SurgiTrack</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div><div class="meta">Αναφορά συστήματος<br>${escapeHtml(new Date().toLocaleString('el-GR'))}</div></div><p class="count">${rows.length} εγγραφές</p><table><thead><tr>${columns.map(c => `<th>${escapeHtml(c.label)}</th>`).join('')}</tr></thead><tbody>${bodyRows}</tbody></table><div class="footer"><span>SurgiTrack · Asset Management</span><span>${escapeHtml(title)}</span></div></body></html>`;
}

export default function ReportsPage() {
  const {sets, tools, issues, movements, currentUser} = useSurgi();
  const [active, setActive] = useState<ReportId>('composition');
  const [setId, setSetId] = useState(sets[0]?.id || '');
  const [department, setDepartment] = useState('ALL');
  const [specialty, setSpecialty] = useState('ALL');
  const [assetKind, setAssetKind] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [issueType, setIssueType] = useState('ALL');
  const [usageFilter, setUsageFilter] = useState('ALL');
  const [patientCode, setPatientCode] = useState('');
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
      Array.from(new Set([...sets.map(x => x.specialty), ...tools.map(x => x.specialty)])).sort((a, b) =>
        a.localeCompare(b, 'el'),
      ),
    [sets, tools],
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
          {key: 'name', label: 'Εργαλείο'},
          {key: 'code', label: 'Κωδικός'},
          {key: 'manufacturer', label: 'Κατασκευαστής'},
          {key: 'uses', label: 'Χρήσεις'},
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
          department: t.department || 'Stock',
          specialty: t.specialty,
          state: t.state,
          manufacturer: t.manufacturer || '—',
        })),
      ]
        .filter(a => department === 'ALL' || a.department === department)
        .filter(a => specialty === 'ALL' || a.specialty === specialty)
        .filter(a => assetKind === 'ALL' || (assetKind === 'SET' ? a.kind === 'Σετ' : a.kind === 'Εργαλείο'))
        .filter(a => status === 'ALL' || a.state === status);
      const sorted = assets.sort((a, b) =>
        active === 'department'
          ? a.department.localeCompare(b.department, 'el')
          : a.specialty.localeCompare(b.specialty, 'el'),
      );
      return {
        columns: [
          {
            key: active === 'department' ? 'department' : 'specialty',
            label: active === 'department' ? 'Τμήμα' : 'Ειδικότητα',
          },
          {key: 'kind', label: 'Τύπος'},
          {key: 'barcode', label: 'Barcode'},
          {key: 'name', label: 'Ονομασία'},
          {key: 'manufacturer', label: 'Κατασκευαστής'},
          {key: 'stateLabel', label: 'Κατάσταση'},
        ],
        rows: sorted.map(a => ({...a, stateLabel: stateLabel[a.state] || a.state})) as Row[],
      };
    }
    if (active === 'issues') {
      const rows = issues
        .filter(i => department === 'ALL' || i.department === department)
        .filter(i => issueType === 'ALL' || i.type === issueType)
        .filter(i => status === 'ALL' || i.status === status)
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
          {key: 'asset', label: 'Σετ / Εργαλείο'},
          {key: 'type', label: 'Τύπος'},
          {key: 'department', label: 'Τμήμα'},
          {key: 'status', label: 'Κατάσταση'},
          {key: 'created', label: 'Ημερομηνία'},
          {key: 'note', label: 'Παρατήρηση'},
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
            department: t.department || 'Stock',
            uses: t.uses,
            maxUses: t.maxUses || 0,
          })),
      ]
        .map(a => ({...a, remaining: Math.max(0, a.maxUses - a.uses)}))
        .filter(a => department === 'ALL' || a.department === department)
        .filter(a => assetKind === 'ALL' || (assetKind === 'SET' ? a.kind === 'Σετ' : a.kind === 'Εργαλείο'))
        .filter(a => usageFilter === 'ALL' || (usageFilter === 'CRITICAL' ? a.remaining <= 3 : a.remaining === 0))
        .sort((a, b) => a.remaining - b.remaining);
      return {
        columns: [
          {key: 'kind', label: 'Τύπος'},
          {key: 'barcode', label: 'Barcode'},
          {key: 'name', label: 'Ονομασία'},
          {key: 'department', label: 'Τμήμα'},
          {key: 'uses', label: 'Χρήσεις'},
          {key: 'maxUses', label: 'Όριο'},
          {key: 'remaining', label: 'Υπόλοιπο'},
        ],
        rows: assets as Row[],
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
        {key: 'patientCode', label: 'Κωδικός ασθενούς'},
        {key: 'asset', label: 'Asset'},
        {key: 'kind', label: 'Τύπος'},
        {key: 'from', label: 'Από'},
        {key: 'to', label: 'Προς'},
        {key: 'status', label: 'Κίνηση'},
        {key: 'at', label: 'Ημερομηνία'},
        {key: 'by', label: 'Χρήστης'},
      ],
      rows: rows as Row[],
    };
  }, [
    active,
    setId,
    sets,
    tools,
    issues,
    movements,
    department,
    specialty,
    assetKind,
    status,
    issueType,
    usageFilter,
    patientCode,
  ]);

  const buildPreview = () => {
    if (active === 'composition' && selectedSet) {
      return {
        title: `Σύνθεση ${selectedSet.barcode}`,
        html: compositionHtml(
          selectedSet,
          tools.filter(t => t.setId === selectedSet.id),
          currentUser.name,
          new Date().toLocaleString('el-GR'),
        ),
      };
    }
    const subtitle =
      active === 'department'
        ? 'Σετ και εργαλεία ανά τμήμα'
        : active === 'specialty'
          ? 'Σετ και εργαλεία ανά ειδικότητα'
          : activeMeta.description;
    return {
      title: activeMeta.title,
      html: genericReportHtml(activeMeta.title, subtitle, reportData.columns, reportData.rows),
    };
  };
  const openPreview = () => setPreview(buildPreview());

  return (
    <div className="reports-page-workspace">
      <div className="page-head reports-page-head">
        <div>
          <span className="eyebrow">REPORTING</span>
          <h1>Αναφορές & Εκτυπώσεις</h1>
          <p>Επίλεξε αναφορά, όρισε φίλτρα και δες τα αποτελέσματα πριν από εκτύπωση ή PDF.</p>
        </div>
      </div>
      <div className="reports-workbench">
        <aside className="reports-catalog" aria-label="Τύποι αναφορών">
          <div className="reports-catalog-head">
            <strong>Αναφορές</strong>
            <span>{reports.length} διαθέσιμες</span>
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
                    <strong>{report.title}</strong>
                    <small>{report.description}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
        <section className="reports-stage">
          <header className="reports-stage-head">
            <div>
              <span className="eyebrow">ΕΠΙΛΕΓΜΕΝΗ ΑΝΑΦΟΡΑ</span>
              <h2>{activeMeta.title}</h2>
              <p>{activeMeta.description}</p>
            </div>
            <div className="reports-stage-actions">
              <AppButton icon={<FileText size={16} />} onClick={openPreview}>
                Προεπισκόπηση
              </AppButton>
              <AppButton variant="primary" icon={<Printer size={16} />} onClick={openPreview}>
                Εκτύπωση / PDF
              </AppButton>
            </div>
          </header>
          <div className="reports-filter-strip">
            {active === 'composition' && (
              <label className="reports-filter-wide">
                <span>Σετ</span>
                <select value={selectedSet?.id || ''} onChange={e => setSetId(e.target.value)}>
                  {sets.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.barcode} · {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(active === 'department' || active === 'specialty' || active === 'issues' || active === 'usage') && (
              <label>
                <span>Τμήμα</span>
                <select value={department} onChange={e => setDepartment(e.target.value)}>
                  <option value="ALL">Όλα τα τμήματα</option>
                  {departments.map(x => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            )}
            {(active === 'department' || active === 'specialty') && (
              <label>
                <span>Ειδικότητα</span>
                <select value={specialty} onChange={e => setSpecialty(e.target.value)}>
                  <option value="ALL">Όλες οι ειδικότητες</option>
                  {specialties.map(x => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            )}
            {(active === 'department' || active === 'specialty' || active === 'usage') && (
              <label>
                <span>Τύπος</span>
                <select value={assetKind} onChange={e => setAssetKind(e.target.value)}>
                  <option value="ALL">Σετ & εργαλεία</option>
                  <option value="SET">Μόνο Σετ</option>
                  <option value="TOOL">Μόνο εργαλεία</option>
                </select>
              </label>
            )}
            {(active === 'department' || active === 'specialty') && (
              <label>
                <span>Κατάσταση</span>
                <select value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="ALL">Όλες οι καταστάσεις</option>
                  {Object.entries(stateLabel).map(([k, v]) => (
                    <option value={k} key={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {active === 'issues' && (
              <>
                <label>
                  <span>Τύπος συμβάντος</span>
                  <select value={issueType} onChange={e => setIssueType(e.target.value)}>
                    <option value="ALL">Όλοι οι τύποι</option>
                    {issueTypes.map(x => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Κατάσταση</span>
                  <select value={status} onChange={e => setStatus(e.target.value)}>
                    <option value="ALL">Όλες</option>
                    <option value="OPEN">Ανοιχτές</option>
                    <option value="RESOLVED">Ολοκληρωμένες</option>
                  </select>
                </label>
              </>
            )}
            {active === 'usage' && (
              <label>
                <span>Υπόλοιπο</span>
                <select value={usageFilter} onChange={e => setUsageFilter(e.target.value)}>
                  <option value="ALL">Όλα τα όρια</option>
                  <option value="CRITICAL">Κρίσιμο · ≤ 3</option>
                  <option value="EXHAUSTED">Εξαντλημένα · 0</option>
                </select>
              </label>
            )}
            {active === 'traceability' && (
              <label className="reports-filter-search">
                <span>Κωδικός ασθενούς</span>
                <div>
                  <Search size={16} />
                  <input
                    value={patientCode}
                    onChange={e => setPatientCode(e.target.value)}
                    placeholder="π.χ. PAT-2026-001"
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
                    : 'Αποτελέσματα'}
                </strong>
                <span>{reportData.rows.length} εγγραφές</span>
              </div>
              {active === 'usage' && reportData.rows.some((r: Row) => Number(r.remaining) <= 3) && (
                <span className="reports-warning">
                  <AlertTriangle size={14} /> Υπάρχουν κρίσιμα όρια
                </span>
              )}
            </div>
            <div className="reports-result-body">
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
                    {reportData.rows.map((row, index) => (
                      <tr key={index}>
                        {reportData.columns.map(c => (
                          <td key={c.key} className={c.key === 'barcode' ? 'mono' : ''}>
                            {String(row[c.key] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="reports-empty">
                  <FileText size={30} />
                  <strong>Δεν υπάρχουν αποτελέσματα</strong>
                  <span>
                    {active === 'traceability' && !patientCode
                      ? 'Πληκτρολόγησε κωδικό ασθενούς για αναζήτηση ιχνηλασιμότητας.'
                      : 'Άλλαξε τα φίλτρα ή επίλεξε διαφορετική αναφορά.'}
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
