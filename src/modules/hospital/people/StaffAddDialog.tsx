import {useMemo, useState} from 'react';
import {CheckCircle2, X} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import {supabase} from '../../../lib/supabase';
import {cleanStaffName, importErrorText, phonePassword, type StaffRole} from '../staffImportFile';
import type {PeopleState} from './usePeople';

const ROLES: StaffRole[] = ['DEPARTMENT', 'STERILIZATION', 'VIEWER'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Answer = {
  results?: Array<{index: number; ok: boolean; user_code?: string; emailed?: boolean; error?: string}>;
  deadline?: string;
};

/**
 * The platform owner makes one active user directly, as the staff import does for a whole list: a username is made,
 * the initial password is the mobile number, and the person must choose their own at the first sign-in before the
 * deadline. The same server function answers (the owner only), so nothing here is trusted.
 */
export default function StaffAddDialog({s, onClose}: {s: PeopleState; onClose: () => void}) {
  const {L, el, departments, members, organizationId, roleLabel, changed} = s;
  const activeDepartments = useMemo(() => departments.filter(d => d.active), [departments]);
  const [name, setName] = useState('');
  const [role, setRole] = useState<StaffRole>('DEPARTMENT');
  const [departmentId, setDepartmentId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [days, setDays] = useState(7);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [made, setMade] = useState<{userCode: string; emailed: boolean; deadline?: string} | null>(null);

  const existing = useMemo(() => new Set(members.map(m => m.name.trim().toLocaleUpperCase('el-GR'))), [members]);
  const clean = cleanStaffName(name);
  const problems = [
    !clean ? L('Γράψτε το ονοματεπώνυμο.', 'Enter the full name.') : '',
    clean && existing.has(clean)
      ? L('Υπάρχει ήδη χρήστης με αυτό το όνομα.', 'A user with this name already exists.')
      : '',
    role !== 'VIEWER' && !departmentId ? L('Διαλέξτε τμήμα.', 'Choose a department.') : '',
    !phonePassword(phone)
      ? L('Το κινητό δεν είναι έγκυρο (8–15 ψηφία).', 'The mobile number is not valid (8–15 digits).')
      : '',
    email.trim() && !EMAIL.test(email.trim()) ? L('Το email δεν είναι έγκυρο.', 'The email is not valid.') : '',
  ].filter(Boolean);

  const create = async () => {
    if (!organizationId || problems.length || running) return;
    setRunning(true);
    setError('');
    const {data, error: failed} = await supabase.functions.invoke<Answer>('import-staff', {
      body: {
        organization_id: organizationId,
        deadline_days: days,
        send_email: !!email.trim(),
        rows: [
          {
            full_name: clean,
            department_id: role === 'VIEWER' ? null : departmentId,
            role,
            phone,
            email: email.trim() || undefined,
          },
        ],
      },
    });
    setRunning(false);
    const answer = !failed ? data?.results?.find(x => x.index === 0) : undefined;
    if (!answer?.ok || !answer.user_code) {
      setError(importErrorText(answer?.error || 'request_failed', el));
      return;
    }
    setMade({userCode: answer.user_code, emailed: !!answer.emailed, deadline: data?.deadline});
    await changed();
  };
  const another = () => {
    setName('');
    setPhone('');
    setEmail('');
    setMade(null);
    setError('');
  };

  return (
    <div
      className="studio-drawer-backdrop staff-import-backdrop"
      onMouseDown={e => e.currentTarget === e.target && !running && onClose()}
    >
      <aside
        className="studio-drawer staff-import staff-add"
        role="dialog"
        aria-label={L('Νέος ενεργός χρήστης', 'New active user')}
      >
        <header>
          <div>
            <span className="eyebrow">{L('ΙΔΙΟΚΤΗΤΗΣ ΠΛΑΤΦΟΡΜΑΣ', 'PLATFORM OWNER')}</span>
            <h2>{L('Νέος ενεργός χρήστης', 'New active user')}</h2>
          </div>
          <button onClick={onClose} disabled={running} aria-label={L('Κλείσιμο', 'Close')}>
            <X />
          </button>
        </header>
        <div className="studio-drawer-form">
          {made ? (
            <div className="staff-add-done" role="status">
              <CheckCircle2 size={22} />
              <b>{L('Ο χρήστης δημιουργήθηκε.', 'The user was made.')}</b>
              <p>
                {L('Όνομα χρήστη', 'Username')}: <strong>{made.userCode}</strong>
                <br />
                {L(
                  'Αρχικός κωδικός: το κινητό του. Στην πρώτη σύνδεση πρέπει να ορίσει δικό του' +
                    (made.deadline ? ` έως ${made.deadline}` : '') +
                    ', αλλιώς ο λογαριασμός κλειδώνει.',
                  'Initial password: their mobile number. At the first sign-in they must choose their own' +
                    (made.deadline ? ` by ${made.deadline}` : '') +
                    ', or the account is locked.',
                )}
                <br />
                {email.trim()
                  ? made.emailed
                    ? L('Στάλθηκε μήνυμα στο email τους.', 'A message was sent to their email.')
                    : L('Το μήνυμα στο email δεν στάλθηκε.', 'The message to their email was not sent.')
                  : ''}
              </p>
              <div className="staff-add-actions">
                <AppButton onClick={another}>{L('Άλλος χρήστης', 'Another user')}</AppButton>
                <AppButton variant="primary" onClick={onClose}>
                  {L('Κλείσιμο', 'Close')}
                </AppButton>
              </div>
            </div>
          ) : (
            <>
              <label>
                {L('Ονοματεπώνυμο', 'Full name')}
                <input value={name} onChange={e => setName(e.target.value)} autoComplete="off" autoFocus />
              </label>
              <label>
                {L('Ρόλος', 'Role')}
                <select value={role} onChange={e => setRole(e.target.value as StaffRole)}>
                  {ROLES.map(r => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              </label>
              {role !== 'VIEWER' && (
                <label>
                  {L('Τμήμα', 'Department')}
                  <select value={departmentId} onChange={e => setDepartmentId(e.target.value)}>
                    <option value="">{L('— Διαλέξτε —', '— Choose —')}</option>
                    {activeDepartments.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                {L('Κινητό (αρχικός κωδικός)', 'Mobile (initial password)')}
                <input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" autoComplete="off" />
              </label>
              <label>
                {L('Προσωπικό email (προαιρετικό)', 'Personal email (optional)')}
                <input value={email} onChange={e => setEmail(e.target.value)} inputMode="email" autoComplete="off" />
              </label>
              <label>
                {L('Προθεσμία ορισμού δικού του κωδικού (ημέρες)', 'Deadline to choose their own password (days)')}
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={days}
                  onChange={e => setDays(Math.min(30, Math.max(1, Number(e.target.value) || 7)))}
                />
              </label>
              <p className="staff-import-note">
                {L(
                  'Ο χρήστης δημιουργείται ενεργός, με όνομα χρήστη και ως αρχικό κωδικό το κινητό του. Αν δώσετε email, στέλνεται μήνυμα με το όνομα χρήστη και τις οδηγίες (χωρίς σύνδεσμο).',
                  'The user is made active, with a username and their mobile number as the initial password. With an email, a message with the username and the instructions (no link) is sent.',
                )}
              </p>
              {name.trim() || phone.trim() ? (
                <ul className="staff-add-problems" role="status">
                  {problems.map(p => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : null}
              {error && (
                <p className="hospital-empty" role="alert">
                  {error}
                </p>
              )}
              <div className="staff-add-actions">
                <AppButton onClick={onClose} disabled={running}>
                  {L('Ακύρωση', 'Cancel')}
                </AppButton>
                <AppButton variant="primary" onClick={() => void create()} disabled={running || problems.length > 0}>
                  {L('Δημιουργία χρήστη', 'Make the user')}
                </AppButton>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
