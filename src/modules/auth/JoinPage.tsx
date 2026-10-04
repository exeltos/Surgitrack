import {useEffect, useState} from 'react';
import {Building2, Clock3, Languages, Mail, ShieldCheck, UserRound} from 'lucide-react';
import {FunctionsHttpError} from '@supabase/supabase-js';
import {supabase} from '../../lib/supabase';
import {useAppPreferences} from '../../core/AppPreferences';
import {localizedName} from '../../core/glossary';
import {APP_VERSION} from '../../config/appMeta';

type LinkInfo = {
  organization_name: string;
  /** The hospital link's expiry; none for a personal invitation. */
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
    case 'invalid_input':
      return el ? 'Ελέγξτε τα στοιχεία της φόρμας.' : 'Check the form fields.';
    default:
      return el ? 'Η εγγραφή δεν ολοκληρώθηκε. Δοκιμάστε ξανά.' : 'Signup failed. Please try again.';
  }
};

/**
 * Public signup (#/join/<token>), through a hospital's link or a personal email invitation. The
 * applicant fills in their details only; the hospital admin checks and approves them, and then the
 * applicant gets an email with their username and a link to set their password.
 */
export default function JoinPage({token}: {token: string}) {
  const {lang, setLang} = useAppPreferences();
  const el = lang === 'el';
  const L = (gr: string, en: string) => (el ? gr : en);
  const [info, setInfo] = useState<LinkInfo | null>();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState('');

  useEffect(() => {
    void supabase.functions.invoke<LinkInfo>('staff-signup', {body: {action: 'info', token}}).then(({data, error}) => {
      setInfo(error || !data ? null : data);
      if (data?.department_id) setDepartmentId(data.department_id);
    });
  }, [token]);

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
    setBusy(true);
    const {error} = await supabase.functions.invoke('staff-signup', {
      body: {
        token,
        first_name: first,
        last_name: last,
        email,
        department_id: departmentId,
        origin: window.location.origin,
      },
    });
    setBusy(false);
    if (error) {
      let code = '';
      if (error instanceof FunctionsHttpError) {
        code = String((await (error.context as Response).json().catch(() => ({})))?.error || '');
      }
      setMessage(errorText(code, el));
      return;
    }
    setSentTo(email);
  };

  const expires = info?.expires_at ? new Date(info.expires_at).toLocaleDateString(el ? 'el-GR' : 'en-GB') : '';
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
              'Συμπληρώστε τα στοιχεία σας. Μετά την έγκριση από τον διαχειριστή του νοσοκομείου θα λάβετε email με το όνομα χρήστη σας και σύνδεσμο για να ορίσετε τον κωδικό σας.',
              'Fill in your details. Once the hospital administrator approves you, you will get an email with your username and a link to set your password.',
            )}
          </p>
          <div className="auth-security">
            <ShieldCheck size={18} />
            <span>{L('Πρόσβαση μόνο μετά από έγκριση', 'Access only after approval')}</span>
          </div>
        </section>
        <section className="auth-card-wrap">
          <div className="auth-card">
            {info === undefined ? (
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
            ) : sentTo ? (
              <div className="auth-status-card">
                <div className="auth-status-icon">
                  <Clock3 size={24} />
                </div>
                <span className="auth-eyebrow">{L('ΤΟ ΑΙΤΗΜΑ ΣΤΑΛΘΗΚΕ', 'REQUEST SENT')}</span>
                <h2>{L('Αναμονή έγκρισης', 'Awaiting approval')}</h2>
                <p>
                  {L(
                    `Παρακαλούμε αναμείνατε την έγκριση και την έκδοση του ονόματος χρήστη σας. Μόλις ο διαχειριστής του νοσοκομείου εγκρίνει το αίτημα, θα λάβετε email στο ${sentTo} με το όνομα χρήστη και σύνδεσμο για να ορίσετε τον κωδικό σας.`,
                    `Please wait for approval and your username. Once the hospital administrator approves the request, you will get an email at ${sentTo} with your username and a link to set your password.`,
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
                    <h2>{L('Αίτημα πρόσβασης', 'Request access')}</h2>
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
                  {message && <div className="auth-message">{message}</div>}
                  <button className="auth-primary" type="submit" disabled={busy}>
                    {busy ? L('Αποστολή…', 'Sending…') : L('Υποβολή αιτήματος', 'Submit request')}
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
