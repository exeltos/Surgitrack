import {useState} from 'react';
import {Copy, KeyRound, Mail, Save, Send, Trash2, UserCheck, X} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import {localizedName} from '../../core/glossary';
import {roles, wholeHospital, roleValue, EMAIL_FORMAT} from './hospitalPeopleMeta';
import type {Department, Member, Draft} from './hospitalPeopleMeta';
import LinkCopy from './LinkCopy';
import {formatDateTime} from '../../core/displayDate';

export default function MemberDrawer({
  member,
  self,
  departments,
  showDemo,
  demo,
  invitedAt,
  busy,
  L,
  lang,
  onClose,
  onSave,
  onResend,
  onInviteLink,
  onPasswordReset,
  onMakeLink,
  onDelete,
}: {
  member: Member | null;
  self: boolean;
  departments: Department[];
  showDemo: boolean;
  /** The local Demo: no emails, a new user is added at once. */
  demo: boolean;
  /** When the invitation was last sent, for an invited user who has not accepted yet. */
  invitedAt?: string;
  busy: boolean;
  L: (gr: string, en: string) => string;
  lang: 'el' | 'en';
  onClose: () => void;
  onSave: (draft: Draft) => void;
  onResend: (draft: Draft) => void;
  /** A new user's invitation as a link to pass on by hand, instead of an email; left out in Demo. */
  onInviteLink?: (draft: Draft) => void;
  /** Emails the user a link to set a new password; left out in Demo. */
  onPasswordReset?: (member: Member) => void;
  /** Makes the same kind of link without sending it, to pass on by hand; left out in Demo. */
  onMakeLink?: (member: Member) => Promise<string | undefined>;
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
  // A new user is invited to the signup form and fills in their own name (the department is offered).
  const signupInvite = !member && !demo;
  const valid =
    (signupInvite || draft.name.trim().length >= 2) &&
    EMAIL_FORMAT.test(draft.email.trim()) &&
    (signupInvite || wholeHospital(draft.role) || !!draft.departmentId);
  const clean = () => ({...draft, name: draft.name.trim(), email: draft.email.trim()});
  const roleField = (
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
  );
  return (
    <div className="studio-drawer-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <aside className="studio-drawer">
        <header>
          <div>
            <span className="eyebrow">{member ? L('ΧΡΗΣΤΗΣ', 'USER') : L('ΠΡΟΣΚΛΗΣΗ', 'INVITATION')}</span>
            <h2>{member ? member.name : L('Προσθήκη χρήστη', 'Add user')}</h2>
          </div>
          <button onClick={onClose} aria-label={L('Κλείσιμο', 'Close')}>
            <X />
          </button>
        </header>
        <div className="studio-drawer-form">
          {!member && roleField}
          {!signupInvite && (
            <label>
              {L('Ονοματεπώνυμο', 'Full name')}
              <input autoFocus value={draft.name} maxLength={120} onChange={e => set({name: e.target.value})} />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              autoFocus={signupInvite}
              value={draft.email}
              onChange={e => set({email: e.target.value})}
            />
          </label>
          {member && roleField}
          {
            <label>
              {L('Τμήμα', 'Department')}
              {wholeHospital(draft.role) ? (
                <span className="hospital-whole">{L('Όλο το νοσοκομείο', 'Whole hospital')}</span>
              ) : (
                <select value={draft.departmentId} onChange={e => set({departmentId: e.target.value})}>
                  <option value="">{signupInvite ? L('— Το επιλέγει ο ίδιος —', '— They pick it —') : '—'}</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>
                      {localizedName(d.name, lang)}
                    </option>
                  ))}
                </select>
              )}
            </label>
          }
          {invited && member && (
            <div className="people-invited">
              <Mail size={17} />
              <span>
                <b>{L('Η πρόσκληση δεν έχει γίνει αποδεκτή ακόμα', 'The invitation is not accepted yet')}</b>
                <small>
                  {invitedAt
                    ? L(
                        `Στάλθηκε στις ${formatDateTime(invitedAt)}. Ο λογαριασμός ενεργοποιείται μόλις ορίσει κωδικό από το email.`,
                        `Sent on ${formatDateTime(invitedAt)}. The account activates once they set a password from the email.`,
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
              {onMakeLink && <LinkCopy member={member} make={onMakeLink} busy={busy} L={L} />}
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
          {member && !invited && onPasswordReset && (
            <div className="people-password">
              <KeyRound size={17} />
              <span>
                <b>{L('Κωδικός πρόσβασης', 'Password')}</b>
                <small>
                  {L(
                    'Ξέχασε τον κωδικό του; Στείλτε του email με σύνδεσμο για να ορίσει νέο. Ο τωρινός κωδικός ισχύει μέχρι να τον αλλάξει.',
                    'Forgot their password? Send them an email with a link to set a new one. The current password works until they change it.',
                  )}
                </small>
              </span>
              <AppButton
                size="sm"
                disabled={busy || !member.active}
                icon={<Send size={14} />}
                onClick={() => onPasswordReset(member)}
              >
                {L('Αποστολή συνδέσμου αλλαγής κωδικού', 'Send password reset link')}
              </AppButton>
              {onMakeLink && <LinkCopy member={member} make={onMakeLink} busy={busy || !member.active} L={L} />}
            </div>
          )}
          {!member && !demo && (
            <div className="studio-form-note">
              <Mail size={16} />
              <span>
                {L(
                  'Στείλτε την πρόσκληση με email ή αντιγράψτε τον σύνδεσμο για να τον στείλετε όπως θέλετε (ισχύει 7 ημέρες). Ο χρήστης συμπληρώνει όνομα, τμήμα και κωδικό και βλέπει αμέσως το όνομα χρήστη του. Το αίτημα εμφανίζεται εδώ για έγκριση· με την έγκριση λαμβάνει ένα email και συνδέεται.',
                  'Email the invitation, or copy its link to send any way you like (valid 7 days). The user fills in their name, department and password and sees their username at once. The request shows here for approval; on approval they get one email and can sign in.',
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
          {signupInvite && onInviteLink && (
            <AppButton disabled={busy || !valid} icon={<Copy size={15} />} onClick={() => onInviteLink(clean())}>
              {L('Αντιγραφή συνδέσμου', 'Copy link')}
            </AppButton>
          )}
          <AppButton
            variant="primary"
            disabled={busy || !valid}
            icon={member ? <Save size={15} /> : <Mail size={15} />}
            onClick={() => onSave(clean())}
          >
            {member ? L('Αποθήκευση', 'Save') : signupInvite ? L('Αποστολή email', 'Send email') : L('Προσθήκη', 'Add')}
          </AppButton>
        </footer>
      </aside>
    </div>
  );
}
