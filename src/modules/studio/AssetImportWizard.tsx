import {useEffect, useMemo, useState} from 'react';
import {AlertTriangle, CheckCircle2, Download, FileSpreadsheet, RotateCcw, Upload} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import {downloadXlsx} from '../../core/exportTable';
import {readSheetFile, type SheetRows} from '../../core/sheetImport';
import {getCloudOrganizationId} from '../../data/cloud/appRecords';
import {
  listAssetImports,
  loadHospitalBarcodes,
  runAssetImport,
  undoAssetImport,
  usedImportRecords,
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
  const [organizationId, setOrganizationId] = useState('');
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
      const existingBarcodes = await loadHospitalBarcodes(organizationId);
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
        {sets: plan.sets, tools: plan.tools},
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

  const askUndo = async (item: AssetImport) => {
    setError('');
    try {
      const used = await usedImportRecords(organizationId, item.id);
      if (used) {
        setError(
          L(
            `Η εισαγωγή «${item.fileName}» δεν αναιρείται: ${used} από τα εργαλεία ή Σετ της έχουν ήδη χρησιμοποιηθεί. Διαγράψτε μεμονωμένα όσα δεν χρειάζεστε.`,
            `Import “${item.fileName}” cannot be undone: ${used} of its instruments or Sets have already been used. Delete the ones you do not need one by one.`,
          ),
        );
        return;
      }
      setUndoTarget(item);
    } catch (e) {
      setError(messageOf(e));
    }
  };
  const undo = async (item: AssetImport) => {
    setUndoTarget(undefined);
    setBusy(L('Αναίρεση εισαγωγής…', 'Undoing import…'));
    try {
      await undoAssetImport(organizationId, item.id, byName);
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
            <div className="asset-import-card">
              <FileSpreadsheet size={22} />
              <div>
                <b>{L('1. Κατεβάστε το πρότυπο (προαιρετικό)', '1. Download the template (optional)')}</b>
                <small>
                  {L(
                    'Μπορείτε να ανεβάσετε και δικό σας αρχείο· στο επόμενο βήμα λέτε ποια στήλη είναι τι.',
                    'You can also upload your own file; in the next step you say which column is what.',
                  )}
                </small>
              </div>
              <AppButton onClick={() => downloadXlsx(templateTable(lang))}>
                <Download size={15} />
                {L('Πρότυπο Excel', 'Excel template')}
              </AppButton>
            </div>
            <ul className="asset-import-rules">
              <li>
                {L(
                  'Ίδιο όνομα Σετ σε πολλές γραμμές = ένα Σετ με όλα αυτά τα εργαλεία.',
                  'The same Set name on several rows = one Set with all those instruments.',
                )}
              </li>
              <li>
                {L(
                  'Δύο ίδια Σετ (π.χ. δύο «Βασικό Λαπαροτομίας»): δώστε διαφορετικό όνομα ή barcode Σετ.',
                  'Two identical Sets (e.g. two “Basic laparotomy”): give each its own name or Set barcode.',
                )}
              </li>
              <li>
                {L(
                  'Χωρίς Σετ: μεμονωμένο εργαλείο του τμήματος, ή Stock αν δεν έχει τμήμα.',
                  'No Set: a standalone instrument of the department, or Stock without a department.',
                )}
              </li>
              <li>
                {L(
                  'Ποσότητα 4 = τέσσερα εργαλεία, καθένα με δικό του barcode.',
                  'Quantity 4 = four instruments, each with its own barcode.',
                )}
              </li>
              <li>
                {L(
                  'Τα barcodes που λείπουν δίνονται αυτόματα, συνεχίζοντας την αρίθμηση του νοσοκομείου.',
                  'Missing barcodes are assigned, continuing the hospital’s numbering.',
                )}
              </li>
            </ul>
            <label className={`asset-import-drop${organizationId ? '' : ' disabled'}`}>
              <Upload size={22} />
              <b>
                {organizationId
                  ? L(`2. Επιλέξτε αρχείο για «${organization?.name}»`, `2. Choose a file for “${organization?.name}”`)
                  : L('Επιλέξτε πρώτα νοσοκομείο (πάνω δεξιά)', 'Choose a hospital first (top right)')}
              </b>
              <small>.xlsx · .csv</small>
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
                <span>Stock</span>
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
                        {s.department || 'Stock'} · {L(`${s.expected} εργαλεία`, `${s.expected} instruments`)}
                      </small>
                    </div>
                  ))}
                  {plan.sets.length > 6 && (
                    <small>
                      {L(`…και ${plan.sets.length - 6} ακόμη Σετ.`, `…and ${plan.sets.length - 6} more Sets.`)}
                    </small>
                  )}
                </div>
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
                  <AppButton variant="danger" disabled={Boolean(busy)} onClick={() => void askUndo(item)}>
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
