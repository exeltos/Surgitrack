import {useEffect, useMemo, useState} from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RotateCcw,
  Search,
  Upload,
} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import {downloadXlsx} from '../../core/exportTable';
import {readSheetFile, type SheetRows} from '../../core/sheetImport';
import {getCloudOrganizationId} from '../../data/cloud/appRecords';
import {
  listAssetImports,
  loadHospitalAssets,
  runAssetImport,
  undoAssetImport,
  type AssetImport,
} from '../../data/cloud/assetImports';
import {
  IMPORT_FIELDS,
  autoMapping,
  buildImportPlan,
  findHeaderRow,
  templateTable,
  type ImportMapping,
  type ImportPlan,
} from './assetImport';
import {cleanName} from '../../core/nameCheck';
import type {SetAsset, Tool} from '../../types/domain';

type Props = {
  lang: 'el' | 'en';
  organizations: Array<{id: string; name: string}>;
  departments: Array<{organizationId: string; name: string; code: string; active: boolean}>;
  byName: string;
};

type Step = 'FILE' | 'MAP' | 'CHECK' | 'DONE';
const STEPS: Array<{id: Step; el: string; en: string}> = [
  {id: 'FILE', el: 'Αρχείο', en: 'File'},
  {id: 'MAP', el: 'Αντιστοίχιση', en: 'Columns'},
  {id: 'CHECK', el: 'Έλεγχος', en: 'Check'},
  {id: 'DONE', el: 'Εισαγωγή', en: 'Import'},
];
const SHOWN_ERRORS = 200;

/**
 * Studio → Εισαγωγή: Sets and instruments from an Excel or CSV file into a hospital, in four steps
 * (file, columns, check, import). Every import is logged and can be undone as a whole.
 */
export default function AssetImportWizard({lang, organizations, departments, byName}: Props) {
  const L = (el: string, en: string) => (lang === 'el' ? el : en);
  // Inside a hospital there is one choice, already made.
  const [organizationId, setOrganizationId] = useState(organizations.length === 1 ? organizations[0].id : '');
  const [step, setStep] = useState<Step>('FILE');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<SheetRows>([]);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<ImportMapping>(() => autoMapping([]));
  const [plan, setPlan] = useState<ImportPlan>();
  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState<{done: number; total: number}>();
  const [error, setError] = useState('');
  const [imports, setImports] = useState<AssetImport[]>([]);
  const [undoTarget, setUndoTarget] = useState<AssetImport>();
  const [needsReload, setNeedsReload] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Names as the hospital writes them: one spelling, and the name it already has for a code.
  const [existingNames, setExistingNames] = useState<Map<string, string>>(new Map());
  const [uniform, setUniform] = useState(true);
  const [useExisting, setUseExisting] = useState(true);

  const organization = organizations.find(o => o.id === organizationId);
  const headers = rows[headerRow] || [];
  const dataRows = useMemo(() => rows.slice(headerRow + 1), [rows, headerRow]);

  const refreshImports = async (id = organizationId) => {
    if (!id) return setImports([]);
    try {
      setImports(await listAssetImports(id));
    } catch (e) {
      setError(messageOf(e));
    }
  };
  useEffect(() => {
    void refreshImports(organizationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const reset = () => {
    setStep('FILE');
    setRows([]);
    setFileName('');
    setPlan(undefined);
    setProgress(undefined);
    setError('');
  };
  // The open workspace holds that hospital's records in memory; it reloads to see the change.
  const touchesOpenWorkspace = (id: string) => getCloudOrganizationId() === id;

  const openFile = async (file: File) => {
    setError('');
    try {
      const sheet = await readSheetFile(file);
      if (sheet.filter(row => row.some(Boolean)).length < 2) {
        setError(L('Το αρχείο δεν έχει γραμμές με εργαλεία.', 'The file has no instrument rows.'));
        return;
      }
      const header = findHeaderRow(sheet);
      setRows(sheet);
      setHeaderRow(header);
      setMapping(autoMapping(sheet[header]));
      setFileName(file.name);
      setStep('MAP');
    } catch (e) {
      setError(
        messageOf(e) === 'xls'
          ? L(
              'Τα παλιά αρχεία .xls δεν διαβάζονται. Αποθηκεύστε το ως .xlsx ή CSV από το Excel.',
              'Old .xls files cannot be read. Save it as .xlsx or CSV from Excel.',
            )
          : L('Το αρχείο δεν διαβάστηκε. Χρησιμοποιήστε .xlsx ή CSV.', 'The file could not be read. Use .xlsx or CSV.'),
      );
    }
  };

  const check = async () => {
    if (!organizationId) return;
    setBusy(L('Έλεγχος barcodes του νοσοκομείου…', "Checking the hospital's barcodes…"));
    setError('');
    try {
      const {barcodes: existingBarcodes, names} = await loadHospitalAssets(organizationId);
      setExistingNames(names);
      setPlan(
        buildImportPlan(dataRows, headerRow + 2, mapping, {
          lang,
          departments: departments
            .filter(d => d.organizationId === organizationId && d.active)
            .map(d => ({name: d.name, code: d.code})),
          existingBarcodes,
          batch: `imp${Date.now().toString(36)}`,
        }),
      );
      setStep('CHECK');
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy('');
    }
  };

  /** The name an imported line gets, with the two name choices applied. */
  const finalName = (code: string, name: string) => {
    const existing = useExisting ? existingNames.get(code.trim().toUpperCase()) : undefined;
    return existing || (uniform ? cleanName(name) : name);
  };
  const final = useMemo(() => {
    if (!plan) return undefined;
    const tools: Tool[] = plan.tools.map(t => ({...t, name: finalName(t.code, t.name)}));
    const sets: SetAsset[] = plan.sets.map(set => {
      if (!set.compositionTemplate) return set;
      const merged = new Map<string, {code: string; name: string; quantity: number}>();
      for (const line of set.compositionTemplate) {
        const name = finalName(line.code, line.name);
        const key = `${line.code}|${name}`;
        const item = merged.get(key) || {code: line.code, name, quantity: 0};
        item.quantity += line.quantity;
        merged.set(key, item);
      }
      return {...set, compositionTemplate: [...merged.values()]};
    });
    return {tools, sets};
    // finalName reads only these.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, existingNames, uniform, useExisting]);
  /** Lines whose name differs from the one the hospital already uses for that code. */
  const nameWarnings = useMemo(() => {
    if (!plan) return [];
    const seen = new Map<string, {code: string; name: string; existing: string; count: number}>();
    for (const t of plan.tools) {
      const existing = existingNames.get(t.code.trim().toUpperCase());
      if (!existing || cleanName(t.name) === existing) continue;
      const key = `${t.code}|${t.name}`;
      const item = seen.get(key) || {code: t.code, name: t.name, existing, count: 0};
      item.count += 1;
      seen.set(key, item);
    }
    return [...seen.values()];
  }, [plan, existingNames]);
  const respelled = useMemo(() => (plan ? plan.tools.filter(t => cleanName(t.name) !== t.name).length : 0), [plan]);

  const start = async () => {
    if (!plan || plan.errors.length || !organizationId) return;
    const batch = plan.tools[0]?.importBatch || plan.sets[0]?.importBatch;
    if (!batch) return;
    setBusy(L('Εισαγωγή…', 'Importing…'));
    setError('');
    setProgress({done: 0, total: plan.sets.length + plan.tools.length});
    try {
      await runAssetImport(
        organizationId,
        batch,
        fileName,
        byName,
        final || {sets: plan.sets, tools: plan.tools},
        (done, total) => setProgress({done, total}),
      );
      setNeedsReload(touchesOpenWorkspace(organizationId));
      setStep('DONE');
      await refreshImports();
    } catch (e) {
      setError(
        L('Η εισαγωγή σταμάτησε: ', 'The import stopped: ') +
          messageOf(e) +
          L(
            ' Ξαναπατήστε «Εισαγωγή»: συνεχίζει από εκεί που σταμάτησε.',
            ' Press “Import” again: it carries on where it stopped.',
          ),
      );
    } finally {
      setBusy('');
    }
  };

  const undo = async (item: AssetImport) => {
    setUndoTarget(undefined);
    setBusy(L('Αναίρεση εισαγωγής…', 'Undoing import…'));
    try {
      const used = await undoAssetImport(organizationId, item.id, byName);
      if (used) {
        setError(
          L(
            `Η εισαγωγή «${item.fileName}» δεν αναιρέθηκε: ${used} από τα εργαλεία ή Σετ της έχουν ήδη χρησιμοποιηθεί ή αλλάξει (κινήσεις, παραλαβές, αναφορές, αλλαγή Σετ). Διαγράψτε μεμονωμένα όσα δεν χρειάζεστε.`,
            `Import “${item.fileName}” was not undone: ${used} of its instruments or Sets have already been used or changed (movements, receipts, reports, Set changes). Delete the ones you do not need one by one.`,
          ),
        );
        return;
      }
      setNeedsReload(touchesOpenWorkspace(organizationId));
      await refreshImports();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy('');
    }
  };

  const stepIndex = STEPS.findIndex(s => s.id === step);
  const mappedName = mapping.name >= 0;
  const filledRows = dataRows.filter(row => row.some(Boolean));
  const sample = filledRows.slice(0, 3);
  const formatDate = (iso: string) => new Date(iso).toLocaleString(lang === 'el' ? 'el-GR' : 'en-GB');

  return (
    <div className="asset-import">
      <header className="asset-import-head">
        <div>
          <h2>{L('Μαζική εισαγωγή εργαλείων και Σετ', 'Bulk import of instruments and Sets')}</h2>
          <p>
            {L(
              'Από αρχείο Excel (.xlsx) ή CSV: μία γραμμή ανά εργαλείο. Πριν γραφτεί οτιδήποτε, κάθε γραμμή ελέγχεται. Κάθε εισαγωγή αναιρείται ολόκληρη.',
              'From an Excel (.xlsx) or CSV file: one row per instrument. Every row is checked before anything is written. Each import can be undone as a whole.',
            )}
          </p>
        </div>
        {organizations.length === 1 ? (
          <div className="asset-import-hospital chip">
            <Building2 size={16} />
            <b>{organizations[0].name}</b>
          </div>
        ) : (
          <label className="asset-import-hospital">
            {L('Νοσοκομείο', 'Hospital')}
            <select
              value={organizationId}
              disabled={step !== 'FILE' || Boolean(busy)}
              onChange={e => {
                setOrganizationId(e.target.value);
                setNeedsReload(false);
              }}
            >
              <option value="">{L('Επιλέξτε νοσοκομείο', 'Choose a hospital')}</option>
              {organizations.map(o => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      <ol className="asset-import-steps">
        {STEPS.map((s, i) => (
          <li key={s.id} className={i < stepIndex ? 'done' : i === stepIndex ? 'active' : ''}>
            <span>{i + 1}</span>
            {L(s.el, s.en)}
          </li>
        ))}
      </ol>

      {error && (
        <div className="asset-import-alert">
          <AlertTriangle size={17} />
          <span>{error}</span>
        </div>
      )}
      {needsReload && (
        <div className="asset-import-note">
          <span>
            {L(
              'Έχετε ανοιχτό αυτό το νοσοκομείο. Ανανεώστε τη σελίδα για να δείτε τις αλλαγές στις λίστες.',
              'This hospital is open in your workspace. Reload the page to see the changes in the lists.',
            )}
          </span>
          <AppButton onClick={() => window.location.reload()}>
            <RotateCcw size={15} />
            {L('Ανανέωση', 'Reload')}
          </AppButton>
        </div>
      )}

      <section className="asset-import-body">
        {step === 'FILE' && (
          <div className="asset-import-file">
            <div className="asset-import-start">
              <label
                className={`asset-import-drop${organizationId ? '' : ' disabled'}${dragging ? ' dragging' : ''}`}
                onDragOver={e => {
                  if (!organizationId) return;
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => {
                  e.preventDefault();
                  setDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file && organizationId) void openFile(file);
                }}
              >
                <span className="asset-import-drop-icon">
                  <Upload size={24} />
                </span>
                <b>
                  {organizationId
                    ? L('Σύρετε εδώ το αρχείο ή πατήστε για επιλογή', 'Drop the file here or click to choose')
                    : L('Επιλέξτε πρώτα νοσοκομείο (πάνω δεξιά)', 'Choose a hospital first (top right)')}
                </b>
                <small>
                  {organizationId
                    ? L(
                        `Excel (.xlsx) ή CSV · για «${organization?.name}»`,
                        `Excel (.xlsx) or CSV · for “${organization?.name}”`,
                      )
                    : '.xlsx · .csv'}
                </small>
                <input
                  type="file"
                  accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  hidden
                  disabled={!organizationId}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void openFile(file);
                  }}
                />
              </label>
              <div className="asset-import-template">
                <FileSpreadsheet size={20} />
                <span>
                  <b>{L('Δεν έχετε έτοιμο αρχείο;', 'No file ready?')}</b>
                  <small>
                    {L(
                      'Κατεβάστε το πρότυπο και συμπληρώστε το. Ή ανεβάστε το δικό σας: στο επόμενο βήμα λέτε ποια στήλη είναι τι.',
                      'Download the template and fill it in. Or upload your own: in the next step you say which column is what.',
                    )}
                  </small>
                </span>
                <AppButton onClick={() => downloadXlsx(templateTable(lang))}>
                  <Download size={15} />
                  {L('Πρότυπο Excel', 'Excel template')}
                </AppButton>
              </div>
            </div>

            <aside className="asset-import-guide">
              <b>{L('Πώς διαβάζεται το αρχείο', 'How the file is read')}</b>
              <small>{L('Μία γραμμή ανά εργαλείο. Παράδειγμα:', 'One row per instrument. For example:')}</small>
              <table>
                <thead>
                  <tr>
                    <th>{L('Σετ', 'Set')}</th>
                    <th>{L('Εργαλείο', 'Instrument')}</th>
                    <th>{L('Τμήμα', 'Department')}</th>
                    <th>{L('Ποσ.', 'Qty')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="set-a">
                    <td>{L('Λαπαροτομίας 1', 'Laparotomy 1')}</td>
                    <td>{L('Λαβίδα Kocher', 'Kocher forceps')}</td>
                    <td>{L('Χειρουργείο', 'Theatre')}</td>
                    <td>4</td>
                  </tr>
                  <tr className="set-a">
                    <td>{L('Λαπαροτομίας 1', 'Laparotomy 1')}</td>
                    <td>{L('Ψαλίδι Metzenbaum', 'Metzenbaum scissors')}</td>
                    <td>{L('Χειρουργείο', 'Theatre')}</td>
                    <td>2</td>
                  </tr>
                  <tr>
                    <td className="blank">—</td>
                    <td>{L('Άγκιστρο Farabeuf', 'Farabeuf retractor')}</td>
                    <td>{L('ΜΕΘ', 'ICU')}</td>
                    <td>1</td>
                  </tr>
                  <tr>
                    <td className="blank">—</td>
                    <td>{L('Λαβίδα Pean', 'Pean forceps')}</td>
                    <td className="blank">—</td>
                    <td>3</td>
                  </tr>
                </tbody>
              </table>
              <ul>
                <li>
                  <i className="set-a" />
                  {L(
                    'Ίδιο όνομα Σετ = ένα Σετ: εδώ ένα Σετ με 6 εργαλεία (4 + 2).',
                    'Same Set name = one Set: here one Set with 6 instruments (4 + 2).',
                  )}
                </li>
                <li>
                  <i />
                  {L(
                    'Χωρίς Σετ: μεμονωμένο εργαλείο του τμήματος, ή Απόθεμα αν δεν έχει τμήμα.',
                    'No Set: a standalone instrument of its department, or Stock without one.',
                  )}
                </li>
                <li>
                  <i />
                  {L(
                    'Ποσότητα 4 = τέσσερα εργαλεία, καθένα με δικό του barcode. Όσα barcodes λείπουν δίνονται αυτόματα.',
                    'Quantity 4 = four instruments, each with its own barcode. Missing barcodes are assigned for you.',
                  )}
                </li>
                <li>
                  <i />
                  {L(
                    'Δύο ίδια Σετ (π.χ. δύο «Λαπαροτομίας»): δώστε τους διαφορετικό όνομα ή barcode Σετ.',
                    'Two identical Sets: give each its own name or Set barcode.',
                  )}
                </li>
              </ul>
            </aside>
          </div>
        )}

        {step === 'MAP' && (
          <div className="asset-import-map">
            <p className="asset-import-lead">
              {L(
                `«${fileName}»: ${filledRows.length} γραμμές. Για κάθε πεδίο διαλέξτε τη στήλη του αρχείου σας (όσες αναγνωρίστηκαν είναι ήδη συμπληρωμένες).`,
                `“${fileName}”: ${filledRows.length} rows. For each field choose the column of your file (recognized ones are already filled in).`,
              )}
            </p>
            <label className="asset-import-header-row">
              {L('Γραμμή επικεφαλίδων', 'Header row')}
              <select
                value={headerRow}
                onChange={e => {
                  const next = Number(e.target.value);
                  setHeaderRow(next);
                  setMapping(autoMapping(rows[next] || []));
                }}
              >
                {rows.slice(0, 10).map((row, i) =>
                  row.some(Boolean) ? (
                    <option key={i} value={i}>
                      {i + 1}: {row.filter(Boolean).slice(0, 4).join(' · ')}
                    </option>
                  ) : null,
                )}
              </select>
            </label>
            <div className="asset-import-fields">
              {IMPORT_FIELDS.map(field => (
                <label key={field.key} className={field.required && mapping[field.key] < 0 ? 'missing' : ''}>
                  <span>
                    <b>
                      {L(field.el, field.en)}
                      {field.required ? ' *' : ''}
                    </b>
                    {(lang === 'el' ? field.hintEl : field.hintEn) && <small>{L(field.hintEl, field.hintEn)}</small>}
                  </span>
                  <select
                    value={mapping[field.key]}
                    onChange={e => setMapping(m => ({...m, [field.key]: Number(e.target.value)}))}
                  >
                    <option value={-1}>{L('— Χωρίς —', '— None —')}</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || L(`Στήλη ${i + 1}`, `Column ${i + 1}`)}
                      </option>
                    ))}
                  </select>
                  <em>{mapping[field.key] >= 0 ? sample.map(r => r[mapping[field.key]] || '·').join(' | ') : ''}</em>
                </label>
              ))}
            </div>
            <footer className="asset-import-actions">
              <AppButton onClick={reset}>{L('Άλλο αρχείο', 'Another file')}</AppButton>
              <AppButton variant="primary" disabled={!mappedName || Boolean(busy)} onClick={() => void check()}>
                {busy || L('Έλεγχος γραμμών', 'Check rows')}
              </AppButton>
            </footer>
          </div>
        )}

        {step === 'CHECK' && plan && (
          <div className="asset-import-check">
            <div className="asset-import-summary">
              <div>
                <span>{L('Γραμμές', 'Rows')}</span>
                <strong>{plan.rows}</strong>
              </div>
              <div>
                <span>{L('Σετ', 'Sets')}</span>
                <strong>{plan.sets.length}</strong>
                <small>{L(`${plan.setMembers} εργαλεία μέσα`, `${plan.setMembers} instruments inside`)}</small>
              </div>
              <div>
                <span>{L('Μεμονωμένα', 'Standalone')}</span>
                <strong>{plan.standalone}</strong>
              </div>
              <div>
                <span>{L('Απόθεμα', 'Stock')}</span>
                <strong>{plan.stock}</strong>
              </div>
              <div className={plan.errors.length ? 'bad' : 'good'}>
                <span>{L('Προβλήματα', 'Problems')}</span>
                <strong>{plan.errors.length}</strong>
              </div>
            </div>
            {plan.errors.length ? (
              <>
                <p className="asset-import-lead">
                  {L(
                    'Διορθώστε αυτές τις γραμμές στο αρχείο και ανεβάστε το ξανά. Δεν γράφτηκε τίποτα.',
                    'Fix these rows in the file and upload it again. Nothing was written.',
                  )}
                </p>
                <div className="asset-import-errors">
                  {plan.errors.slice(0, SHOWN_ERRORS).map((issue, i) => (
                    <div key={i}>
                      <b>{L(`Γραμμή ${issue.row}`, `Row ${issue.row}`)}</b>
                      <span>{issue.message}</span>
                    </div>
                  ))}
                  {plan.errors.length > SHOWN_ERRORS && (
                    <small>
                      {L(
                        `…και ${plan.errors.length - SHOWN_ERRORS} ακόμη.`,
                        `…and ${plan.errors.length - SHOWN_ERRORS} more.`,
                      )}
                    </small>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="asset-import-lead">
                  {L(
                    `Όλα σωστά. Θα δημιουργηθούν ${plan.sets.length} Σετ και ${plan.tools.length} εργαλεία στο «${organization?.name}».`,
                    `All good. ${plan.sets.length} Sets and ${plan.tools.length} instruments will be created in “${organization?.name}”.`,
                  )}
                </p>
                <div className="asset-import-preview">
                  {plan.sets.slice(0, 6).map(s => (
                    <div key={s.id}>
                      <b>
                        {s.barcode} · {s.name}
                      </b>
                      <small>
                        {s.department || L('Απόθεμα', 'Stock')} ·{' '}
                        {L(`${s.expected} εργαλεία`, `${s.expected} instruments`)}
                      </small>
                    </div>
                  ))}
                  {plan.sets.length > 6 && (
                    <small>
                      {L(`…και ${plan.sets.length - 6} ακόμη Σετ.`, `…and ${plan.sets.length - 6} more Sets.`)}
                    </small>
                  )}
                </div>
                {(respelled > 0 || nameWarnings.length > 0) && (
                  <div className="asset-import-names">
                    <b>{L('Ονομασίες', 'Names')}</b>
                    {respelled > 0 && (
                      <label>
                        <input type="checkbox" checked={uniform} onChange={e => setUniform(e.target.checked)} />
                        <span>
                          {L(
                            `Ενιαία γραφή σε ${respelled} εργαλεία (κεφαλαία χωρίς τόνους, κενά, γράμματα από λάθος πληκτρολόγιο, 12cm → 12 CM).`,
                            `One spelling for ${respelled} instruments (capitals without accents, spacing, letters typed on the wrong keyboard, 12cm → 12 CM).`,
                          )}
                        </span>
                      </label>
                    )}
                    {nameWarnings.length > 0 && (
                      <>
                        <label>
                          <input
                            type="checkbox"
                            checked={useExisting}
                            onChange={e => setUseExisting(e.target.checked)}
                          />
                          <span>
                            {L(
                              `Χρήση της ονομασίας που έχει ήδη ο ίδιος κωδικός στο νοσοκομείο (${nameWarnings.length} διαφορές).`,
                              `Use the name the same code already has in the hospital (${nameWarnings.length} differences).`,
                            )}
                          </span>
                        </label>
                        <div className="asset-import-name-diffs">
                          {nameWarnings.slice(0, 8).map(w => (
                            <div key={`${w.code}|${w.name}`}>
                              <code>{w.code}</code>
                              <span className="from">{w.name}</span>
                              <span className="to">{w.existing}</span>
                              <small>×{w.count}</small>
                            </div>
                          ))}
                          {nameWarnings.length > 8 && (
                            <small>
                              {L(`…και ${nameWarnings.length - 8} ακόμη.`, `…and ${nameWarnings.length - 8} more.`)}
                            </small>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
                <ToolsPreview plan={final ? {...plan, ...final} : plan} L={L} />
              </>
            )}
            {progress && (
              <div className="asset-import-progress">
                <div style={{width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%`}} />
                <small>
                  {progress.done} / {progress.total}
                </small>
              </div>
            )}
            <footer className="asset-import-actions">
              <AppButton disabled={Boolean(busy)} onClick={() => setStep('MAP')}>
                {L('Πίσω', 'Back')}
              </AppButton>
              <AppButton disabled={Boolean(busy)} onClick={reset}>
                {L('Άλλο αρχείο', 'Another file')}
              </AppButton>
              <AppButton
                variant="primary"
                disabled={Boolean(plan.errors.length) || Boolean(busy) || !(plan.tools.length + plan.sets.length)}
                onClick={() => void start()}
              >
                {busy || L('Εισαγωγή', 'Import')}
              </AppButton>
            </footer>
          </div>
        )}

        {step === 'DONE' && plan && (
          <div className="asset-import-done">
            <CheckCircle2 size={34} />
            <b>
              {L(
                `Δημιουργήθηκαν ${plan.sets.length} Σετ και ${plan.tools.length} εργαλεία στο «${organization?.name}».`,
                `${plan.sets.length} Sets and ${plan.tools.length} instruments were created in “${organization?.name}”.`,
              )}
            </b>
            <small>
              {L(
                'Αν κάτι δεν είναι σωστό, αναιρέστε την εισαγωγή από τη λίστα παρακάτω.',
                'If something is wrong, undo the import from the list below.',
              )}
            </small>
            <AppButton variant="primary" onClick={reset}>
              {L('Νέα εισαγωγή', 'New import')}
            </AppButton>
          </div>
        )}
      </section>

      {organizationId && (
        <section className="asset-import-history">
          <h3>{L('Εισαγωγές σε αυτό το νοσοκομείο', 'Imports into this hospital')}</h3>
          {imports.length === 0 ? (
            <small>{L('Καμία εισαγωγή ακόμη.', 'No imports yet.')}</small>
          ) : (
            imports.map(item => (
              <div key={item.id} className={item.undoneAt ? 'undone' : ''}>
                <span>
                  <b>{item.fileName}</b>
                  <small>
                    {formatDate(item.createdAt)}
                    {item.createdByName ? ` · ${item.createdByName}` : ''} ·{' '}
                    {L(`${item.sets} Σετ, ${item.tools} εργαλεία`, `${item.sets} Sets, ${item.tools} instruments`)}
                  </small>
                </span>
                {item.undoneAt ? (
                  <small>
                    {L('Αναιρέθηκε', 'Undone')} {formatDate(item.undoneAt)}
                    {item.undoneByName ? ` · ${item.undoneByName}` : ''}
                  </small>
                ) : (
                  <AppButton
                    variant="danger"
                    disabled={Boolean(busy)}
                    onClick={() => {
                      setError('');
                      setUndoTarget(item);
                    }}
                  >
                    <RotateCcw size={15} />
                    {L('Αναίρεση', 'Undo')}
                  </AppButton>
                )}
              </div>
            ))
          )}
        </section>
      )}

      {undoTarget && (
        <ConfirmDialog
          title={L('Αναίρεση εισαγωγής', 'Undo import')}
          message={L(
            `Θα διαγραφούν οριστικά ${undoTarget.sets} Σετ και ${undoTarget.tools} εργαλεία της εισαγωγής «${undoTarget.fileName}». Συνέχεια;`,
            `${undoTarget.sets} Sets and ${undoTarget.tools} instruments of import “${undoTarget.fileName}” will be deleted for good. Continue?`,
          )}
          confirmLabel={L('Αναίρεση εισαγωγής', 'Undo import')}
          danger
          onConfirm={() => void undo(undoTarget)}
          onClose={() => setUndoTarget(undefined)}
        />
      )}
    </div>
  );
}

const messageOf = (e: unknown) =>
  e instanceof Error ? e.message : String((e as {message?: string} | null)?.message || e);

const PREVIEW_ROWS = 200;

/** The instruments the import will create, to look over before pressing «Εισαγωγή». */
function ToolsPreview({plan, L}: {plan: ImportPlan; L: (el: string, en: string) => string}) {
  const [query, setQuery] = useState('');
  const setNames = useMemo(() => new Map(plan.sets.map(s => [s.id, `${s.barcode} · ${s.name}`])), [plan.sets]);
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      plan.tools.filter(
        t =>
          !q ||
          `${t.barcode} ${t.name} ${t.code} ${t.manufacturer || ''} ${t.department || ''} ${
            t.setId ? setNames.get(t.setId) || '' : ''
          }`
            .toLowerCase()
            .includes(q),
      ),
    [plan.tools, q, setNames],
  );
  if (!plan.tools.length) return null;
  return (
    <section className="asset-import-tools">
      <header>
        <b>
          {L(`Εργαλεία που θα δημιουργηθούν (${plan.tools.length})`, `Instruments to create (${plan.tools.length})`)}
        </b>
        <label className="asset-import-tools-search">
          <Search size={15} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={L('Αναζήτηση ονομασίας, κωδικού, κατασκευαστή…', 'Search name, code, manufacturer…')}
          />
        </label>
      </header>
      <div className="asset-import-tools-table">
        <table>
          <thead>
            <tr>
              <th>Barcode</th>
              <th>{L('Ονομασία', 'Name')}</th>
              <th>{L('Κωδικός', 'Code')}</th>
              <th>{L('Κατασκευαστής', 'Manufacturer')}</th>
              <th>{L('Θέση', 'Place')}</th>
              <th>{L('Όριο χρήσεων', 'Use limit')}</th>
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, PREVIEW_ROWS).map(t => (
              <tr key={t.id}>
                <td className="mono">{t.barcode}</td>
                <td>{t.name}</td>
                <td>{t.code || '—'}</td>
                <td>{t.manufacturer || '—'}</td>
                <td>{t.setId ? setNames.get(t.setId) || L('Σετ', 'Set') : t.department || L('Απόθεμα', 'Stock')}</td>
                <td>{t.maxUses || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <small>
        {shown.length > PREVIEW_ROWS
          ? L(
              `Εμφανίζονται ${PREVIEW_ROWS} από ${shown.length}. Χρησιμοποιήστε την αναζήτηση για τα υπόλοιπα.`,
              `Showing ${PREVIEW_ROWS} of ${shown.length}. Use the search for the rest.`,
            )
          : !shown.length
            ? L('Κανένα εργαλείο δεν ταιριάζει στην αναζήτηση.', 'No instrument matches the search.')
            : L(`${shown.length} εργαλεία.`, `${shown.length} instruments.`)}
      </small>
    </section>
  );
}
