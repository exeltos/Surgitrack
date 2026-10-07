import {useEffect, useMemo, useState} from 'react';
import {readSheetFile, type SheetRows} from '../../../core/sheetImport';
import {getCloudOrganizationId} from '../../../data/cloud/appRecords';
import {
  listAssetImports,
  loadHospitalAssets,
  runAssetImport,
  undoAssetImport,
  type AssetImport,
} from '../../../data/cloud/assetImports';
import {autoMapping, buildImportPlan, findHeaderRow, type ImportMapping, type ImportPlan} from '../assetImport';
import {cleanName} from '../../../core/nameCheck';
import type {SetAsset, Tool} from '../../../types/domain';

export type Step = 'FILE' | 'MAP' | 'CHECK' | 'DONE';
export const STEPS: Array<{id: Step; el: string; en: string}> = [
  {id: 'FILE', el: 'Αρχείο', en: 'File'},
  {id: 'MAP', el: 'Αντιστοίχιση', en: 'Columns'},
  {id: 'CHECK', el: 'Έλεγχος', en: 'Check'},
  {id: 'DONE', el: 'Εισαγωγή', en: 'Import'},
];
export const SHOWN_ERRORS = 200;

export const messageOf = (e: unknown) =>
  e instanceof Error ? e.message : String((e as {message?: string} | null)?.message || e);

export type ImportProps = {
  lang: 'el' | 'en';
  organizations: Array<{id: string; name: string}>;
  departments: Array<{organizationId: string; name: string; code: string; active: boolean}>;
  byName: string;
};

/** The wizard's state and actions; the step components below read what they need from it. */
export function useAssetImport({lang, organizations, departments, byName}: ImportProps) {
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
      return {lang, ...set, compositionTemplate: [...merged.values()]};
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

  return {
    lang,
    L,
    busy,
    check,
    dataRows,
    dragging,
    error,
    existingNames,
    fileName,
    filledRows,
    final,
    finalName,
    formatDate,
    headerRow,
    headers,
    imports,
    mappedName,
    mapping,
    nameWarnings,
    needsReload,
    openFile,
    organization,
    organizationId,
    plan,
    progress,
    refreshImports,
    reset,
    respelled,
    rows,
    sample,
    setBusy,
    setDragging,
    setError,
    setExistingNames,
    setFileName,
    setHeaderRow,
    setImports,
    setMapping,
    setNeedsReload,
    setOrganizationId,
    setPlan,
    setProgress,
    setRows,
    setStep,
    setUndoTarget,
    setUniform,
    setUseExisting,
    start,
    step,
    stepIndex,
    touchesOpenWorkspace,
    undo,
    undoTarget,
    uniform,
    useExisting,
  };
}

export type ImportState = ReturnType<typeof useAssetImport>;
