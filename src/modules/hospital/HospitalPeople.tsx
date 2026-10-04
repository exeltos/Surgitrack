import {useCallback, useEffect, useState} from 'react';
import {
  Building2,
  ChevronRight,
  FileSpreadsheet,
  Link2,
  Lock,
  Mail,
  Pencil,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import SignupLinkCard from './SignupLinkCard';
import {supabase} from '../../lib/supabase';
import {useAppPreferences} from '../../core/AppPreferences';
import {localizedName} from '../../core/glossary';
import {getRealIdentity} from '../../data/cloud/identity';
import {getRuntimeDataMode} from '../../config/dataMode';
import {useLibraries} from '../../core/LibraryStore';
import {ACCESS_REQUESTS_CHANGED} from '../../data/cloud/accessRequests';
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
  demo_enabled: boolean;
};
type Decision = {role: UserRole; departmentId: string; note: string};
/** What the drawer edits: the role as picked (a Sterilization supervisor is a role of its own here). */
type Draft = {
  name: string;
  email: string;
  role: string;
  departmentId: string;
  active: boolean;
  demoEnabled: boolean;
};
type CsvRow = {name: string; email: string; role: string; departmentId: string; department: string; error?: string};

const STERILIZATION_CODE = 'STER';
const SUPERVISOR = 'STERILIZATION_SUPERVISOR';
const roles: Array<{id: string; el: string; en: string}> = [
  {id: 'DEPARTMENT', ...hospitalRoleNames.DEPARTMENT},
  {id: 'STERILIZATION', ...hospitalRoleNames.STERILIZATION},
  {id: SUPERVISOR, ...hospitalRoleNames.STERILIZATION_SUPERVISOR},
  {id: 'ADMIN', ...hospitalRoleNames.ADMIN},
  {id: 'VIEWER', ...hospitalRoleNames.VIEWER},
];
/** Roles that see the whole hospital rather than one department. */
const wholeHospital = (role: string) => role === 'ADMIN' || role === 'VIEWER';
const roleValue = (m: Pick<Member, 'role' | 'supervisor'>) =>
  m.role === 'STERILIZATION' && m.supervisor ? SUPERVISOR : m.role;
const accountRole = (role: string) => (role === SUPERVISOR ? 'STERILIZATION' : role) as UserRole;
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A hospital's people, the same for its admin (Διαχείριση νοσοκομείου) and for the platform owner
 * (Studio → Χρήστες): the users list, invitations (by email, signup link or CSV file), the signups
 * waiting for approval, and the departments. A user changes only through the side drawer.
 */
export default function HospitalPeople({
  organizationId,
  platform = false,
  hospitalDemo = false,
  refreshKey = 0,
  onChanged,
}: {
  organizationId?: string;
  /** The platform owner: may also give Demo access. */
  platform?: boolean;
  /** The hospital opens Demo, so its users may get Demo access. */
  hospitalDemo?: boolean;
  refreshKey?: number;
  onChanged?: () => void;
}) {
  const {lang} = useAppPreferences();
  const el = lang === 'el';
  const L = (gr: string, en: string) => (el ? gr : en);
  const demo = getRuntimeDataMode() === 'DEMO';
  const libs = useLibraries();
  const me = getRealIdentity();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [newDepartment, setNewDepartment] = useState({name: '', code: ''});
  const [editing, setEditing] = useState<{id: string; name: string; code: string} | null>(null);
  const [notice, setNotice] = useState<{kind: 'ok' | 'warn' | 'error'; text: string} | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'USERS' | 'DEPARTMENTS'>('USERS');
  const [query, setQuery] = useState('');
  const [inviteMenu, setInviteMenu] = useState(false);
  const [drawer, setDrawer] = useState<{member: Member | null} | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<CsvRow[] | null>(null);
  /** Invitations sent and not accepted yet, by email: when each was last sent. */
  const [invitations, setInvitations] = useState<Record<string, string>>({});

  const showError = useCallback((text: string) => setNotice({kind: 'error', text}), []);
  const fail = (e: {message?: string} | null | undefined) => {
    if (e) setNotice({kind: 'error', text: e.message || String(e)});
    return !!e;
  };

  const load = useCallback(async () => {
    if (demo) {
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
          demo_enabled: u.demoEnabled,
        })),
      );
      return;
    }
    if (!organizationId) return;
    const [deps, reqs, profiles, invites] = await Promise.all([
      supabase.from('departments').select('id,name,code,active').eq('organization_id', organizationId).order('name'),
      supabase
        .from('staff_access_requests')
        .select('id,full_name,email,status,department_id,requested_at')
        .eq('organization_id', organizationId)
        .in('status', ['PENDING', 'PENDING_EMAIL'])
        .order('requested_at'),
      supabase
        .from('profiles')
        .select('id,name,email,user_code,role,supervisor,active,department_id,demo_enabled')
        .eq('organization_id', organizationId)
        .order('name'),
      supabase
        .from('user_invitations')
        .select('email,last_sent_at,invited_at')
        .eq('organization_id', organizationId)
        .eq('status', 'SENT'),
    ]);
    // Each part shows what it could load. Requests need the departments (the suggested role and the
    // department picker come from them), so without those they are not shown.
    if (deps.data) setDepartments(deps.data);
    setRequests(deps.data && reqs.data ? (reqs.data as Request[]) : []);
    if (profiles.data) setMembers(profiles.data as Member[]);
    const sent = (invites.data || []) as Array<{email: string; last_sent_at: string | null; invited_at: string | null}>;
    setInvitations(Object.fromEntries(sent.map(i => [i.email.toLowerCase(), i.last_sent_at || i.invited_at || ''])));
    const error = deps.error || reqs.error || profiles.error;
    if (error) setNotice({kind: 'error', text: error.message});
  }, [organizationId, demo, libs.departments, libs.users]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  /** After a change: this list reloads, and so does whatever shows counts around it. */
  const changed = async () => {
    await load();
    onChanged?.();
  };

  const departmentName = (id: string | null) => localizedName(departments.find(d => d.id === id)?.name || '—', lang);
  /** An invited user who has not accepted yet: the account stays inactive until they do. */
  const invitedAt = (m: Member) => (m.active ? undefined : invitations[m.email.toLowerCase()]);
  const roleLabel = (id: string) => {
    const role = roles.find(r => r.id === id);
    return role ? (el ? role.el : role.en) : id;
  };
  const activeDepartments = departments.filter(d => d.active);
  const pending = requests.filter(r => r.status === 'PENDING');
  const unconfirmed = requests.filter(r => r.status === 'PENDING_EMAIL');
  const date = (iso: string) =>
    new Date(iso).toLocaleString(el ? 'el-GR' : 'en-GB', {dateStyle: 'medium', timeStyle: 'short'});

  // ---- Signups waiting for approval ----
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
      await changed();
    }
    setBusy(false);
  };

  // ---- Departments ----
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
      await changed();
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
      await changed();
    }
  };
  const toggleDepartment = async (d: Department) => {
    if (demo) {
      libs.updateItem('departments', d.id, {active: !d.active});
      return;
    }
    const {error} = await supabase.from('departments').update({active: !d.active}).eq('id', d.id);
    if (!fail(error)) await changed();
  };

  // ---- Users ----
  const departmentLabel = (role: string, departmentId: string) =>
    wholeHospital(role) ? '' : departments.find(d => d.id === departmentId)?.name || '';

  /** Invites one person by email: they get a link to set their own password. */
  const invite = async (draft: Draft, again = false) => {
    const role = accountRole(draft.role);
    const supervisor = draft.role === SUPERVISOR;
    if (demo) {
      libs.addUser({
        name: draft.name,
        email: draft.email,
        role,
        supervisor,
        department: departmentLabel(draft.role, draft.departmentId),
        active: true,
        organizationId: organizationId || '',
        demoEnabled: role === 'ADMIN' || draft.demoEnabled,
      });
      setDrawer(null);
      setNotice({kind: 'ok', text: L(`Ο/Η ${draft.name} προστέθηκε.`, `${draft.name} was added.`)});
      return;
    }
    setBusy(true);
    setNotice(null);
    const {data: result, error} = await supabase.functions.invoke('invite-staff', {
      body: {
        users: [
          {
            full_name: draft.name,
            email: draft.email,
            organization_id: organizationId,
            department_id: wholeHospital(role) ? null : draft.departmentId || null,
            role,
          },
        ],
        redirect_to: window.location.origin,
      },
    });
    const sent = !error && result?.results?.[0]?.ok;
    if (sent && (supervisor || (platform && draft.demoEnabled))) {
      // The invitation knows only the role; the supervisor flag and Demo access follow on the account.
      const {data: profile} = await supabase
        .from('profiles')
        .select('id')
        .eq('organization_id', organizationId)
        .ilike('email', draft.email.trim().replace(/[\\%_]/g, '\\$&'))
        .maybeSingle();
      if (profile)
        await supabase.functions.invoke('update-staff', {
          body: {
            user_id: (profile as {id: string}).id,
            name: draft.name,
            email: draft.email,
            supervisor,
            ...(platform ? {demo_enabled: draft.demoEnabled} : {}),
          },
        });
    }
    setBusy(false);
    if (!sent) {
      const reason = String(result?.results?.[0]?.error || error?.message || '');
      setNotice({
        kind: 'error',
        text: /already|registered|exists/i.test(reason)
          ? L(
              `Το ${draft.email} έχει ήδη λογαριασμό που έχει ενεργοποιηθεί. Δεν χρειάζεται πρόσκληση.`,
              `${draft.email} already has an activated account. No invitation is needed.`,
            )
          : L(`Η πρόσκληση δεν στάλθηκε: ${reason}`, `The invitation was not sent: ${reason}`),
      });
      return;
    }
    setDrawer(null);
    setNotice({
      kind: 'ok',
      text: again
        ? L(
            `Η πρόσκληση στάλθηκε ξανά στο ${draft.email}. Ζητήστε να ελέγξει και τα ανεπιθύμητα (spam).`,
            `The invitation was sent again to ${draft.email}. Ask them to check their spam folder too.`,
          )
        : L(
            `Στάλθηκε πρόσκληση στο ${draft.email}. Ο/Η ${draft.name} ορίζει κωδικό από το email και μπαίνει.`,
            `An invitation was sent to ${draft.email}. ${draft.name} sets a password from the email and signs in.`,
          ),
    });
    await changed();
  };

  /** Saves an existing user: name, sign-in email, role, department, access (and Demo, for the owner). */
  const save = async (member: Member, draft: Draft) => {
    const role = accountRole(draft.role);
    const supervisor = draft.role === SUPERVISOR;
    if (demo) {
      libs.updateUser(member.id, {
        name: draft.name,
        email: draft.email,
        role,
        supervisor,
        active: draft.active,
        department: departmentLabel(draft.role, draft.departmentId),
        demoEnabled: role === 'ADMIN' || draft.demoEnabled,
      });
      setDrawer(null);
      setNotice({
        kind: 'ok',
        text: L(`Τα στοιχεία του ${draft.name} αποθηκεύτηκαν.`, `${draft.name}'s details were saved.`),
      });
      return;
    }
    setBusy(true);
    setNotice(null);
    const {data, error} = await supabase.functions.invoke<{ok?: boolean}>('update-staff', {
      body: {
        user_id: member.id,
        name: draft.name,
        email: draft.email,
        role,
        supervisor,
        department_id: wholeHospital(role) ? null : draft.departmentId || null,
        active: draft.active,
        ...(platform ? {demo_enabled: draft.demoEnabled} : {}),
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
    setDrawer(null);
    setNotice({
      kind: 'ok',
      text: L(`Τα στοιχεία του ${draft.name} αποθηκεύτηκαν.`, `${draft.name}'s details were saved.`),
    });
    await changed();
  };

  /** Deletes the account for good; the history the user left stays. */
  const remove = async (m: Member) => {
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
      setDrawer(null);
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
    setDrawer(null);
    setNotice({kind: 'ok', text: L(`Ο λογαριασμός ${m.name} διαγράφηκε.`, `${m.name}'s account was deleted.`)});
    await changed();
  };

  // ---- Invitations from a CSV file: Ονοματεπώνυμο; Email; Τμήμα; Ρόλος ----
  const readCsv = async (file: File) => {
    const lines = (await file.text())
      .split(/\r?\n/)
      .map(x => x.trim())
      .filter(Boolean);
    const rows = lines.slice(1).map(line => {
      const [name = '', email = '', department = '', roleRaw = ''] = line
        .split(/[;,]/)
        .map(x => x.trim().replace(/^"|"$/g, ''));
      const raw = roleRaw.trim().toUpperCase();
      const role =
        roles.find(r => r.id === raw || r.el.toUpperCase() === raw || r.en.toUpperCase() === raw)?.id || 'DEPARTMENT';
      const dep = departments.find(
        d =>
          d.active &&
          ((d.code || '').toLowerCase() === department.toLowerCase() ||
            d.name.toLowerCase() === department.toLowerCase()),
      );
      const error =
        name.length < 2 || !EMAIL_FORMAT.test(email)
          ? L('Μη έγκυρο όνομα ή email', 'Invalid name or email')
          : !wholeHospital(role) && !dep
            ? L('Άγνωστο τμήμα', 'Unknown department')
            : undefined;
      return {name, email, role, departmentId: dep?.id || '', department, error};
    });
    setCsvRows(rows);
  };
  const sendCsv = async () => {
    if (!csvRows?.length || csvRows.some(r => r.error)) return;
    setBusy(true);
    setNotice(null);
    const {data: result, error} = await supabase.functions.invoke('invite-staff', {
      body: {
        users: csvRows.map(r => ({
          full_name: r.name,
          email: r.email,
          organization_id: organizationId,
          department_id: wholeHospital(r.role) ? null : r.departmentId || null,
          role: accountRole(r.role),
        })),
        redirect_to: window.location.origin,
      },
    });
    setBusy(false);
    if (error) {
      setNotice({kind: 'error', text: error.message});
      return;
    }
    const failed = (result?.results || []).filter((x: {ok: boolean}) => !x.ok).length;
    const sent = csvRows.length - failed;
    setNotice({
      kind: failed ? 'warn' : 'ok',
      text: failed
        ? L(`Στάλθηκαν ${sent} προσκλήσεις, ${failed} απέτυχαν.`, `${sent} invitations sent, ${failed} failed.`)
        : L(`Στάλθηκαν ${sent} προσκλήσεις.`, `${sent} invitations sent.`),
    });
    if (!failed) setCsvRows(null);
    await changed();
  };

  if (!organizationId && !demo) return null;

  const q = query.trim().toLowerCase();
  const shown = members.filter(
    m =>
      !q ||
      `${m.name} ${m.email} ${m.user_code || ''} ${roleLabel(roleValue(m))} ${departmentName(m.department_id)}`
        .toLowerCase()
        .includes(q),
  );

  return (
    <div className="hospital-people">
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
          aria-selected={tab === 'USERS'}
          className={tab === 'USERS' ? 'active' : ''}
          onClick={() => setTab('USERS')}
        >
          <Users size={16} /> {L('Χρήστες', 'Users')}
          <span className="hospital-count">{members.length}</span>
          {pending.length > 0 && <span className="hospital-count attention">{pending.length}</span>}
        </button>
        <button
          role="tab"
          aria-selected={tab === 'DEPARTMENTS'}
          className={tab === 'DEPARTMENTS' ? 'active' : ''}
          onClick={() => setTab('DEPARTMENTS')}
        >
          <Building2 size={16} /> {L('Τμήματα', 'Departments')}
          <span className="hospital-count">{activeDepartments.length}</span>
        </button>
      </div>

      {tab === 'USERS' && (
        <section className="hospital-card hospital-members">
          <div className="people-toolbar">
            <div className="studio-search">
              <Search size={17} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={L(
                  'Αναζήτηση ονόματος, email, τμήματος ή ρόλου…',
                  'Search name, email, department or role…',
                )}
              />
            </div>
            <div className="people-invite">
              <AppButton variant="primary" icon={<UserPlus size={16} />} onClick={() => setInviteMenu(v => !v)}>
                {L('Πρόσκληση', 'Invite')}
              </AppButton>
              {inviteMenu && (
                <div className="people-invite-menu" role="menu" onMouseLeave={() => setInviteMenu(false)}>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setInviteMenu(false);
                      setDrawer({member: null});
                    }}
                  >
                    <Mail size={16} />
                    <span>
                      <b>{L('Με email', 'By email')}</b>
                      <small>
                        {L(
                          'Ένα άτομο: παίρνει email και ορίζει κωδικό.',
                          'One person: gets an email, sets a password.',
                        )}
                      </small>
                    </span>
                  </button>
                  {!demo && (
                    <button
                      role="menuitem"
                      onClick={() => {
                        setInviteMenu(false);
                        setLinkOpen(true);
                      }}
                    >
                      <Link2 size={16} />
                      <span>
                        <b>{L('Σύνδεσμος εγγραφής', 'Signup link')}</b>
                        <small>
                          {L('Για πολλούς: κάνουν εγγραφή και τους εγκρίνετε.', 'For many: they sign up, you approve.')}
                        </small>
                      </span>
                    </button>
                  )}
                  {!demo && (
                    <label role="menuitem" className="people-invite-file">
                      <FileSpreadsheet size={16} />
                      <span>
                        <b>{L('Από αρχείο CSV', 'From a CSV file')}</b>
                        <small>{L('Ονοματεπώνυμο; Email; Τμήμα; Ρόλος', 'Name; Email; Department; Role')}</small>
                      </span>
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        hidden
                        onChange={e => {
                          setInviteMenu(false);
                          if (e.target.files?.[0]) void readCsv(e.target.files[0]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          </div>

          {pending.length > 0 && (
            <div className="people-requests">
              <header>
                <UserCheck size={17} />
                <b>
                  {L(
                    `${pending.length} ${pending.length === 1 ? 'αίτημα περιμένει' : 'αιτήματα περιμένουν'} έγκριση`,
                    `${pending.length} ${pending.length === 1 ? 'request awaits' : 'requests await'} approval`,
                  )}
                </b>
                <small>
                  {L(
                    'Επιλέξτε ρόλο και τμήμα και εγκρίνετε. Ο χρήστης λαμβάνει email με το όνομα χρήστη του.',
                    'Pick a role and department, then approve. The user gets an email with their username.',
                  )}
                </small>
              </header>
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
                        {roles
                          .filter(role => role.id !== SUPERVISOR)
                          .map(role => (
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
            </div>
          )}
          {unconfirmed.length > 0 && (
            <div className="hospital-unconfirmed">
              <b>
                {L(
                  'Εγγραφές που δεν επιβεβαίωσαν ακόμα το email τους',
                  'Signups that have not confirmed their email yet',
                )}
              </b>
              {unconfirmed.map(r => (
                <span key={r.id}>
                  {r.full_name} · {r.email} · {departmentName(r.department_id)}
                </span>
              ))}
            </div>
          )}

          <div className="people-head">
            <span>{L('Χρήστης', 'User')}</span>
            <span>{L('Όνομα χρήστη', 'Username')}</span>
            <span>{L('Τμήμα', 'Department')}</span>
            <span>{L('Ρόλος', 'Role')}</span>
            <span>{L('Πρόσβαση', 'Access')}</span>
            <span></span>
          </div>
          <div className="people-rows">
            {shown.length === 0 && (
              <div className="hospital-users-empty">
                <Users size={22} />
                <strong>
                  {q
                    ? L('Κανένας χρήστης δεν ταιριάζει στην αναζήτηση.', 'No user matches the search.')
                    : L('Δεν υπάρχουν χρήστες ακόμα.', 'No users yet.')}
                </strong>
                {!q && (
                  <small>
                    {L('Πατήστε «Πρόσκληση» για να προσθέσετε τον πρώτο.', 'Press «Invite» to add the first one.')}
                  </small>
                )}
              </div>
            )}
            {shown.map(m => {
              // Your own account is changed by another admin (or the platform owner), never by you.
              const self = m.id === me?.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`people-row${self ? ' self' : ''}`}
                  disabled={self}
                  title={
                    self
                      ? L(
                          'Τον δικό σας λογαριασμό τον αλλάζει άλλος διαχειριστής.',
                          'Another admin changes your own account.',
                        )
                      : undefined
                  }
                  onClick={() => setDrawer({member: m})}
                >
                  <span className="people-who">
                    <b>
                      {m.name}
                      {self && <em className="people-you">{L('Εσείς', 'You')}</em>}
                    </b>
                    <small>{m.email}</small>
                  </span>
                  <code>{m.user_code || '—'}</code>
                  <span className={`people-value${wholeHospital(m.role) ? ' whole' : ''}`}>
                    {wholeHospital(m.role) ? L('Όλο το νοσοκομείο', 'Whole hospital') : departmentName(m.department_id)}
                  </span>
                  <span className="people-value">{roleLabel(roleValue(m))}</span>
                  {invitedAt(m) !== undefined ? (
                    <span className="hospital-member-status invited">
                      <i></i>
                      {L('Εκκρεμεί πρόσκληση', 'Invitation pending')}
                    </span>
                  ) : (
                    <span className={`hospital-member-status ${m.active ? 'active' : ''}`}>
                      <i></i>
                      {m.active ? L('Ενεργός', 'Active') : L('Ανενεργός', 'Inactive')}
                    </span>
                  )}
                  {self ? (
                    <Lock size={15} className="people-open" />
                  ) : (
                    <ChevronRight size={16} className="people-open" />
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {tab === 'DEPARTMENTS' && (
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
      )}

      {drawer && (
        <MemberDrawer
          member={drawer.member}
          self={!!drawer.member && drawer.member.id === me?.id}
          departments={activeDepartments}
          showDemo={platform && hospitalDemo}
          invitedAt={drawer.member ? invitedAt(drawer.member) : undefined}
          onResend={draft => void invite(draft, true)}
          busy={busy}
          L={L}
          lang={lang}
          onClose={() => setDrawer(null)}
          onSave={draft => void (drawer.member ? save(drawer.member, draft) : invite(draft))}
          onDelete={() => drawer.member && void remove(drawer.member)}
        />
      )}

      {linkOpen && organizationId && (
        <div className="studio-drawer-backdrop" onMouseDown={e => e.currentTarget === e.target && setLinkOpen(false)}>
          <aside className="studio-drawer">
            <header>
              <div>
                <span className="eyebrow">{L('ΠΡΟΣΚΛΗΣΗ', 'INVITATION')}</span>
                <h2>{L('Σύνδεσμος εγγραφής', 'Signup link')}</h2>
              </div>
              <button onClick={() => setLinkOpen(false)} aria-label={L('Κλείσιμο', 'Close')}>
                <X />
              </button>
            </header>
            <div className="studio-drawer-form">
              <SignupLinkCard organizationId={organizationId} onError={showError} refreshKey={refreshKey} />
              <div className="studio-form-note">
                <UserCheck size={16} />
                <span>
                  {L(
                    'Όποιος εγγραφεί με τον σύνδεσμο εμφανίζεται στους Χρήστες ως αίτημα. Τον εγκρίνετε επιλέγοντας ρόλο και τμήμα.',
                    'Whoever signs up with the link shows under Users as a request. You approve them by picking a role and department.',
                  )}
                </span>
              </div>
            </div>
            <footer>
              <AppButton onClick={() => setLinkOpen(false)}>{L('Κλείσιμο', 'Close')}</AppButton>
            </footer>
          </aside>
        </div>
      )}

      {csvRows && (
        <div className="studio-drawer-backdrop" onMouseDown={e => e.currentTarget === e.target && setCsvRows(null)}>
          <aside className="studio-drawer">
            <header>
              <div>
                <span className="eyebrow">{L('ΠΡΟΣΚΛΗΣΗ', 'INVITATION')}</span>
                <h2>{L('Προσκλήσεις από αρχείο', 'Invitations from a file')}</h2>
              </div>
              <button onClick={() => setCsvRows(null)} aria-label={L('Κλείσιμο', 'Close')}>
                <X />
              </button>
            </header>
            <div className="studio-drawer-form">
              {csvRows.length === 0 && (
                <p className="hospital-empty">{L('Το αρχείο δεν έχει γραμμές.', 'The file has no rows.')}</p>
              )}
              <div className="people-csv">
                {csvRows.map((r, i) => (
                  <div key={i} className={r.error ? 'error' : ''}>
                    <b>{r.name || '—'}</b>
                    <small>
                      {r.email} · {roleLabel(r.role)}
                      {!wholeHospital(r.role) && ` · ${r.department || '—'}`}
                    </small>
                    {r.error && <em>{r.error}</em>}
                  </div>
                ))}
              </div>
            </div>
            <footer>
              <AppButton onClick={() => setCsvRows(null)}>{L('Ακύρωση', 'Cancel')}</AppButton>
              <AppButton
                variant="primary"
                disabled={busy || !csvRows.length || csvRows.some(r => r.error)}
                onClick={() => void sendCsv()}
              >
                {L(`Αποστολή ${csvRows.length} προσκλήσεων`, `Send ${csvRows.length} invitations`)}
              </AppButton>
            </footer>
          </aside>
        </div>
      )}
    </div>
  );
}

/** The side drawer: a new user (sent an invitation) or an existing one (saved, or deleted). */
function MemberDrawer({
  member,
  self,
  departments,
  showDemo,
  invitedAt,
  busy,
  L,
  lang,
  onClose,
  onSave,
  onResend,
  onDelete,
}: {
  member: Member | null;
  self: boolean;
  departments: Department[];
  showDemo: boolean;
  /** When the invitation was last sent, for an invited user who has not accepted yet. */
  invitedAt?: string;
  busy: boolean;
  L: (gr: string, en: string) => string;
  lang: 'el' | 'en';
  onClose: () => void;
  onSave: (draft: Draft) => void;
  onResend: (draft: Draft) => void;
  onDelete: () => void;
}) {
  const invited = invitedAt !== undefined;
  const [draft, setDraft] = useState<Draft>(() => ({
    name: member?.name || '',
    email: member?.email || '',
    role: member ? roleValue(member) : 'DEPARTMENT',
    departmentId: member?.department_id || departments[0]?.id || '',
    active: member?.active ?? true,
    demoEnabled: member?.demo_enabled ?? false,
  }));
  const set = (patch: Partial<Draft>) => setDraft(d => ({...d, ...patch}));
  const valid =
    draft.name.trim().length >= 2 &&
    EMAIL_FORMAT.test(draft.email.trim()) &&
    (wholeHospital(draft.role) || !!draft.departmentId);
  return (
    <div className="studio-drawer-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <aside className="studio-drawer">
        <header>
          <div>
            <span className="eyebrow">{member ? L('ΧΡΗΣΤΗΣ', 'USER') : L('ΠΡΟΣΚΛΗΣΗ', 'INVITATION')}</span>
            <h2>{member ? member.name : L('Νέος χρήστης', 'New user')}</h2>
          </div>
          <button onClick={onClose} aria-label={L('Κλείσιμο', 'Close')}>
            <X />
          </button>
        </header>
        <div className="studio-drawer-form">
          <label>
            {L('Ονοματεπώνυμο', 'Full name')}
            <input autoFocus value={draft.name} maxLength={120} onChange={e => set({name: e.target.value})} />
          </label>
          <label>
            Email
            <input type="email" value={draft.email} onChange={e => set({email: e.target.value})} />
          </label>
          <label>
            {L('Ρόλος', 'Role')}
            <select value={draft.role} disabled={self} onChange={e => set({role: e.target.value})}>
              {roles.map(role => (
                <option key={role.id} value={role.id}>
                  {lang === 'el' ? role.el : role.en}
                </option>
              ))}
            </select>
          </label>
          <label>
            {L('Τμήμα', 'Department')}
            {wholeHospital(draft.role) ? (
              <span className="hospital-whole">{L('Όλο το νοσοκομείο', 'Whole hospital')}</span>
            ) : (
              <select value={draft.departmentId} onChange={e => set({departmentId: e.target.value})}>
                <option value="">—</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>
                    {localizedName(d.name, lang)}
                  </option>
                ))}
              </select>
            )}
          </label>
          {invited && member && (
            <div className="people-invited">
              <Mail size={17} />
              <span>
                <b>{L('Η πρόσκληση δεν έχει γίνει αποδεκτή ακόμα', 'The invitation is not accepted yet')}</b>
                <small>
                  {invitedAt
                    ? L(
                        `Στάλθηκε στις ${new Date(invitedAt).toLocaleString('el-GR', {dateStyle: 'medium', timeStyle: 'short'})}. Ο λογαριασμός ενεργοποιείται μόλις ορίσει κωδικό από το email.`,
                        `Sent on ${new Date(invitedAt).toLocaleString('en-GB', {dateStyle: 'medium', timeStyle: 'short'})}. The account activates once they set a password from the email.`,
                      )
                    : L(
                        'Ο λογαριασμός ενεργοποιείται μόλις ορίσει κωδικό από το email.',
                        'The account activates once they set a password from the email.',
                      )}
                </small>
              </span>
              <AppButton
                size="sm"
                disabled={busy}
                icon={<Send size={14} />}
                onClick={() => onResend({...draft, name: draft.name.trim(), email: member.email})}
              >
                {L('Επαναποστολή πρόσκλησης', 'Resend invitation')}
              </AppButton>
            </div>
          )}
          {member && !invited && (
            <label className="studio-switch-row">
              <input
                type="checkbox"
                checked={draft.active}
                disabled={self}
                onChange={e => set({active: e.target.checked})}
              />
              <span>{L('Ενεργή πρόσβαση', 'Access enabled')}</span>
            </label>
          )}
          {showDemo && draft.role !== 'ADMIN' && (
            <label className="studio-switch-row">
              <input type="checkbox" checked={draft.demoEnabled} onChange={e => set({demoEnabled: e.target.checked})} />
              <span>{L('Επιτρέπεται Demo πρόσβαση', 'Demo access allowed')}</span>
            </label>
          )}
          {member?.user_code && (
            <div className="studio-form-note">
              <UserCheck size={16} />
              <span>
                {L('Όνομα χρήστη', 'Username')}: <b>{member.user_code}</b>
              </span>
            </div>
          )}
          {!member && (
            <div className="studio-form-note">
              <Mail size={16} />
              <span>
                {L(
                  'Ο χρήστης λαμβάνει email για να ορίσει τον δικό του κωδικό. Το όνομα χρήστη δημιουργείται αυτόματα από τα αρχικά του.',
                  'The user gets an email to set their own password. The username is made from their initials.',
                )}
              </span>
            </div>
          )}
        </div>
        <footer>
          {member && !self && (
            <AppButton variant="danger" icon={<Trash2 size={15} />} disabled={busy} onClick={onDelete}>
              {L('Διαγραφή', 'Delete')}
            </AppButton>
          )}
          <span className="people-drawer-gap" />
          <AppButton onClick={onClose}>{L('Ακύρωση', 'Cancel')}</AppButton>
          <AppButton
            variant="primary"
            disabled={busy || !valid}
            icon={member ? <Save size={15} /> : <Mail size={15} />}
            onClick={() => onSave({...draft, name: draft.name.trim(), email: draft.email.trim()})}
          >
            {member ? L('Αποθήκευση', 'Save') : L('Αποστολή πρόσκλησης', 'Send invitation')}
          </AppButton>
        </footer>
      </aside>
    </div>
  );
}
