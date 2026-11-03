import {useMemo, useState} from 'react';
import {Download, FileSpreadsheet, X} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import {supabase} from '../../../lib/supabase';
import {readSheetFile} from '../../../core/sheetImport';
import {downloadCsv} from '../../../core/exportTable';
import {formatDate} from '../../../core/displayDate';
import {importErrorText, maskPhone, parseStaffSheet, type StaffRole, type StaffRow} from '../staffImportFile';
import type {PeopleState} from './usePeople';

const ROLES: StaffRole[] = ['DEPARTMENT', 'STERILIZATION', 'VIEWER'];
const BATCH = 25;

type Result = {ok: boolean; userCode?: string; error?: string};
type Answer = {results?: Array<{index: number; ok: boolean; user_code?: string; error?: string}>; deadline?: string};

const problemText = (code: string, el: boolean) =>
  ({
    name: el ? 'όνομα' : 'name',
    role: el ? 'ρόλος' : 'role',
    department: el ? 'τμήμα' : 'department',
    phone: el ? 'κινητό' : 'mobile',
    email: 'email',
  })[code] || code;

/**
 * The platform owner's staff import: upload the hospital's whole list of employees, choose who to activate, and make
 * their accounts. Each person's initial password is their mobile number, replaced at their first sign-in. Never offered
 * to a hospital admin (the screen shows the entry to the owner only, and the server answers the owner only).
 */
export default function StaffImportDialog({s, onClose}: {s: PeopleState; onClose: () => void}) {
  const {L, el, departments, members, organizationId, roleLabel, changed} = s;
  const activeDepartments = useMemo(() => departments.filter(d => d.active), [departments]);
  const [rows, setRows] = useState<StaffRow[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [days, setDays] = useState(7);
  const [fileError, setFileError] = useState('');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Map<number, Result> | null>(null);
  const [deadline, setDeadline] = useState<string | null>(null);

  const existingNames = useMemo(() => new Set(members.map(m => m.name.trim().toLocaleUpperCase('el-GR'))), [members]);

  const openFile = async (file: File) => {
    setFileError('');
    try {
      const sheet = await readSheetFile(file);
      const parsed = parseStaffSheet(sheet, activeDepartments, existingNames);
      if (!parsed.length) {
        setFileError(L('Το αρχείο δεν έχει γραμμές.', 'The file has no rows.'));
        return;
      }
      setRows(parsed);
      setSelected(new Set());
      setResults(null);
    } catch (e) {
      setFileError(
        (e as Error).message === 'xls'
          ? L('Αποθηκεύστε το αρχείο ως .xlsx ή CSV.', 'Save the file as .xlsx or CSV.')
          : L('Το αρχείο δεν διαβάστηκε.', 'The file could not be read.'),
      );
    }
  };

  /** A row after the owner's corrections of its department or role. */
  const edit = (id: number, patch: Partial<Pick<StaffRow, 'departmentId' | 'role'>>) =>
    setRows(current =>
      (current || []).map(r => {
        if (r.id !== id) return r;
        const next = {...r, ...patch};
        const problems = r.problems.filter(p => p !== 'department' && p !== 'role');
        if (next.role !== 'VIEWER' && !next.departmentId) problems.push('department');
        return {...next, problems};
      }),
    );

  const selectable = (r: StaffRow) => !r.existing && r.problems.length === 0;
  const shown = (rows || []).filter(r => {
    if (filterDepartment && r.departmentId !== filterDepartment) return false;
    const q = query.trim().toLocaleUpperCase('el-GR');
    return !q || r.name.includes(q) || r.departmentGiven.toLocaleUpperCase('el-GR').includes(q);
  });
  const shownSelectable = shown.filter(selectable);
  const allShownSelected = shownSelectable.length > 0 && shownSelectable.every(r => selected.has(r.id));
  const toggle = (id: number) =>
    setSelected(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected(current => {
      const next = new Set(current);
      for (const r of shownSelectable) {
        if (allShownSelected) next.delete(r.id);
        else next.add(r.id);
      }
      return next;
    });

  const departmentLabel = (id: string) => activeDepartments.find(d => d.id === id)?.name || '—';
  const chosen = (rows || []).filter(r => selected.has(r.id) && selectable(r));

  const activate = async () => {
    if (!organizationId || !chosen.length || running) return;
    setRunning(true);
    const done = new Map<number, Result>();
    let lastDeadline: string | null = null;
    for (let from = 0; from < chosen.length; from += BATCH) {
      const batch = chosen.slice(from, from + BATCH);
      const {data, error} = await supabase.functions.invoke<Answer>('import-staff', {
        body: {
          organization_id: organizationId,
          deadline_days: days,
          rows: batch.map(r => ({
            full_name: r.name,
            department_id: r.role === 'VIEWER' ? null : r.departmentId,
            role: r.role,
            phone: r.phone,
            email: r.email || undefined,
          })),
        },
      });
      batch.forEach((r, i) => {
        const answer = !error ? data?.results?.find(x => x.index === i) : undefined;
        done.set(
          r.id,
          answer
            ? {ok: answer.ok, userCode: answer.user_code, error: answer.error}
            : {ok: false, error: 'request_failed'},
        );
      });
      lastDeadline = data?.deadline ?? lastDeadline;
      setResults(new Map(done));
    }
    setDeadline(lastDeadline);
    setRunning(false);
    await changed();
  };

  const download = () => {
    if (!results || !rows) return;
    downloadCsv({
      title: L('Νέοι λογαριασμοί', 'New accounts'),
      headers: [L('Ονοματεπώνυμο', 'Name'), L('Τμήμα', 'Department'), L('Όνομα χρήστη', 'Username')],
      rows: rows
        .filter(r => results.get(r.id)?.ok)
        .map(r => [r.name, departmentLabel(r.departmentId), results.get(r.id)?.userCode || '']),
    });
  };

  const made = results ? [...results.values()].filter(r => r.ok).length : 0;
  const skipped = results ? results.size - made : 0;

  return (
    <div className="studio-drawer-backdrop" onMouseDown={e => e.currentTarget === e.target && !running && onClose()}>
      <aside
        className="studio-drawer staff-import"
        role="dialog"
        aria-label={L('Εισαγωγή εργαζομένων', 'Import employees')}
      >
        <header>
          <div>
            <span className="eyebrow">{L('ΙΔΙΟΚΤΗΤΗΣ ΠΛΑΤΦΟΡΜΑΣ', 'PLATFORM OWNER')}</span>
            <h2>{L('Εισαγωγή εργαζομένων', 'Import employees')}</h2>
          </div>
          <button onClick={onClose} disabled={running} aria-label={L('Κλείσιμο', 'Close')}>
            <X />
          </button>
        </header>
        <div className="studio-drawer-form">
          {!rows && (
            <>
              <label className="staff-import-drop">
                <FileSpreadsheet size={22} />
                <b>{L('Επιλέξτε το αρχείο με τους εργαζόμενους', 'Choose the file of employees')}</b>
                <small>
                  {L(
                    'Excel (.xlsx) ή CSV, με στήλες: Ονοματεπώνυμο, Τμήμα, Κινητό (προαιρετικά Email, Ρόλος). Το αρχείο δεν αποθηκεύεται.',
                    'Excel (.xlsx) or CSV with columns: Name, Department, Mobile (optionally Email, Role). The file is not stored.',
                  )}
                </small>
                <input
                  type="file"
                  accept=".xlsx,.csv,text/csv"
                  hidden
                  onChange={e => {
                    if (e.target.files?.[0]) void openFile(e.target.files[0]);
                    e.target.value = '';
                  }}
                />
              </label>
              {fileError && <p className="hospital-empty">{fileError}</p>}
              <p className="staff-import-note">
                {L(
                  'Κάθε εργαζόμενος παίρνει όνομα χρήστη και ως αρχικό κωδικό το κινητό του. Στην πρώτη σύνδεση πρέπει να ορίσει δικό του κωδικό, αλλιώς ο λογαριασμός κλειδώνει μετά την προθεσμία.',
                  'Each employee gets a username and their mobile number as the initial password. At the first sign-in they must choose their own, or the account is locked after the deadline.',
                )}
              </p>
            </>
          )}

          {rows && !results && (
            <>
              <div className="staff-import-tools">
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={L('Αναζήτηση ονόματος ή τμήματος…', 'Search name or department…')}
                  aria-label={L('Αναζήτηση', 'Search')}
                />
                <select
                  value={filterDepartment}
                  onChange={e => setFilterDepartment(e.target.value)}
                  aria-label={L('Φίλτρο τμήματος', 'Department filter')}
                >
                  <option value="">{L('Όλα τα τμήματα', 'All departments')}</option>
                  {activeDepartments.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="staff-import-all">
                <input
                  type="checkbox"
                  checked={allShownSelected}
                  onChange={toggleAll}
                  disabled={!shownSelectable.length}
                />
                <span>
                  {L(
                    `Επιλογή όλων των ορατών (${shownSelectable.length})`,
                    `Select all shown (${shownSelectable.length})`,
                  )}
                </span>
              </label>
              <div className="staff-import-list">
                {shown.map(r => (
                  <div
                    key={r.id}
                    className={`staff-import-row${r.problems.length ? ' error' : ''}${r.existing ? ' existing' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      disabled={!selectable(r)}
                      onChange={() => toggle(r.id)}
                      aria-label={r.name}
                    />
                    <div>
                      <b>{r.name || '—'}</b>
                      <small>
                        {maskPhone(r.phone) || '—'}
                        {r.email && ` · ${r.email}`}
                      </small>
                      {r.existing && <em>{L('Υπάρχει ήδη στο νοσοκομείο', 'Already in the hospital')}</em>}
                      {!r.existing && r.problems.length > 0 && (
                        <em>
                          {L('Λείπει ή δεν ταιριάζει:', 'Missing or invalid:')}{' '}
                          {r.problems.map(p => problemText(p, el)).join(', ')}
                        </em>
                      )}
                    </div>
                    <select
                      value={r.departmentId}
                      disabled={r.existing || r.role === 'VIEWER'}
                      onChange={e => edit(r.id, {departmentId: e.target.value})}
                      aria-label={L(`Τμήμα του ${r.name}`, `Department of ${r.name}`)}
                    >
                      <option value="">
                        {r.departmentGiven ? `? ${r.departmentGiven}` : L('— τμήμα —', '— department —')}
                      </option>
                      {activeDepartments.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={r.role}
                      disabled={r.existing}
                      onChange={e => edit(r.id, {role: e.target.value as StaffRole})}
                      aria-label={L(`Ρόλος του ${r.name}`, `Role of ${r.name}`)}
                    >
                      {ROLES.map(role => (
                        <option key={role} value={role}>
                          {roleLabel(role)}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                {!shown.length && <p className="hospital-empty">{L('Κανένα αποτέλεσμα.', 'No results.')}</p>}
              </div>
              <label className="staff-import-days">
                {L('Προθεσμία πρώτης σύνδεσης (ημέρες)', 'Deadline for the first sign-in (days)')}
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={days}
                  onChange={e => setDays(Number(e.target.value) || 7)}
                />
              </label>
            </>
          )}

          {rows && results && (
            <>
              <p className="staff-import-note">
                {L(
                  `Δημιουργήθηκαν ${made} λογαριασμοί${skipped ? `, δεν δημιουργήθηκαν ${skipped}` : ''}. ${deadline ? `Προθεσμία πρώτης σύνδεσης: ${formatDate(deadline)}. ` : ''}Αρχικός κωδικός: το κινητό του καθενός.`,
                  `${made} accounts made${skipped ? `, ${skipped} not made` : ''}. ${deadline ? `First sign-in deadline: ${formatDate(deadline)}. ` : ''}Initial password: each person's mobile number.`,
                )}
              </p>
              <div className="staff-import-list">
                {rows
                  .filter(r => results.has(r.id))
                  .map(r => {
                    const result = results.get(r.id)!;
                    return (
                      <div key={r.id} className={`staff-import-row${result.ok ? '' : ' error'}`}>
                        <div>
                          <b>{r.name}</b>
                          <small>{departmentLabel(r.departmentId)}</small>
                          {!result.ok && <em>{importErrorText(result.error || '', el)}</em>}
                        </div>
                        <strong className="staff-import-code">{result.userCode || ''}</strong>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </div>
        <footer>
          {!results && rows && (
            <AppButton onClick={() => setRows(null)} disabled={running}>
              {L('Άλλο αρχείο', 'Another file')}
            </AppButton>
          )}
          {results && (
            <AppButton icon={<Download size={16} />} onClick={download}>
              {L('Λήψη ονομάτων χρήστη (CSV)', 'Download usernames (CSV)')}
            </AppButton>
          )}
          <AppButton onClick={onClose} disabled={running}>
            {results ? L('Κλείσιμο', 'Close') : L('Ακύρωση', 'Cancel')}
          </AppButton>
          {rows && !results && (
            <AppButton variant="primary" disabled={running || !chosen.length} onClick={() => void activate()}>
              {running
                ? L('Δημιουργία…', 'Making…')
                : L(`Ενεργοποίηση επιλεγμένων (${chosen.length})`, `Activate selected (${chosen.length})`)}
            </AppButton>
          )}
        </footer>
      </aside>
    </div>
  );
}
