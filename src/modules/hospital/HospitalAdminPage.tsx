import {useCallback, useEffect, useState} from 'react';
import {Pencil, Plus, RefreshCw, Save, UserCheck, UserX, X} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import AppButton from '../../components/ui/AppButton';
import SignupLinkCard from './SignupLinkCard';
import {supabase} from '../../lib/supabase';
import {useAppPreferences} from '../../core/AppPreferences';
import {getRealIdentity} from '../../data/cloud/identity';
import {ACCESS_REQUESTS_CHANGED, managedHospitalId} from '../../data/cloud/accessRequests';
import type {UserRole} from '../../store/types';

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
  active: boolean;
  department_id: string | null;
};
type Decision = {role: UserRole; departmentId: string; note: string};

const STERILIZATION_CODE = 'STER';
const roles: Array<{id: UserRole; el: string; en: string}> = [
  {id: 'DEPARTMENT', el: 'Τμήμα', en: 'Department'},
  {id: 'STERILIZATION', el: 'Αποστείρωση', en: 'Sterilization'},
  {id: 'ADMIN', el: 'Διαχειριστής', en: 'Administrator'},
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
  const me = getRealIdentity();
  const [hospital, setHospital] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [newDepartment, setNewDepartment] = useState({name: '', code: ''});
  const [editing, setEditing] = useState<{id: string; name: string; code: string} | null>(null);
  const [notice, setNotice] = useState<{kind: 'ok' | 'error'; text: string} | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const showError = useCallback((text: string) => setNotice({kind: 'error', text}), []);
  const fail = (e: {message?: string} | null | undefined) => {
    if (e) setNotice({kind: 'error', text: e.message || String(e)});
    return !!e;
  };

  const load = useCallback(async () => {
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
        .select('id,name,email,user_code,role,active,department_id')
        .eq('organization_id', organizationId)
        .order('name'),
    ]);
    // Each part shows what it could load; one failing query does not blank the whole page.
    if (org.data) setHospital(org.data.name);
    if (deps.data) setDepartments(deps.data);
    if (reqs.data) setRequests(reqs.data as Request[]);
    if (profiles.data) setMembers(profiles.data as Member[]);
    const error = org.error || deps.error || reqs.error || profiles.error;
    if (error) setNotice({kind: 'error', text: error.message});
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!organizationId)
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

  const departmentName = (id: string | null) => departments.find(d => d.id === id)?.name || '—';
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
      p_department: approve ? d.departmentId || null : null,
      p_note: d.note || null,
    });
    if (!fail(error)) {
      const {data} = await supabase.functions.invoke<{emailed?: boolean}>('access-requests', {
        body: {action: 'notify-decision', request_id: r.id},
      });
      const emailed = !!data?.emailed;
      setNotice({
        kind: 'ok',
        text: approve
          ? L(
              `Ο/Η ${r.full_name} εγκρίθηκε.${emailed ? ' Στάλθηκε email με το όνομα χρήστη.' : ''}`,
              `${r.full_name} was approved.${emailed ? ' An email with the username was sent.' : ''}`,
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
    const {error} = await supabase.from('departments').update({active: !d.active}).eq('id', d.id);
    if (!fail(error)) await load();
  };

  const updateMember = async (m: Member, patch: Partial<Pick<Member, 'role' | 'active' | 'department_id'>>) => {
    const {error} = await supabase.from('profiles').update(patch).eq('id', m.id);
    if (!fail(error)) await load();
  };

  const pending = requests.filter(r => r.status === 'PENDING');
  const unconfirmed = requests.filter(r => r.status === 'PENDING_EMAIL');
  const activeDepartments = departments.filter(d => d.active);
  const date = (iso: string) =>
    new Date(iso).toLocaleString(el ? 'el-GR' : 'en-GB', {dateStyle: 'medium', timeStyle: 'short'});

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
                  <select value={d.departmentId} onChange={e => setDecision(r, {departmentId: e.target.value})}>
                    {activeDepartments.map(dep => (
                      <option key={dep.id} value={dep.id}>
                        {dep.name}
                      </option>
                    ))}
                  </select>
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

        <SignupLinkCard organizationId={organizationId} onError={showError} refreshKey={refreshKey} />

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
                    <b>{d.name}</b>
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
          </div>
          <div className="hospital-rows">
            {members.map(m => {
              const self = m.id === me?.id;
              return (
                <div key={m.id} className="hospital-member">
                  <span>
                    <b>{m.name}</b>
                    <small>{m.email}</small>
                  </span>
                  <code>{m.user_code || '—'}</code>
                  <select
                    value={m.department_id || ''}
                    onChange={e => void updateMember(m, {department_id: e.target.value || null})}
                  >
                    <option value="">—</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={m.role}
                    disabled={self}
                    onChange={e => void updateMember(m, {role: e.target.value as UserRole})}
                  >
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>
                        {el ? role.el : role.en}
                      </option>
                    ))}
                  </select>
                  <button
                    className={`studio-access-toggle ${m.active ? 'active' : ''}`}
                    disabled={self}
                    onClick={() => void updateMember(m, {active: !m.active})}
                  >
                    <span></span>
                    {m.active ? L('Ενεργός', 'Active') : L('Ανενεργός', 'Inactive')}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
