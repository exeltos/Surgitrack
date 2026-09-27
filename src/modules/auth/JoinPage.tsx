import {useEffect, useState} from 'react';
import {Building2, Eye, EyeOff, Languages, LockKeyhole, Mail, MailCheck, ShieldCheck, UserRound} from 'lucide-react';
import {FunctionsHttpError} from '@supabase/supabase-js';
import {supabase} from '../../lib/supabase';
import {useAppPreferences} from '../../core/AppPreferences';
import {APP_VERSION} from '../../config/appMeta';

type LinkInfo = {
  organization_name: string;
  expires_at: string;
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
    case 'confirmation_failed':
      return el
        ? 'Δεν ήταν δυνατή η αποστολή του email επιβεβαίωσης. Δοκιμάστε ξανά σε λίγο.'
        : 'The confirmation email could not be sent. Please try again shortly.';
    case 'too_many_attempts':
      return el ? 'Πολλές προσπάθειες. Δοκιμάστε ξανά αργότερα.' : 'Too many attempts. Try again later.';
    case 'invalid_input':
      return el ? 'Ελέγξτε τα στοιχεία της φόρμας.' : 'Check the form fields.';
    default:
      return el ? 'Η εγγραφή δεν ολοκληρώθηκε. Δοκιμάστε ξανά.' : 'Signup failed. Please try again.';
  }
};

/**
 * Public signup through a hospital's link (#/join/<token>). The applicant picks their department;
 * after confirming their email the hospital admin approves them and sets their role.
 */
export default function JoinPage({token}: {token: string}) {
  const {lang, setLang} = useAppPreferences();
  const el = lang === 'el';
  const L = (gr: string, en: string) => (el ? gr : en);
  const [info, setInfo] = useState<LinkInfo | null>();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState('');

  useEffect(() => {
    void supabase.rpc('signup_link_info', {p_token: token}).then(({data, error}) => {
      setInfo(error ? null : ((data as LinkInfo | null) ?? null));
    });
  }, [token]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('');
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') || '')
      .trim()
      .toLowerCase();
    const password = String(form.get('password') || '');
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first || !last || !departmentId) {
      setMessage(L('Συμπληρώστε όλα τα πεδία.', 'Fill in all fields.'));
      return;
    }
    if (password.length < 8) {
      setMessage(L('Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.', 'Password must be at least 8 characters.'));
      return;
    }
    if (password !== String(form.get('confirmPassword') || '')) {
      setMessage(L('Οι κωδικοί δεν είναι ίδιοι.', 'Passwords do not match.'));
      return;
    }
    setBusy(true);
    const {error} = await supabase.functions.invoke('staff-signup', {
      body: {
        token,
        first_name: first,
        last_name: last,
        email,
        password,
        department_id: departmentId,
        redirect_to: window.location.origin,
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

  const expires = info ? new Date(info.expires_at).toLocaleDateString(el ? 'el-GR' : 'en-GB') : '';
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
              'Δημιουργήστε λογαριασμό και επιλέξτε το τμήμα σας. Ο διαχειριστής του νοσοκομείου θα εγκρίνει την πρόσβασή σας.',
              'Create your account and pick your department. The hospital administrator will approve your access.',
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
                    'Ο σύνδεσμος εγγραφής έληξε ή ανακλήθηκε. Ζητήστε νέο σύνδεσμο από τον διαχειριστή του νοσοκομείου σας.',
                    'The signup link has expired or was revoked. Ask your hospital administrator for a new link.',
                  )}
                </p>
                <a className="auth-primary" href="#/">
                  {L('Μετάβαση στη σύνδεση', 'Go to sign in')}
                </a>
              </div>
            ) : sentTo ? (
              <div className="auth-status-card">
                <div className="auth-status-icon">
                  <MailCheck size={24} />
                </div>
                <span className="auth-eyebrow">{L('ΣΧΕΔΟΝ ΕΤΟΙΜΟ', 'ALMOST DONE')}</span>
                <h2>{L('Επιβεβαιώστε το email σας', 'Confirm your email')}</h2>
                <p>
                  {L(
                    `Στείλαμε σύνδεσμο επιβεβαίωσης στο ${sentTo}. Μετά την επιβεβαίωση, το αίτημά σας πηγαίνει στον διαχειριστή του νοσοκομείου. Όταν εγκριθεί, θα λάβετε email με το όνομα χρήστη σας.`,
                    `We sent a confirmation link to ${sentTo}. Once confirmed, your request goes to the hospital administrator. When approved, you will receive an email with your username.`,
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
                    <p>{L(`Ο σύνδεσμος ισχύει έως ${expires}.`, `This link is valid until ${expires}.`)}</p>
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
                  <label>
                    {L('Τμήμα', 'Department')}
                    <div className="auth-input">
                      <Building2 size={17} />
                      <select value={departmentId} onChange={e => setDepartmentId(e.target.value)} required>
                        <option value="">{L('— Επιλέξτε τμήμα —', '— Pick your department —')}</option>
                        {info.departments.map(d => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>
                  <label>
                    Email
                    <div className="auth-input">
                      <Mail size={17} />
                      <input name="email" type="email" required autoComplete="email" />
                    </div>
                  </label>
                  <label>
                    {L('Κωδικός πρόσβασης', 'Password')}
                    <div className="auth-input">
                      <LockKeyhole size={17} />
                      <input
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        autoComplete="new-password"
                      />
                      <button type="button" onClick={() => setShowPassword(v => !v)}>
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </label>
                  <label>
                    {L('Επιβεβαίωση κωδικού', 'Confirm password')}
                    <div className="auth-input">
                      <LockKeyhole size={17} />
                      <input
                        name="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                      />
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
