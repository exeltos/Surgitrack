import {useCallback, useEffect, useState} from 'react';
import {Building2, Pencil, Plus, RefreshCw, Save, Trash2, UserCheck, UserX, Users, X} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import AppButton from '../../components/ui/AppButton';
import SignupLinkCard from './SignupLinkCard';
import {supabase} from '../../lib/supabase';
import {useAppPreferences} from '../../core/AppPreferences';
import {localizedName} from '../../core/glossary';
import {getRealIdentity} from '../../data/cloud/identity';
import {getRuntimeDataMode} from '../../config/dataMode';
import {useLibraries} from '../../core/LibraryStore';
import {ACCESS_REQUESTS_CHANGED, managedHospitalId} from '../../data/cloud/accessRequests';
import type {UserRole} from '../../store/types';
import {hospitalRoleNames} from '../../config/demoRoles';

type Department = {id: string; name: string; code: string | null; active: boolean};
type Request = {
  id: string;
  full_name: string;
  email: string;
  status: 'PENDING_EMAIL' | 'PENDING' | 'APPROVED' | 'REJECTED';
  department_id: string | null;
  requested_at: string;
};
type Member = {
  id: string;
  name: string;
  email: string;
  user_code: string | null;
  role: UserRole;
  supervisor: boolean;
  active: boolean;
  department_id: string | null;
};
type Decision = {role: UserRole; departmentId: string; note: string};

const STERILIZATION_CODE = 'STER';
const roles: Array<{id: UserRole; el: string; en: string}> = [
  {id: 'DEPARTMENT', ...hospitalRoleNames.DEPARTMENT},
  {id: 'STERILIZATION', ...hospitalRoleNames.STERILIZATION},
  {id: 'ADMIN', ...hospitalRoleNames.ADMIN},
  {id: 'VIEWER', ...hospitalRoleNames.VIEWER},
];
/** Roles that see the whole hospital rather than one department. */
const wholeHospital = (role: UserRole) => role === 'ADMIN' || role === 'VIEWER';
/** In the users list Sterilization splits into staff and supervisor (who registers assets and changes Sets). */
const SUPERVISOR = 'STERILIZATION_SUPERVISOR';
/** The role as picked in the users list, where a Sterilization supervisor is a role of its own. */
const roleValue = (m: Pick<Member, 'role' | 'supervisor'>) =>
  m.role === 'STERILIZATION' && m.supervisor ? SUPERVISOR : m.role;
const memberRoles = [
  roles[0],
  roles[1],
  {id: SUPERVISOR, ...hospitalRoleNames.STERILIZATION_SUPERVISOR},
  roles[2],
  roles[3],
];

/**
 * Hospital administration for the hospital's own admin (or the platform admin working in it):
 * departments, the 10-day staff signup link, approval of signups, and the hospital's users.
 */
export default function HospitalAdminPage() {
  const {lang} = useAppPreferences();
  const el = lang === 'el';
  const L = (gr: string, en: string) => (el ? gr : en);
  const organizationId = managedHospitalId();
  // In Demo the page works on the Demo hospital's own departments and users, kept in this browser.
  const demo = getRuntimeDataMode() === 'DEMO';
  const libs = useLibraries();
  const me = getRealIdentity();
  const [hospital, setHospital] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [newDepartment, setNewDepartment] = useState({name: '', code: ''});
  const [editing, setEditing] = useState<{id: string; name: string; code: string} | null>(null);
  const [notice, setNotice] = useState<{kind: 'ok' | 'warn' | 'error'; text: string} | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState<'SETUP' | 'USERS'>('SETUP');
  /** The user being edited: every field of a row stays locked until its edit button is pressed. */
  const [memberEdit, setMemberEdit] = useState<Omit<Member, 'user_code'> | null>(null);

  const showError = useCallback((text: string) => setNotice({kind: 'error', text}), []);
  const fail = (e: {message?: string} | null | undefined) => {
    if (e) setNotice({kind: 'error', text: e.message || String(e)});
    return !!e;
  };

  const load = useCallback(async () => {
    if (demo) {
      setHospital(L('Demo νοσοκομείο', 'Demo hospital'));
      setDepartments(
        libs.departments.map(d => ({id: d.id, name: d.el, code: d.code || null, active: d.active !== false})),
      );
      setRequests([]);
      setMembers(
        libs.users.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          user_code: null,
          role: u.role,
          supervisor: u.role === 'STERILIZATION' && !!u.supervisor,
          active: u.active,
          department_id: libs.departments.find(d => d.el === u.department || d.id === u.department)?.id || null,
        })),
      );
      return;
    }
    if (!organizationId) return;
    const [org, deps, reqs, profiles] = await Promise.all([
      supabase.from('organizations').select('name').eq('id', organizationId).single(),
      supabase.from('departments').select('id,name,code,active').eq('organization_id', organizationId).order('name'),
      supabase
        .from('staff_access_requests')
        .select('id,full_name,email,status,department_id,requested_at')
        .eq('organization_id', organizationId)
        .in('status', ['PENDING', 'PENDING_EMAIL'])
        .order('requested_at'),
      supabase
        .from('profiles')
        .select('id,name,email,user_code,role,supervisor,active,department_id')
        .eq('organization_id', organizationId)
        .order('name'),
    ]);
    // Each part shows what it could load; one failing query does not blank the whole page. Requests
    // need the departments (the suggested role and the department picker come from them), so without
    // those they are not shown and cannot be approved.
    if (org.data) setHospital(org.data.name);
    if (deps.data) setDepartments(deps.data);
    setRequests(deps.data && reqs.data ? (reqs.data as Request[]) : []);
    if (profiles.data) setMembers(profiles.data as Member[]);
    const error = org.error || deps.error || reqs.error || profiles.error;
    if (error) setNotice({kind: 'error', text: error.message});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, demo, libs.departments, libs.users, lang]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!organizationId && !demo)
    return (
      <div className="hospital-admin">
        <PageHeader
          title={L('Διαχείριση νοσοκομείου', 'Hospital administration')}
          description={L(
            'Διαθέσιμο μόνο για τον διαχειριστή ενός πραγματικού νοσοκομείου.',
            'Available only to the administrator of a real hospital.',
          )}
        />
      </div>
    );

  const departmentName = (id: string | null) => localizedName(departments.find(d => d.id === id)?.name || '—', lang);
  const suggestedRole = (departmentId: string | null): UserRole =>
    (departments.find(d => d.id === departmentId)?.code || '').toUpperCase() === STERILIZATION_CODE
      ? 'STERILIZATION'
      : 'DEPARTMENT';
  const decisionFor = (r: Request): Decision =>
    decisions[r.id] || {role: suggestedRole(r.department_id), departmentId: r.department_id || '', note: ''};
  const setDecision = (r: Request, patch: Partial<Decision>) =>
    setDecisions(all => ({...all, [r.id]: {...decisionFor(r), ...patch}}));

  const decide = async (r: Request, approve: boolean) => {
    const d = decisionFor(r);
    if (!approve && !window.confirm(L(`Απόρριψη του αιτήματος του ${r.full_name};`, `Reject ${r.full_name}?`))) return;
    setBusy(true);
    setNotice(null);
    const {error} = await supabase.rpc('hospital_decide_access_request', {
      p_request: r.id,
      p_approve: approve,
      p_role: approve ? d.role : null,
      // A hospital admin belongs to no department (the database enforces it too).
      p_department: approve && !wholeHospital(d.role) ? d.departmentId || null : null,
      p_note: d.note || null,
    });
    if (!fail(error)) {
      const {data} = await supabase.functions.invoke<{emailed?: boolean}>('access-requests', {
        body: {action: 'notify-decision', request_id: r.id},
      });
      const emailed = !!data?.emailed;
      // Without email the admin must pass the username on in person.
      let code = '';
      if (approve && !emailed) {
        const {data: profile} = await supabase.from('profiles').select('user_code').eq('email', r.email).maybeSingle();
        code = (profile as {user_code?: string} | null)?.user_code || '';
      }
      setNotice({
        kind: approve && !emailed ? 'warn' : 'ok',
        text: approve
          ? emailed
            ? L(
                `Ο/Η ${r.full_name} εγκρίθηκε. Στάλθηκε email με το όνομα χρήστη.`,
                `${r.full_name} was approved. An email with the username was sent.`,
              )
            : L(
                `Ο/Η ${r.full_name} εγκρίθηκε, αλλά δεν στάλθηκε email. Ενημερώστε τον/την ότι μπορεί να συνδεθεί με όνομα χρήστη ${code || '—'} (ή το email του/της) και τον κωδικό που όρισε.`,
                `${r.full_name} was approved, but no email was sent. Tell them they can sign in with username ${code || '—'} (or their email) and the password they chose.`,
              )
          : L(`Το αίτημα του ${r.full_name} απορρίφθηκε.`, `${r.full_name}'s request was rejected.`),
      });
      window.dispatchEvent(new Event(ACCESS_REQUESTS_CHANGED));
      await load();
    }
    setBusy(false);
  };

  const addDepartment = async () => {
    const name = newDepartment.name.trim();
    if (!name) return;
    if (demo) {
      libs.addItem('departments', {el: name, en: name, code: newDepartment.code.trim().toUpperCase() || undefined});
      setNewDepartment({name: '', code: ''});
      return;
    }
    const {error} = await supabase.from('departments').insert({
      organization_id: organizationId,
      name,
      code: newDepartment.code.trim().toUpperCase() || null,
    });
    if (!fail(error)) {
      setNewDepartment({name: '', code: ''});
      await load();
    }
  };
  const saveDepartment = async () => {
    if (!editing?.name.trim()) return;
    if (demo) {
      libs.updateItem('departments', editing.id, {
        el: editing.name.trim(),
        code: editing.code.trim().toUpperCase() || undefined,
      });
      setEditing(null);
      return;
    }
    const {error} = await supabase
      .from('departments')
      .update({name: editing.name.trim(), code: editing.code.trim().toUpperCase() || null})
      .eq('id', editing.id);
    if (!fail(error)) {
      setEditing(null);
      await load();
    }
  };
  const toggleDepartment = async (d: Department) => {
    if (demo) {
      libs.updateItem('departments', d.id, {active: !d.active});
      return;
    }
    const {error} = await supabase.from('departments').update({active: !d.active}).eq('id', d.id);
    if (!fail(error)) await load();
  };

  const pending = requests.filter(r => r.status === 'PENDING');
  const unconfirmed = requests.filter(r => r.status === 'PENDING_EMAIL');
  const activeDepartments = departments.filter(d => d.active);
  const date = (iso: string) =>
    new Date(iso).toLocaleString(el ? 'el-GR' : 'en-GB', {dateStyle: 'medium', timeStyle: 'short'});

  /** Saves a user's name and sign-in email; the email changes on the sign-in account too. */
  const saveMember = async () => {
    if (!memberEdit) return;
    const name = memberEdit.name.trim();
    const email = memberEdit.email.trim();
    if (!name || !email) return;
    if (demo) {
      const department = wholeHospital(memberEdit.role)
        ? ''
        : departments.find(d => d.id === memberEdit.department_id)?.name || '';
      libs.updateUser(memberEdit.id, {
        name,
        email,
        role: memberEdit.role,
        supervisor: memberEdit.role === 'STERILIZATION' && memberEdit.supervisor,
        active: memberEdit.active,
        department,
      });
      setMemberEdit(null);
      setNotice({kind: 'ok', text: L(`Τα στοιχεία του ${name} αποθηκεύτηκαν.`, `${name}'s details were saved.`)});
      return;
    }
    setBusy(true);
    setNotice(null);
    const {data, error} = await supabase.functions.invoke<{ok?: boolean}>('update-staff', {
      body: {
        user_id: memberEdit.id,
        name,
        email,
        role: memberEdit.role,
        supervisor: memberEdit.supervisor,
        department_id: wholeHospital(memberEdit.role) ? null : memberEdit.department_id,
        active: memberEdit.active,
      },
    });
    setBusy(false);
    if (error || !data?.ok) {
      const status = (error as {context?: {status?: number}} | null)?.context?.status;
      setNotice({
        kind: 'error',
        text:
          status === 409
            ? L('Το email χρησιμοποιείται ήδη από άλλον λογαριασμό.', 'That email is already used by another account.')
            : status === 400
              ? L('Ελέγξτε το ονοματεπώνυμο και το email.', 'Check the name and the email.')
              : L('Οι αλλαγές δεν αποθηκεύτηκαν.', 'The changes were not saved.'),
      });
      return;
    }
    setMemberEdit(null);
    setNotice({kind: 'ok', text: L(`Τα στοιχεία του ${name} αποθηκεύτηκαν.`, `${name}'s details were saved.`)});
    await load();
  };

  /** Deletes the account for good; the history the user left stays. */
  const deleteMember = async (m: Member) => {
    if (
      !window.confirm(
        L(
          `Οριστική διαγραφή του λογαριασμού ${m.name}; Δεν θα μπορεί πλέον να συνδεθεί. Το ιστορικό του παραμένει.`,
          `Delete ${m.name}'s account for good? They will no longer be able to sign in. Their history stays.`,
        ),
      )
    )
      return;
    if (demo) {
      libs.removeUser(m.id);
      setNotice({kind: 'ok', text: L(`Ο λογαριασμός ${m.name} διαγράφηκε.`, `${m.name}'s account was deleted.`)});
      return;
    }
    setBusy(true);
    setNotice(null);
    const {data, error} = await supabase.functions.invoke<{ok?: boolean}>('delete-staff', {body: {user_id: m.id}});
    setBusy(false);
    if (error || !data?.ok) {
      setNotice({
        kind: 'error',
        text: L(`Η διαγραφή του ${m.name} δεν ολοκληρώθηκε.`, `${m.name} could not be deleted.`),
      });
      return;
    }
    setNotice({kind: 'ok', text: L(`Ο λογαριασμός ${m.name} διαγράφηκε.`, `${m.name}'s account was deleted.`)});
    await load();
  };

  return (
    <div className="hospital-admin">
      <PageHeader
        eyebrow={L('ΔΙΑΧΕΙΡΙΣΗ ΝΟΣΟΚΟΜΕΙΟΥ', 'HOSPITAL ADMINISTRATION')}
        title={hospital || L('Νοσοκομείο', 'Hospital')}
        description={L(
          'Τμήματα, σύνδεσμος εγγραφής προσωπικού και έγκριση νέων χρηστών.',
          'Departments, the staff signup link and approval of new users.',
        )}
        actions={
          <AppButton
            onClick={() => {
              setRefreshKey(k => k + 1);
              void load();
            }}
            icon={<RefreshCw size={15} />}
          >
            {L('Ανανέωση', 'Refresh')}
          </AppButton>
        }
      />
      {notice && (
        <div className={`hospital-notice ${notice.kind}`} role="status">
          {notice.text}
          <button onClick={() => setNotice(null)} aria-label={L('Κλείσιμο', 'Close')}>
            <X size={14} />
          </button>
        </div>
      )}

      <div className="hospital-tabs" role="tablist" aria-label={L('Ενότητες', 'Sections')}>
        <button
          role="tab"
          aria-selected={tab === 'SETUP'}
          className={tab === 'SETUP' ? 'active' : ''}
          onClick={() => setTab('SETUP')}
        >
          <Building2 size={16} /> {L('Αιτήματα & τμήματα', 'Requests & departments')}
          {pending.length > 0 && <span className="hospital-count">{pending.length}</span>}
        </button>
        <button
          role="tab"
          aria-selected={tab === 'USERS'}
          className={tab === 'USERS' ? 'active' : ''}
          onClick={() => setTab('USERS')}
        >
          <Users size={16} /> {L('Χρήστες', 'Users')}
          <span className="hospital-count">{members.length}</span>
        </button>
      </div>

      {tab === 'SETUP' && (
        <div className="hospital-grid">
          <section className="hospital-card hospital-requests">
            <header>
              <div>
                <b>{L('Αιτήματα πρόσβασης', 'Access requests')}</b>
                <small>
                  {L(
                    'Επιλέξτε ρόλο και τμήμα και εγκρίνετε. Ο χρήστης λαμβάνει email με το όνομα χρήστη του.',
                    'Pick a role and department, then approve. The user gets an email with their username.',
                  )}
                </small>
              </div>
              <span className="hospital-count">{pending.length}</span>
            </header>
            {pending.length === 0 && (
              <p className="hospital-empty">{L('Δεν υπάρχουν αιτήματα σε αναμονή.', 'No requests waiting.')}</p>
            )}
            {pending.map(r => {
              const d = decisionFor(r);
              return (
                <article key={r.id} className="hospital-request">
                  <div className="hospital-request-who">
                    <strong>{r.full_name}</strong>
                    <small>
                      {r.email} · {L('ζήτησε', 'asked for')} <b>{departmentName(r.department_id)}</b> ·{' '}
                      {date(r.requested_at)}
                    </small>
                  </div>
                  <label>
                    {L('Ρόλος', 'Role')}
                    <select value={d.role} onChange={e => setDecision(r, {role: e.target.value as UserRole})}>
                      {roles.map(role => (
                        <option key={role.id} value={role.id}>
                          {el ? role.el : role.en}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {L('Τμήμα', 'Department')}
                    {wholeHospital(d.role) ? (
                      <span className="hospital-whole">{L('Όλο το νοσοκομείο', 'Whole hospital')}</span>
                    ) : (
                      <select value={d.departmentId} onChange={e => setDecision(r, {departmentId: e.target.value})}>
                        {activeDepartments.map(dep => (
                          <option key={dep.id} value={dep.id}>
                            {localizedName(dep.name, lang)}
                          </option>
                        ))}
                      </select>
                    )}
                  </label>
                  <label className="hospital-request-note">
                    {L('Σχόλιο (προαιρετικό)', 'Note (optional)')}
                    <input value={d.note} onChange={e => setDecision(r, {note: e.target.value})} />
                  </label>
                  <div className="hospital-request-actions">
                    <AppButton
                      variant="primary"
                      disabled={busy}
                      onClick={() => void decide(r, true)}
                      icon={<UserCheck size={15} />}
                    >
                      {L('Έγκριση', 'Approve')}
                    </AppButton>
                    <AppButton
                      variant="danger"
                      disabled={busy}
                      onClick={() => void decide(r, false)}
                      icon={<UserX size={15} />}
                    >
                      {L('Απόρριψη', 'Reject')}
                    </AppButton>
                  </div>
                </article>
              );
            })}
            {unconfirmed.length > 0 && (
              <div className="hospital-unconfirmed">
                <b>{L('Αναμονή επιβεβαίωσης email', 'Awaiting email confirmation')}</b>
                {unconfirmed.map(r => (
                  <span key={r.id}>
                    {r.full_name} · {r.email} · {departmentName(r.department_id)}
                  </span>
                ))}
              </div>
            )}
          </section>

          {organizationId && !demo ? (
            <SignupLinkCard organizationId={organizationId} onError={showError} refreshKey={refreshKey} />
          ) : (
            <section className="hospital-card">
              <p className="hospital-empty">
                {L(
                  'Στο Demo ο σύνδεσμος εγγραφής και τα αιτήματα πρόσβασης δεν είναι διαθέσιμα. Τμήματα και χρήστες αλλάζουν κανονικά, μόνο σε αυτό τον browser.',
                  'In Demo the signup link and access requests are not available. Departments and users change as usual, in this browser only.',
                )}
              </p>
            </section>
          )}

          <section className="hospital-card hospital-departments-card">
            <header>
              <div>
                <b>{L('Τμήματα', 'Departments')}</b>
                <small>
                  {L(
                    'Εμφανίζονται στη φόρμα εγγραφής και σε Σετ, εργαλεία και ιχνηλασιμότητα. Ο κωδικός STER δηλώνει την Αποστείρωση.',
                    'Shown on the signup form and across sets, instruments and traceability. Code STER marks Sterilization.',
                  )}
                </small>
              </div>
              <span className="hospital-count">{activeDepartments.length}</span>
            </header>
            <div className="hospital-department-add">
              <input
                value={newDepartment.name}
                onChange={e => setNewDepartment(v => ({...v, name: e.target.value}))}
                placeholder={L('Όνομα τμήματος', 'Department name')}
              />
              <input
                value={newDepartment.code}
                onChange={e => setNewDepartment(v => ({...v, code: e.target.value}))}
                placeholder={L('Κωδικός', 'Code')}
              />
              <AppButton
                variant="primary"
                disabled={!newDepartment.name.trim()}
                onClick={() => void addDepartment()}
                icon={<Plus size={15} />}
              >
                {L('Προσθήκη', 'Add')}
              </AppButton>
            </div>
            <div className="hospital-rows">
              {departments.map(d =>
                editing?.id === d.id ? (
                  <div key={d.id} className="hospital-row editing">
                    <input value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} />
                    <input value={editing.code} onChange={e => setEditing({...editing, code: e.target.value})} />
                    <button onClick={() => void saveDepartment()} aria-label={L('Αποθήκευση', 'Save')}>
                      <Save size={14} />
                    </button>
                    <button onClick={() => setEditing(null)} aria-label={L('Ακύρωση', 'Cancel')}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div key={d.id} className={`hospital-row ${d.active ? '' : 'inactive'}`}>
                    <span>
                      <b>{localizedName(d.name, lang)}</b>
                      <small>{d.code || '—'}</small>
                    </span>
                    <button
                      className={`studio-access-toggle ${d.active ? 'active' : ''}`}
                      onClick={() => void toggleDepartment(d)}
                    >
                      <span></span>
                      {d.active ? L('Ενεργό', 'Active') : L('Ανενεργό', 'Inactive')}
                    </button>
                    <button
                      onClick={() => setEditing({id: d.id, name: d.name, code: d.code || ''})}
                      aria-label={L('Επεξεργασία', 'Edit')}
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                ),
              )}
            </div>
          </section>
        </div>
      )}

      {tab === 'USERS' && (
        <div className="hospital-grid">
          <section className="hospital-card hospital-members">
            <header>
              <div>
                <b>{L('Χρήστες νοσοκομείου', 'Hospital users')}</b>
                <small>
                  {L(
                    'Όνομα χρήστη, τμήμα, ρόλος και πρόσβαση κάθε χρήστη.',
                    'Username, department, role and access of each user.',
                  )}
                </small>
              </div>
              <span className="hospital-count">{members.length}</span>
            </header>
            <div className="hospital-member-head">
              <span>{L('Χρήστης', 'User')}</span>
              <span>{L('Όνομα χρήστη', 'Username')}</span>
              <span>{L('Τμήμα', 'Department')}</span>
              <span>{L('Ρόλος', 'Role')}</span>
              <span>{L('Πρόσβαση', 'Access')}</span>
              <span></span>
            </div>
            <div className="hospital-rows">
              {members.map(m => {
                const self = m.id === me?.id;
                const editingMember = memberEdit?.id === m.id ? memberEdit : null;
                return (
                  <div key={m.id} className={`hospital-member${editingMember ? ' editing' : ''}`}>
                    {editingMember ? (
                      <span className="hospital-member-edit">
                        <input
                          value={editingMember.name}
                          onChange={e => setMemberEdit({...editingMember, name: e.target.value})}
                          placeholder={L('Ονοματεπώνυμο', 'Full name')}
                          aria-label={L('Ονοματεπώνυμο', 'Full name')}
                          maxLength={120}
                          autoFocus
                        />
                        <input
                          type="email"
                          value={editingMember.email}
                          onChange={e => setMemberEdit({...editingMember, email: e.target.value})}
                          onKeyDown={e => e.key === 'Enter' && void saveMember()}
                          placeholder="email"
                          aria-label="Email"
                        />
                      </span>
                    ) : (
                      <span>
                        <b>{m.name}</b>
                        <small>{m.email}</small>
                      </span>
                    )}
                    <code>{m.user_code || '—'}</code>
                    {editingMember ? (
                      <>
                        {wholeHospital(editingMember.role) ? (
                          <span className="hospital-whole">{L('Όλο το νοσοκομείο', 'Whole hospital')}</span>
                        ) : (
                          <select
                            value={editingMember.department_id || ''}
                            onChange={e => setMemberEdit({...editingMember, department_id: e.target.value || null})}
                            aria-label={L('Τμήμα', 'Department')}
                          >
                            <option value="">—</option>
                            {departments.map(d => (
                              <option key={d.id} value={d.id}>
                                {localizedName(d.name, lang)}
                              </option>
                            ))}
                          </select>
                        )}
                        <select
                          value={roleValue(editingMember)}
                          disabled={self}
                          aria-label={L('Ρόλος', 'Role')}
                          onChange={e =>
                            setMemberEdit({
                              ...editingMember,
                              ...(e.target.value === SUPERVISOR
                                ? {role: 'STERILIZATION', supervisor: true}
                                : {role: e.target.value as UserRole, supervisor: false}),
                            })
                          }
                        >
                          {memberRoles.map(role => (
                            <option key={role.id} value={role.id}>
                              {el ? role.el : role.en}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className={`studio-access-toggle ${editingMember.active ? 'active' : ''}`}
                          disabled={self}
                          onClick={() => setMemberEdit({...editingMember, active: !editingMember.active})}
                        >
                          <span></span>
                          {editingMember.active ? L('Ενεργός', 'Active') : L('Ανενεργός', 'Inactive')}
                        </button>
                      </>
                    ) : (
                      <>
                        <span className={`hospital-member-value${wholeHospital(m.role) ? ' whole' : ''}`}>
                          {wholeHospital(m.role)
                            ? L('Όλο το νοσοκομείο', 'Whole hospital')
                            : localizedName(departments.find(d => d.id === m.department_id)?.name || '—', lang)}
                        </span>
                        <span className="hospital-member-value">
                          {(() => {
                            const role = memberRoles.find(r => r.id === roleValue(m));
                            return role ? (el ? role.el : role.en) : m.role;
                          })()}
                        </span>
                        <span className={`hospital-member-status ${m.active ? 'active' : ''}`}>
                          <i></i>
                          {m.active ? L('Ενεργός', 'Active') : L('Ανενεργός', 'Inactive')}
                        </span>
                      </>
                    )}
                    <span className="hospital-member-actions">
                      {editingMember ? (
                        <>
                          <button
                            type="button"
                            className="hospital-member-icon"
                            disabled={busy || !editingMember.name.trim() || !editingMember.email.trim()}
                            onClick={() => void saveMember()}
                            aria-label={L('Αποθήκευση', 'Save')}
                            title={L('Αποθήκευση', 'Save')}
                          >
                            <Save size={15} />
                          </button>
                          <button
                            type="button"
                            className="hospital-member-icon"
                            onClick={() => setMemberEdit(null)}
                            aria-label={L('Ακύρωση', 'Cancel')}
                            title={L('Ακύρωση', 'Cancel')}
                          >
                            <X size={15} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="hospital-member-icon"
                            disabled={busy}
                            onClick={() => {
                              const {user_code: _code, ...draft} = m;
                              void _code;
                              setMemberEdit({...draft, email: m.email || ''});
                            }}
                            aria-label={L(`Επεξεργασία ${m.name}`, `Edit ${m.name}`)}
                            title={L('Επεξεργασία στοιχείων', 'Edit details')}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className="hospital-member-delete"
                            disabled={self || busy}
                            title={
                              self
                                ? L('Δεν διαγράφετε τον δικό σας λογαριασμό', 'You cannot delete your own account')
                                : L('Οριστική διαγραφή', 'Delete for good')
                            }
                            aria-label={L(`Διαγραφή ${m.name}`, `Delete ${m.name}`)}
                            onClick={() => void deleteMember(m)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
