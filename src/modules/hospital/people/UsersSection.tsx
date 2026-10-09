import {
  ChevronRight,
  FileSpreadsheet,
  Link2,
  Lock,
  Mail,
  Search,
  Send,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import {localizedName} from '../../../core/glossary';
import {SUPERVISOR, roles, wholeHospital, roleValue} from '../hospitalPeopleMeta';
import CopyField from '../CopyField';
import type {PeopleState} from './usePeople';

export default function UsersSection({s}: {s: PeopleState}) {
  const {
    L,
    activeDepartments,
    busy,
    cancelInvitation,
    date,
    decide,
    decisionFor,
    demo,
    departmentName,
    el,
    invite,
    inviteMenu,
    invitedAt,
    invitedToSignup,
    lang,
    me,
    pending,
    q,
    query,
    readCsv,
    roleLabel,
    setDecision,
    setDrawer,
    setInviteMenu,
    setLinkOpen,
    setQuery,
    shown,
    signupFormUrl,
    tab,
  } = s;
  return (
    <>
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
                {L('Προσθήκη χρήστη', 'Add user')}
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
                      <b>{demo ? L('Νέος χρήστης', 'New user') : L('Πρόσκληση ατόμου', 'Invite a person')}</b>
                      <small>
                        {demo
                          ? L('Προστίθεται αμέσως στο Demo.', 'Added at once in the Demo.')
                          : L(
                              'Με email ή με σύνδεσμο που στέλνετε εσείς. Κάνει εγγραφή και το εγκρίνετε.',
                              'By email, or a link you send. They sign up and you approve.',
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
                        <b>{L('Κοινός σύνδεσμος νοσοκομείου', 'Hospital signup link')}</b>
                        <small>
                          {L(
                            'Ένας σύνδεσμος για πολλούς (10 ημέρες). Κάνουν εγγραφή και τους εγκρίνετε.',
                            'One link for many people (10 days). They sign up and you approve.',
                          )}
                        </small>
                      </span>
                    </button>
                  )}
                  {!demo && (
                    <label role="menuitem" className="people-invite-file">
                      <FileSpreadsheet size={16} />
                      <span>
                        <b>{L('Από αρχείο CSV', 'From a CSV file')}</b>
                        <small>
                          {L(
                            'Μαζική εισαγωγή: λογαριασμοί αμέσως, χωρίς έγκριση. Ονοματεπώνυμο; Email; Τμήμα; Ρόλος',
                            'Bulk import: accounts at once, no approval. Name; Email; Department; Role',
                          )}
                        </small>
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
                    'Ελέγξτε τα στοιχεία, επιλέξτε ρόλο και τμήμα και εγκρίνετε. Ο χρήστης έχει ήδη όνομα χρήστη και κωδικό· με την έγκριση λαμβάνει ένα email και συνδέεται.',
                    'Check the details, pick a role and department, then approve. The user already has a username and password; on approval they get one email and can sign in.',
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
                        {r.user_code && (
                          <>
                            <code>{r.user_code}</code> ·{' '}
                          </>
                        )}
                        {r.email}
                        {r.department_id && (
                          <>
                            {' '}
                            · {L('ζήτησε', 'asked for')} <b>{departmentName(r.department_id)}</b>
                          </>
                        )}{' '}
                        · {date(r.requested_at)}
                      </small>
                    </div>
                    <label>
                      {L('Ρόλος', 'Role')}
                      <select value={d.role} onChange={e => setDecision(r, {role: e.target.value})}>
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
            </div>
          )}
          {invitedToSignup.length > 0 && (
            <div className="people-invitations">
              <header>
                <Mail size={16} />
                <b>
                  {L(
                    `${invitedToSignup.length} ${invitedToSignup.length === 1 ? 'πρόσκληση περιμένει' : 'προσκλήσεις περιμένουν'} την εγγραφή του χρήστη`,
                    `${invitedToSignup.length} ${invitedToSignup.length === 1 ? 'invitation waits' : 'invitations wait'} for the person to sign up`,
                  )}
                </b>
              </header>
              {invitedToSignup.map(r => (
                <article key={r.id} className="people-invitation">
                  <span className="people-who">
                    <b>{r.email}</b>
                    <small>
                      {r.invited_role ? roleLabel(r.invited_role) : ''}
                      {r.invited_at ? ` · ${L('στάλθηκε', 'sent')} ${date(r.invited_at)}` : ''}
                    </small>
                  </span>
                  {r.invite_token && <CopyField value={signupFormUrl(r.invite_token)} L={L} compact />}
                  <AppButton
                    size="sm"
                    disabled={busy}
                    icon={<Send size={14} />}
                    onClick={() =>
                      void invite(
                        {
                          name: '',
                          email: r.email,
                          role:
                            r.invited_role === 'STERILIZATION' && r.supervisor
                              ? SUPERVISOR
                              : r.invited_role || 'DEPARTMENT',
                          departmentId: r.department_id || '',
                          active: true,
                          demoEnabled: false,
                        },
                        true,
                      )
                    }
                  >
                    {L('Επαναποστολή', 'Resend')}
                  </AppButton>
                  <AppButton
                    size="sm"
                    variant="danger"
                    disabled={busy}
                    icon={<X size={14} />}
                    onClick={() => void cancelInvitation(r)}
                  >
                    {L('Ακύρωση', 'Cancel')}
                  </AppButton>
                </article>
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
                    {L(
                      'Πατήστε «Προσθήκη χρήστη» για να προσθέσετε τον πρώτο.',
                      'Press «Add user» to add the first one.',
                    )}
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
    </>
  );
}
