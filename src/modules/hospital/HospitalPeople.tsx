import {Building2, Users, X} from 'lucide-react';
import MemberDrawer from './MemberDrawer';
import CopyField from './CopyField';
import {usePeople} from './people/usePeople';
import UsersSection from './people/UsersSection';
import DepartmentsSection from './people/DepartmentsSection';
import SignupLinkDrawer from './people/SignupLinkDrawer';
import CsvDialog from './people/CsvDialog';

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
  const s = usePeople({organizationId, platform, hospitalDemo, refreshKey, onChanged});
  const {
    L,
    activeDepartments,
    busy,
    demo,
    drawer,
    invite,
    invitedAt,
    lang,
    makeLink,
    me,
    members,
    notice,
    passwordReset,
    pending,
    remove,
    save,
    setDrawer,
    setNotice,
    setTab,
    tab,
  } = s;

  if (!organizationId && !demo) return null;
  return (
    <div className="hospital-people">
      {notice && (
        <div className={`hospital-notice ${notice.kind}`} role="status">
          <span>
            {notice.text}
            {notice.link && <CopyField value={notice.link} L={L} />}
          </span>
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
          {pending.length > 0 && (
            <span className="hospital-count attention">
              {pending.length === 1
                ? L('1 αίτημα', '1 request')
                : L(`${pending.length} αιτήματα`, `${pending.length} requests`)}
            </span>
          )}
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
      <UsersSection s={s} />
      <DepartmentsSection s={s} />
      {drawer && (
        <MemberDrawer
          member={drawer.member}
          self={!!drawer.member && drawer.member.id === me?.id}
          departments={activeDepartments}
          showDemo={platform && hospitalDemo}
          demo={demo}
          invitedAt={drawer.member ? invitedAt(drawer.member) : undefined}
          onResend={draft => void invite(draft, true)}
          onInviteLink={demo ? undefined : draft => void invite(draft, false, false)}
          onPasswordReset={m => void passwordReset(m)}
          onMakeLink={makeLink}
          busy={busy}
          L={L}
          lang={lang}
          onClose={() => setDrawer(null)}
          onSave={draft => void (drawer.member ? save(drawer.member, draft) : invite(draft))}
          onDelete={() => drawer.member && void remove(drawer.member)}
        />
      )}
      <SignupLinkDrawer s={s} />
      <CsvDialog s={s} />
    </div>
  );
}
