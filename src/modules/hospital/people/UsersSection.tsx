import {useState} from 'react';
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
  KeyRound,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import SortHeader from '../../../components/ui/SortHeader';
import {useTableSort} from '../../../components/ui/useTableSort';
import FilterMenu from '../../../components/assets/FilterMenu';
import {localizedName} from '../../../core/glossary';
import {SUPERVISOR, roles, assignableRoles, wholeHospital, roleValue} from '../hospitalPeopleMeta';
import CopyField from '../CopyField';
import StaffImportDialog from './StaffImportDialog';
import StaffAddDialog from './StaffAddDialog';
import PasswordReminder from './PasswordReminder';
import DownloadMenu from '../../../components/ui/DownloadMenu';
import PrintPreviewModal from '../../../components/assets/PrintPreviewModal';
import {usernameSheetsHtml, usernameTable, type UsernameRow} from './usernameLists';
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
    demoSeats,
    departmentName,
    el,
    filters,
    setFilters,
    invite,
    inviteMenu,
    invitedAt,
    invitedToSignup,
    lang,
    listed,
    me,
    pending,
    online,
    platform,
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
  // The list sorts by its column titles; access goes active, invited, switched off.
  const people = useTableSort(shown, {
    name: m => m.name,
    username: m => m.user_code,
    department: m => departmentName(m.department_id),
    role: m => roleLabel(roleValue(m)),
    access: m => (m.active ? 0 : invitedAt(m) !== undefined ? 1 : 2),
  });
  // The owner's staff import (never shown to a hospital admin).
  const [importing, setImporting] = useState(false);
  const [addingActive, setAddingActive] = useState(false);
  const [sheets, setSheets] = useState(false);
  // The people on screen (the filters apply: choose a department to take just that one): department, name, username.
  const usernameRows = (): UsernameRow[] =>
    shown
      .filter(m => m.user_code)
      .map(m => ({
        department: wholeHospital(m.role) ? L('Όλο το νοσοκομείο', 'Whole hospital') : departmentName(m.department_id),
        name: m.name,
        userCode: m.user_code!,
      }));
  // Whether the person has set their own password yet (accounts made by a staff import start on the mobile number).
  const passwordBadge = (m: (typeof shown)[number]) => {
    const until = m.password_change_deadline
      ? new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'el-GR', {day: '2-digit', month: '2-digit'}).format(
          new Date(m.password_change_deadline),
        )
      : '';
    if (!m.password_change_required)
      return {
        kind: 'changed',
        short: L('Δικός του κωδικός', 'Own password'),
        text: L('Προσωπικός κωδικός', 'Personal password'),
        title: L('Έχει ορίσει προσωπικό κωδικό.', 'Has set a personal password.'),
      };
    return m.active
      ? {
          kind: 'default',
          short: L('Προσωρινός κωδικός', 'Temporary password'),
          text: until
            ? L(`Αρχικός κωδικός · έως ${until}`, `Initial password · by ${until}`)
            : L('Αρχικός κωδικός', 'Initial password'),
          title: L(
            'Δεν έχει αλλάξει ακόμη τον αρχικό κωδικό (το κινητό του). Μετά την προθεσμία ο λογαριασμός κλειδώνει.',
            'Has not changed the initial password (their mobile number) yet. The account locks after the deadline.',
          ),
        }
      : {
          kind: 'locked',
          short: L('Κλειδωμένος', 'Locked'),
          text: L('Δεν άλλαξε κωδικό · κλειδώθηκε', 'Password not changed · locked'),
          title: L(
            'Δεν άλλαξε τον αρχικό κωδικό μέσα στην προθεσμία και ο λογαριασμός κλειδώθηκε. Ενεργοποιήστε τον ξανά για νέα προθεσμία.',
            'Did not change the initial password in time and the account was locked. Activate it again for a new deadline.',
          ),
        };
  };
  return (
    <>
      {importing && <StaffImportDialog s={s} onClose={() => setImporting(false)} />}
      {addingActive && <StaffAddDialog s={s} onClose={() => setAddingActive(false)} />}
      {sheets && (
        <PrintPreviewModal
          title={L('Ονόματα χρήστη ανά τμήμα', 'Usernames by department')}
          html={usernameSheetsHtml(usernameRows(), el, lang)}
          onClose={() => setSheets(false)}
        />
      )}
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
            <FilterMenu
              filters={[
                {
                  key: 'department',
                  value: filters.department,
                  placeholder: L('Όλα τα τμήματα', 'Every department'),
                  options: activeDepartments.map(d => ({value: d.id, label: localizedName(d.name, lang)})),
                  onChange: department => setFilters(f => ({...f, department})),
                },
                {
                  key: 'role',
                  value: filters.role,
                  placeholder: L('Όλοι οι ρόλοι', 'Every role'),
                  options: roles.map(r => ({value: r.id, label: el ? r.el : r.en})),
                  onChange: role => setFilters(f => ({...f, role})),
                },
                {
                  key: 'access',
                  value: filters.access,
                  placeholder: L('Όλοι οι χρήστες', 'Every user'),
                  options: [
                    {value: 'ACTIVE', label: L('Ενεργοί', 'Active')},
                    {value: 'INACTIVE', label: L('Ανενεργοί', 'Inactive')},
                    {value: 'INVITED', label: L('Εκκρεμεί πρόσκληση', 'Invitation pending')},
                  ],
                  onChange: access => setFilters(f => ({...f, access})),
                },
                {
                  key: 'password',
                  value: filters.password,
                  placeholder: L('Κάθε κωδικός', 'Any password'),
                  options: [
                    {
                      value: 'INITIAL',
                      label: L('Αρχικός κωδικός (δεν έχει μπει ακόμη)', 'Initial password (not changed yet)'),
                    },
                    {value: 'OWN', label: L('Προσωπικός κωδικός', 'Personal password')},
                    {value: 'LOCKED', label: L('Κλειδωμένοι (έληξε η προθεσμία)', 'Locked (deadline passed)')},
                  ],
                  onChange: password => setFilters(f => ({...f, password})),
                },
              ]}
            />
            <DownloadMenu
              table={() => usernameTable(usernameRows(), el)}
              onPrint={() => setSheets(true)}
              printLabel={L('Λίστες ανά τμήμα (PDF / εκτύπωση)', 'Lists by department (PDF / print)')}
              disabled={shown.every(m => !m.user_code)}
            />
            <div className="people-invite">
              <AppButton
                variant="primary"
                icon={<UserPlus size={16} />}
                disabled={demoSeats?.left === 0}
                title={
                  demoSeats?.left === 0
                    ? L('Το Demo έχει φτάσει το όριο συναδέλφων.', 'The Demo has reached its colleague limit.')
                    : undefined
                }
                data-tour="add-user"
                onClick={() => setInviteMenu(v => !v)}
              >
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
                  {!demo && !demoSeats && (
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
                  {/* The hospital admin's list by email; the owner has the staff import instead (below). */}
                  {!demo && !demoSeats && !platform && (
                    <label role="menuitem" className="people-invite-file">
                      <FileSpreadsheet size={16} />
                      <span>
                        <b>{L('Από αρχείο Excel ή CSV', 'From an Excel or CSV file')}</b>
                        <small>
                          {L(
                            'Μαζική εισαγωγή: λογαριασμοί αμέσως, χωρίς έγκριση. Ονοματεπώνυμο; Email; Τμήμα; Ρόλος',
                            'Bulk import: accounts at once, no approval. Name; Email; Department; Role',
                          )}
                        </small>
                      </span>
                      <input
                        type="file"
                        accept=".xlsx,.csv,text/csv"
                        hidden
                        onChange={e => {
                          setInviteMenu(false);
                          if (e.target.files?.[0]) void readCsv(e.target.files[0]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                  {platform && !demo && !demoSeats && s.organizationId && (
                    <button
                      role="menuitem"
                      onClick={() => {
                        setInviteMenu(false);
                        setAddingActive(true);
                      }}
                    >
                      <UserPlus size={16} />
                      <span>
                        <b>{L('Νέος ενεργός χρήστης', 'New active user')}</b>
                        <small>
                          {L(
                            'Μόνο για τον ιδιοκτήτη: ένας χρήστης κατευθείαν ενεργός, χωρίς πρόσκληση. Αρχικός κωδικός το κινητό.',
                            'Owner only: one user made active at once, with no invitation. The initial password is the mobile number.',
                          )}
                        </small>
                      </span>
                    </button>
                  )}
                  {platform && !demo && !demoSeats && s.organizationId && (
                    <button
                      role="menuitem"
                      onClick={() => {
                        setInviteMenu(false);
                        setImporting(true);
                      }}
                    >
                      <FileSpreadsheet size={16} />
                      <span>
                        <b>{L('Εισαγωγή εργαζομένων', 'Import employees')}</b>
                        <small>
                          {L(
                            'Μόνο για τον ιδιοκτήτη: ανεβάστε τη λίστα, επιλέξτε ποιους και ενεργοποιήστε τους. Αρχικός κωδικός το κινητό.',
                            'Owner only: upload the list, choose who, and activate them. The initial password is the mobile number.',
                          )}
                        </small>
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          {demoSeats && (
            <div className={`people-demo-seats ${demoSeats.left === 0 ? 'full' : ''}`}>
              <Users size={16} />
              <span>
                <b>
                  {L(
                    `Συνάδελφοι στο Demo: ${demoSeats.max - demoSeats.left} / ${demoSeats.max}`,
                    `Colleagues in the Demo: ${demoSeats.max - demoSeats.left} / ${demoSeats.max}`,
                  )}
                </b>
                <small>
                  {demoSeats.left === 0
                    ? L(
                        'Το όριο συμπληρώθηκε. Για περισσότερους συναδέλφους επικοινωνήστε μαζί μας.',
                        'The limit is reached. For more colleagues, contact us.',
                      )
                    : L(
                        `Μπορείτε να προσκαλέσετε ακόμα ${demoSeats.left}. Οι προσκλήσεις που περιμένουν εγγραφή μετράνε κι αυτές.`,
                        `You can invite ${demoSeats.left} more. Invitations waiting for signup count too.`,
                      )}
                </small>
              </span>
            </div>
          )}

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
                        {assignableRoles(platform, d.role).map(role => (
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

          {platform && !demo && !demoSeats && <PasswordReminder s={s} />}
          <div className="people-counts" role="group" aria-label={L('Σύνοψη χρηστών', 'Users at a glance')}>
            {online && (
              <button
                type="button"
                className={`people-count online${filters.online ? ' on' : ''}`}
                aria-pressed={!!filters.online}
                onClick={() => setFilters(f => ({...f, online: f.online ? '' : 'ONLINE'}))}
              >
                <i></i>
                {L('Συνδεδεμένοι τώρα', 'Connected now')} <b>{listed.filter(m => online.has(m.id)).length}</b>
              </button>
            )}
            {(
              [
                [
                  'INITIAL',
                  'default',
                  L('Προσωρινός κωδικός', 'Temporary password'),
                  (m: (typeof listed)[number]) => m.password_change_required && m.active,
                ],
                [
                  'OWN',
                  'changed',
                  L('Δικός τους κωδικός', 'Own password'),
                  (m: (typeof listed)[number]) => !m.password_change_required,
                ],
                [
                  'LOCKED',
                  'locked',
                  L('Κλειδωμένοι', 'Locked'),
                  (m: (typeof listed)[number]) => m.password_change_required && !m.active,
                ],
              ] as const
            ).map(([value, kind, label, test]) => (
              <button
                type="button"
                key={value}
                className={`people-count ${kind}${filters.password === value ? ' on' : ''}`}
                aria-pressed={filters.password === value}
                onClick={() => setFilters(f => ({...f, password: f.password === value ? '' : value}))}
              >
                <i></i>
                {label} <b>{listed.filter(m => invitedAt(m) === undefined && test(m)).length}</b>
              </button>
            ))}
          </div>
          <div className="people-head">
            <span>
              <SortHeader label={L('Χρήστης', 'User')} sortKey="name" sort={people.sort} onSort={people.toggle} />
            </span>
            <span>
              <SortHeader
                label={L('Όνομα χρήστη', 'Username')}
                sortKey="username"
                sort={people.sort}
                onSort={people.toggle}
              />
            </span>
            <span>
              <SortHeader
                label={L('Τμήμα', 'Department')}
                sortKey="department"
                sort={people.sort}
                onSort={people.toggle}
              />
            </span>
            <span>
              <SortHeader label={L('Ρόλος', 'Role')} sortKey="role" sort={people.sort} onSort={people.toggle} />
            </span>
            <span>
              <SortHeader label={L('Πρόσβαση', 'Access')} sortKey="access" sort={people.sort} onSort={people.toggle} />
            </span>
            <span></span>
          </div>
          <div className="people-rows">
            {shown.length === 0 && (
              <div className="hospital-users-empty">
                <Users size={22} />
                <strong>
                  {q || filters.department || filters.role || filters.access || filters.password || filters.online
                    ? L(
                        'Κανένας χρήστης δεν ταιριάζει στην αναζήτηση ή στα φίλτρα.',
                        'No user matches the search or filters.',
                      )
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
            {people.rows.map(m => {
              // Your own account is changed by another admin (or the platform owner), never by you.
              const self = m.id === me?.id;
              // Another admin's account is changed only by the platform owner (the staff functions and the database
              // refuse a hospital admin too).
              const ownerOnly = !self && !platform && m.role === 'ADMIN';
              const locked = self || ownerOnly;
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`people-row${self ? ' self' : ''}`}
                  disabled={locked}
                  title={
                    self
                      ? L(
                          'Τον δικό σας λογαριασμό τον αλλάζει άλλος διαχειριστής.',
                          'Another admin changes your own account.',
                        )
                      : ownerOnly
                        ? L(
                            'Τους λογαριασμούς διαχειριστών τους αλλάζει μόνο ο διαχειριστής της πλατφόρμας.',
                            'Only the platform owner changes an admin account.',
                          )
                        : undefined
                  }
                  onClick={() => setDrawer({member: m})}
                >
                  <span className="people-who">
                    <b>
                      {online?.has(m.id) && (
                        <span
                          className="people-online"
                          role="img"
                          aria-label={L('Συνδεδεμένος τώρα', 'Connected now')}
                          title={L('Συνδεδεμένος τώρα', 'Connected now')}
                        >
                          <i></i>
                        </span>
                      )}
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
                  <span className="people-state">
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
                    {invitedAt(m) === undefined && passwordBadge(m) && (
                      <span
                        className={`people-password ${passwordBadge(m)!.kind}`}
                        title={`${passwordBadge(m)!.text}. ${passwordBadge(m)!.title}`}
                      >
                        {passwordBadge(m)!.kind === 'changed' ? (
                          <ShieldCheck size={12} />
                        ) : passwordBadge(m)!.kind === 'locked' ? (
                          <LockKeyhole size={12} />
                        ) : (
                          <KeyRound size={12} />
                        )}
                        {passwordBadge(m)!.short}
                      </span>
                    )}
                  </span>
                  {locked ? (
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
