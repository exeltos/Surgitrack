import {useEffect, useState} from 'react';
import {Building2, Clock3, KeyRound, Languages, Mail, ShieldCheck, UserRound} from 'lucide-react';
import {FunctionsHttpError} from '@supabase/supabase-js';
import {supabase} from '../../lib/supabase';
import {useAppPreferences} from '../../core/AppPreferences';
import {localizedName} from '../../core/glossary';
import {APP_VERSION} from '../../config/appMeta';
import {formatDate} from '../../core/displayDate';

type LinkInfo = {
  organization_name: string;
  /** When the link (hospital link or personal invitation) stops working. */
  expires_at: string | null;
  /** A personal invitation's address, fixed. */
  email: string | null;
  department_id: string | null;
  needs_department: boolean;
  departments: Array<{id: string; name: string; code: string | null}>;
};

/** Capitals only (Greek or Latin letters, spaces, hyphens), as names appear on hospital records. */
const toNameCapitals = (value: string) =>
  value
    .toLocaleUpperCase('el-GR')
    .replace(/[^A-ZΑ-ΩΆΈΉΊΌΎΏΪΫ -]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s-]+/, '');

const errorText = (code: string, el: boolean) => {
  switch (code) {
    case 'email_exists':
      return el ? 'Υπάρχει ήδη λογαριασμός με αυτό το email.' : 'An account with this email already exists.';
    case 'link_invalid':
      return el ? 'Ο σύνδεσμος εγγραφής έληξε ή ανακλήθηκε.' : 'This signup link has expired or was revoked.';
    case 'department_invalid':
      return el ? 'Το τμήμα δεν είναι πλέον διαθέσιμο.' : 'The department is no longer available.';
    case 'already_pending':
      return el
        ? 'Υπάρχει ήδη αίτηση με αυτό το email που περιμένει έγκριση.'
        : 'A request with this email is already waiting for approval.';
    case 'too_many_attempts':
      return el ? 'Πολλές προσπάθειες. Δοκιμάστε ξανά αργότερα.' : 'Too many attempts. Try again later.';
    case 'demo_user_limit':
      return el
        ? 'Το Demo έχει φτάσει το όριο χρηστών. Ενημερώστε όποιον σας προσκάλεσε.'
        : 'The Demo has reached its user limit. Tell whoever invited you.';
    case 'password_invalid':
      return el ? 'Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.' : 'The password needs at least 8 characters.';
    case 'email_failed':
      return el
        ? 'Δεν στάλθηκε το email επιβεβαίωσης. Δοκιμάστε ξανά σε λίγο.'
        : 'The confirmation email could not be sent. Please try again shortly.';
    case 'invalid_input':
      return el ? 'Ελέγξτε τα στοιχεία της φόρμας.' : 'Check the form fields.';
    default:
      return el ? 'Η εγγραφή δεν ολοκληρώθηκε. Δοκιμάστε ξανά.' : 'Signup failed. Please try again.';
  }
};

/**
 * Public signup (#/join/<token>), through a hospital's link or a personal invitation. The person
 * fills in their details and sets their password; the form then shows their username. They can
 * sign in once the hospital admin approves (one email tells them). Through the hospital link they
 * first confirm their email: the emailed link opens #/join/confirm/<token> (`confirm`).
 */
export default function JoinPage({token, confirm = false}: {token: string; confirm?: boolean}) {
  const {lang, setLang} = useAppPreferences();
  const el = lang === 'el';
  const L = (gr: string, en: string) => (el ? gr : en);
  const [info, setInfo] = useState<LinkInfo | null>();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [done, setDone] = useState<{email: string; userCode: string; confirm: boolean} | null>(null);
  // The emailed confirmation link: undefined while it is checked.
  const [confirmed, setConfirmed] = useState<{organization: string} | 'invalid' | 'failed'>();

  useEffect(() => {
    if (confirm) {
      void supabase.functions
        .invoke<{ok: boolean; organization_name: string}>('staff-signup', {body: {action: 'confirm', token}})
        .then(async ({data, error}) => {
          if (data?.ok) return setConfirmed({organization: data.organization_name});
          const status = error instanceof FunctionsHttpError ? (error.context as Response).status : 0;
          setConfirmed(status === 410 ? 'invalid' : 'failed');
        });
      return;
    }
    void supabase.functions.invoke<LinkInfo>('staff-signup', {body: {action: 'info', token}}).then(({data, error}) => {
      setInfo(error || !data ? null : data);
      if (data?.department_id) setDepartmentId(data.department_id);
    });
  }, [token, confirm]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('');
    const form = new FormData(e.currentTarget);
    const email = (info?.email || String(form.get('email') || '')).trim().toLowerCase();
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first || !last || (info?.needs_department && !departmentId)) {
      setMessage(L('Συμπληρώστε όλα τα πεδία.', 'Fill in all fields.'));
      return;
    }
    if (password.length < 8) {
      setMessage(errorText('password_invalid', el));
      return;
    }
    if (password !== password2) {
      setMessage(L('Οι δύο κωδικοί δεν ταιριάζουν.', 'The two passwords do not match.'));
      return;
    }
    setBusy(true);
    const {data, error} = await supabase.functions.invoke<{ok: boolean; user_code: string; confirm?: boolean}>(
      'staff-signup',
      {
        body: {
          token,
          // The confirmation email links back to the address the form was filled in on.
          origin: window.location.origin,
          first_name: first,
          last_name: last,
          email,
          department_id: departmentId,
          password,
        },
      },
    );
    setBusy(false);
    if (error) {
      let code = '';
      if (error instanceof FunctionsHttpError) {
        code = String((await (error.context as Response).json().catch(() => ({})))?.error || '');
      }
      setMessage(errorText(code, el));
      return;
    }
    setDone({email, userCode: data?.user_code || '', confirm: !!data?.confirm});
  };

  const expires = info?.expires_at ? formatDate(info.expires_at) : '';
  return (
    <div className="auth-page">
      <header className="auth-topbar">
        <div className="auth-mini-brand">
          <div className="auth-brand-mark">S</div>
          <div>
            <strong>SurgiTrack</strong>
            <span>Healthcare Suite</span>
          </div>
        </div>
        <button className="auth-lang" onClick={() => setLang(el ? 'en' : 'el')}>
          <Languages size={16} />
          <span>{el ? 'EN' : 'EL'}</span>
        </button>
      </header>
      <main className="auth-main">
        <section className="auth-intro">
          <div className="auth-logo">S</div>
          <span className="auth-eyebrow">{L('ΕΓΓΡΑΦΗ ΠΡΟΣΩΠΙΚΟΥ', 'STAFF SIGNUP')}</span>
          <h1>{info?.organization_name || 'SurgiTrack'}</h1>
          <p className="auth-product-subtitle">
            {L(
              'Συμπληρώστε τα στοιχεία σας και ορίστε τον κωδικό σας. Θα δείτε αμέσως το όνομα χρήστη σας· συνδέεστε μόλις εγκρίνει ο διαχειριστής του νοσοκομείου.',
              'Fill in your details and set your password. You will see your username at once, and can sign in as soon as the hospital administrator approves.',
            )}
          </p>
          <div className="auth-security">
            <ShieldCheck size={18} />
            <span>{L('Πρόσβαση μόνο μετά από έγκριση', 'Access only after approval')}</span>
          </div>
        </section>
        <section className="auth-card-wrap">
          <div className="auth-card">
            {confirm ? (
              <div className="auth-status-card">
                <div className="auth-status-icon">
                  {confirmed && typeof confirmed === 'object' ? <Clock3 size={24} /> : <Mail size={24} />}
                </div>
                {confirmed === undefined ? (
                  <p>{L('Επιβεβαίωση email…', 'Confirming your email…')}</p>
                ) : typeof confirmed === 'object' ? (
                  <>
                    <span className="auth-eyebrow">{L('ΤΟ EMAIL ΕΠΙΒΕΒΑΙΩΘΗΚΕ', 'EMAIL CONFIRMED')}</span>
                    <h2>{L('Αναμονή έγκρισης', 'Awaiting approval')}</h2>
                    <p>
                      {L(
                        `Η αίτησή σας πήγε στον διαχειριστή του ${confirmed.organization || 'νοσοκομείου'}. Μόλις την εγκρίνει θα λάβετε email και θα συνδέεστε με το όνομα χρήστη (ή το email σας) και τον κωδικό που ορίσατε.`,
                        `Your request went to the administrator of ${confirmed.organization || 'the hospital'}. Once approved, you will get an email; then sign in with your username (or email) and the password you set.`,
                      )}
                    </p>
                  </>
                ) : (
                  <>
                    <h2>
                      {confirmed === 'invalid'
                        ? L('Ο σύνδεσμος δεν είναι έγκυρος', 'This link is not valid')
                        : L('Η επιβεβαίωση δεν ολοκληρώθηκε', 'Confirmation failed')}
                    </h2>
                    <p>
                      {confirmed === 'invalid'
                        ? L(
                            'Ο σύνδεσμος επιβεβαίωσης έληξε ή έχει ήδη χρησιμοποιηθεί. Αν δεν έχετε επιβεβαιώσει, κάντε ξανά την εγγραφή από τον σύνδεσμο του νοσοκομείου.',
                            'The confirmation link has expired or was already used. If you have not confirmed yet, sign up again through the hospital link.',
                          )
                        : L('Δοκιμάστε ξανά σε λίγο.', 'Please try again shortly.')}
                    </p>
                  </>
                )}
                <a className="auth-primary" href="#/">
                  {L('Μετάβαση στη σύνδεση', 'Go to sign in')}
                </a>
              </div>
            ) : info === undefined ? (
              <p>{L('Έλεγχος συνδέσμου…', 'Checking link…')}</p>
            ) : info === null ? (
              <div className="auth-status-card">
                <div className="auth-status-icon">
                  <Building2 size={24} />
                </div>
                <h2>{L('Ο σύνδεσμος δεν είναι έγκυρος', 'This link is not valid')}</h2>
                <p>
                  {L(
                    'Ο σύνδεσμος εγγραφής έληξε, ανακλήθηκε ή έχει ήδη χρησιμοποιηθεί. Αν στείλατε ήδη τα στοιχεία σας, περιμένετε το email έγκρισης. Αλλιώς ζητήστε νέο σύνδεσμο από τον διαχειριστή του νοσοκομείου σας.',
                    'The signup link has expired, was revoked or was already used. If you already sent your details, wait for the approval email. Otherwise ask your hospital administrator for a new link.',
                  )}
                </p>
                <a className="auth-primary" href="#/">
                  {L('Μετάβαση στη σύνδεση', 'Go to sign in')}
                </a>
              </div>
            ) : done ? (
              <div className="auth-status-card">
                <div className="auth-status-icon">
                  <Clock3 size={24} />
                </div>
                <span className="auth-eyebrow">{L('Η ΕΓΓΡΑΦΗ ΟΛΟΚΛΗΡΩΘΗΚΕ', 'SIGNED UP')}</span>
                <h2>
                  {done.confirm
                    ? L('Ελέγξτε το email σας', 'Check your email')
                    : L('Αναμονή έγκρισης', 'Awaiting approval')}
                </h2>
                {done.userCode && (
                  <div className="join-username">
                    <span>{L('Το όνομα χρήστη σας', 'Your username')}</span>
                    <strong>{done.userCode}</strong>
                  </div>
                )}
                {done.confirm && (
                  <p>
                    <b>
                      {L(
                        `Στείλαμε email στο ${done.email}. Πατήστε «Επιβεβαίωση email» μέσα σε αυτό: μόνο τότε η αίτησή σας πηγαίνει για έγκριση. Δείτε και στα ανεπιθύμητα.`,
                        `We sent an email to ${done.email}. Press «Confirm email» in it: only then does your request go for approval. Check your spam folder too.`,
                      )}
                    </b>
                  </p>
                )}
                <p>
                  {L(
                    `Κρατήστε το όνομα χρήστη. Μόλις ο διαχειριστής του νοσοκομείου εγκρίνει τον λογαριασμό, θα λάβετε email στο ${done.email} και θα συνδέεστε με το όνομα χρήστη (ή το email σας) και τον κωδικό που ορίσατε.`,
                    `Keep your username. Once the hospital administrator approves the account, you will get an email at ${done.email}; then sign in with the username (or your email) and the password you set.`,
                  )}
                </p>
                <a className="auth-primary" href="#/">
                  {L('Μετάβαση στη σύνδεση', 'Go to sign in')}
                </a>
              </div>
            ) : (
              <>
                <div className="auth-card-title">
                  <div>
                    <span className="auth-eyebrow">{L('ΝΕΟΣ ΛΟΓΑΡΙΑΣΜΟΣ', 'NEW ACCOUNT')}</span>
                    <h2>{L('Εγγραφή', 'Sign up')}</h2>
                    {expires && (
                      <p>{L(`Ο σύνδεσμος ισχύει έως ${expires}.`, `This link is valid until ${expires}.`)}</p>
                    )}
                  </div>
                  <UserRound size={22} />
                </div>
                <form className="auth-form" onSubmit={submit}>
                  <div className="auth-name-row">
                    <label>
                      {L('Όνομα', 'First name')}
                      <div className="auth-input">
                        <input
                          name="firstName"
                          value={firstName}
                          onChange={e => setFirstName(toNameCapitals(e.target.value))}
                          required
                          autoComplete="given-name"
                          placeholder="ΓΙΩΡΓΟΣ"
                        />
                      </div>
                    </label>
                    <label>
                      {L('Επώνυμο', 'Last name')}
                      <div className="auth-input">
                        <input
                          name="lastName"
                          value={lastName}
                          onChange={e => setLastName(toNameCapitals(e.target.value))}
                          required
                          autoComplete="family-name"
                          placeholder="ΝΙΚΟΛΑΟΥ"
                        />
                      </div>
                    </label>
                  </div>
                  <small className="auth-hint">
                    {L(
                      'Μόνο κεφαλαία γράμματα. Το όνομα χρήστη δημιουργείται αυτόματα από τα αρχικά σας (π.χ. GN4827).',
                      'Capital letters only. Your username is generated from your initials (e.g. GN4827).',
                    )}
                  </small>
                  {info.needs_department && (
                    <label>
                      {L('Τμήμα', 'Department')}
                      <div className="auth-input">
                        <Building2 size={17} />
                        <select value={departmentId} onChange={e => setDepartmentId(e.target.value)} required>
                          <option value="">{L('— Επιλέξτε τμήμα —', '— Pick your department —')}</option>
                          {info.departments.map(d => (
                            <option key={d.id} value={d.id}>
                              {localizedName(d.name, lang)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>
                  )}
                  <label>
                    Email
                    <div className="auth-input">
                      <Mail size={17} />
                      {info.email ? (
                        <input name="email" type="email" value={info.email} readOnly />
                      ) : (
                        <input name="email" type="email" required autoComplete="email" />
                      )}
                    </div>
                  </label>
                  <div className="auth-name-row">
                    <label>
                      {L('Κωδικός', 'Password')}
                      <div className="auth-input">
                        <KeyRound size={17} />
                        <input
                          type="password"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          required
                          minLength={8}
                          autoComplete="new-password"
                        />
                      </div>
                    </label>
                    <label>
                      {L('Επανάληψη κωδικού', 'Repeat password')}
                      <div className="auth-input">
                        <KeyRound size={17} />
                        <input
                          type="password"
                          value={password2}
                          onChange={e => setPassword2(e.target.value)}
                          required
                          minLength={8}
                          autoComplete="new-password"
                        />
                      </div>
                    </label>
                  </div>
                  <small className="auth-hint">{L('Τουλάχιστον 8 χαρακτήρες.', 'At least 8 characters.')}</small>
                  {message && <div className="auth-message">{message}</div>}
                  <button className="auth-primary" type="submit" disabled={busy}>
                    {busy ? L('Εγγραφή…', 'Signing up…') : L('Εγγραφή', 'Sign up')}
                  </button>
                </form>
              </>
            )}
          </div>
        </section>
      </main>
      <footer className="auth-footer">
        <span>© 2026 SurgiTrack · v{APP_VERSION}</span>
      </footer>
    </div>
  );
}
