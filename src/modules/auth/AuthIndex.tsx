import {useMemo, useState} from 'react';
import {Eye, EyeOff, LockKeyhole, Mail, ArrowLeft, ShieldCheck, Languages, UserPlus, LogIn} from 'lucide-react';
import {useLibraries} from '../../core/LibraryStore';
import type {SessionUser, UserRole} from '../../store/types';
import {SURGITRACK_DATA_MODE} from '../../config/dataMode';
import {APP_VERSION} from '../../config/appMeta';

type Lang = 'el' | 'en';
type View = 'login' | 'register' | 'forgot';
type InfoView = 'privacy' | 'terms' | 'support' | null;

type Props = {onAuthenticated: (role?: UserRole, user?: SessionUser) => void; goodbye?: string};

const DEMO_ACCESS_KEY = 'SurgiTrack!2026';

const copy = {
  el: {
    product: 'SurgiTrack',
    subtitle: 'Surgical Instrument Traceability',
    suite: 'Healthcare Suite',
    login: 'Σύνδεση',
    register: 'Εγγραφή',
    forgot: 'Ξέχασα τον κωδικό',
    welcome: 'Καλώς ήρθατε',
    loginIntro: 'Συνδεθείτε για να συνεχίσετε στο SurgiTrack.',
    email: 'Email',
    password: 'Κωδικός πρόσβασης',
    remember: 'Να παραμείνω συνδεδεμένος',
    forgotLink: 'Ξέχασα τον κωδικό μου',
    signIn: 'Σύνδεση',
    noAccount: 'Δεν έχετε λογαριασμό;',
    createAccount: 'Εγγραφή / Αίτημα πρόσβασης',
    demo: 'Είσοδος Demo Αποστείρωσης',
    demoHint: 'Άμεση είσοδος στον Χώρο εργασίας Αποστείρωσης για δοκιμές.',
    registerTitle: 'Δημιουργία λογαριασμού',
    registerIntro: 'Υποβάλετε αίτημα πρόσβασης. Ο ρόλος και το τμήμα εγκρίνονται από διαχειριστή.',
    fullName: 'Ονοματεπώνυμο',
    organization: 'Οργανισμός / Νοσοκομείο',
    department: 'Τμήμα',
    confirmPassword: 'Επιβεβαίωση κωδικού',
    terms: 'Αποδέχομαι τους όρους χρήσης και την πολιτική απορρήτου.',
    submitRequest: 'Υποβολή αιτήματος',
    already: 'Έχετε ήδη λογαριασμό;',
    backLogin: 'Επιστροφή στη σύνδεση',
    forgotTitle: 'Επαναφορά κωδικού',
    forgotIntro: 'Εισαγάγετε το email σας για να λάβετε οδηγίες επαναφοράς.',
    sendReset: 'Αποστολή οδηγιών',
    resetSent: 'Οι οδηγίες επαναφοράς καταχωρήθηκαν για αποστολή.',
    requestSent: 'Το αίτημα εγγραφής καταχωρήθηκε για έγκριση.',
    privacy: 'Απόρρητο',
    termsLink: 'Όροι χρήσης',
    support: 'Υποστήριξη',
    secure: 'Ασφαλής πρόσβαση · Role-based permissions',
    required: 'Συμπληρώστε τα υποχρεωτικά πεδία.',
    mismatch: 'Οι κωδικοί δεν είναι ίδιοι.',
    invalidCredentials: 'Το email ή ο κωδικός πρόσβασης δεν είναι σωστά.',
    accessDisabled: 'Η πρόσβαση αυτού του λογαριασμού δεν είναι ενεργή.',
    demoDisabled: 'Η δοκιμαστική πρόσβαση δεν είναι ενεργή για αυτόν τον χρήστη ή οργανισμό.',
    productionAuthUnavailable:
      'Η σύνδεση παραγωγής απαιτεί ενεργό backend authentication και δεν είναι διαθέσιμη σε αυτό το build.',
    close: 'Κλείσιμο',
  },
  en: {
    product: 'SurgiTrack',
    subtitle: 'Surgical Instrument Traceability',
    suite: 'Healthcare Suite',
    login: 'Sign in',
    register: 'Register',
    forgot: 'Forgot password',
    welcome: 'Welcome',
    loginIntro: 'Sign in to continue to SurgiTrack.',
    email: 'Email',
    password: 'Password',
    remember: 'Keep me signed in',
    forgotLink: 'Forgot my password',
    signIn: 'Sign in',
    noAccount: "Don't have an account?",
    createAccount: 'Register / Request access',
    demo: 'Sterilization Demo',
    demoHint: 'Open the Sterilization workspace directly for testing.',
    registerTitle: 'Create account',
    registerIntro: 'Submit an access request. Your role and department are approved by an administrator.',
    fullName: 'Full name',
    organization: 'Organization / Hospital',
    department: 'Department',
    confirmPassword: 'Confirm password',
    terms: 'I accept the terms of use and privacy policy.',
    submitRequest: 'Submit request',
    already: 'Already have an account?',
    backLogin: 'Back to sign in',
    forgotTitle: 'Reset password',
    forgotIntro: 'Enter your email to receive password reset instructions.',
    sendReset: 'Send instructions',
    resetSent: 'Password reset instructions were queued for delivery.',
    requestSent: 'Your registration request was submitted for approval.',
    privacy: 'Privacy',
    termsLink: 'Terms of use',
    support: 'Support',
    secure: 'Secure access · Role-based permissions',
    required: 'Please complete the required fields.',
    mismatch: 'Passwords do not match.',
    invalidCredentials: 'The email or password is incorrect.',
    accessDisabled: 'Access for this account is not active.',
    demoDisabled: 'Demo access is not enabled for this user or organization.',
    productionAuthUnavailable:
      'Production sign-in requires an active backend authentication service and is not available in this build.',
    close: 'Close',
  },
};

export default function AuthIndex({onAuthenticated, goodbye}: Props) {
  const {departments, users, organizations} = useLibraries();
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('surgitrack-lang') as Lang) || 'el');
  const [view, setView] = useState<View>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [infoView, setInfoView] = useState<InfoView>(null);
  const t = useMemo(() => copy[lang], [lang]);
  const switchLang = () => {
    const next = lang === 'el' ? 'en' : 'el';
    setLang(next);
    localStorage.setItem('surgitrack-lang', next);
  };
  const submitLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('');
    if (SURGITRACK_DATA_MODE !== 'DEMO') {
      setMessage(t.productionAuthUnavailable);
      return;
    }
    const data = new FormData(e.currentTarget);
    const email = String(data.get('email') || '')
      .trim()
      .toLowerCase();
    const password = String(data.get('password') || '');
    const user = users.find(candidate => candidate.email.toLowerCase() === email);
    if (!user || password !== DEMO_ACCESS_KEY) {
      setMessage(t.invalidCredentials);
      return;
    }
    const organization = organizations.find(org => org.id === user.organizationId);
    if (!user.active || (organization && !organization.active)) {
      setMessage(t.accessDisabled);
      return;
    }
    if (user.role !== 'ADMIN' && (!user.demoEnabled || !organization?.demoEnabled)) {
      setMessage(t.demoDisabled);
      return;
    }
    onAuthenticated(user.role, {
      id: user.id,
      name: user.name,
      role: user.role,
      department: user.department,
    });
  };
  const submitRegister = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('');
    const data = new FormData(e.currentTarget);
    const p = String(data.get('password') || '');
    const cp = String(data.get('confirmPassword') || '');
    if (!data.get('fullName') || !data.get('email') || !data.get('organization') || !p) {
      setMessage(t.required);
      return;
    }
    if (p !== cp) {
      setMessage(t.mismatch);
      return;
    }
    setMessage(t.requestSent);
  };
  const submitForgot = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(t.resetSent);
  };
  const changeView = (next: View) => {
    setView(next);
    setMessage('');
    setShowPassword(false);
  };
  return (
    <div className="auth-page">
      <header className="auth-topbar">
        <div className="auth-mini-brand">
          <div className="auth-brand-mark">S</div>
          <div>
            <strong>{t.product}</strong>
            <span>{t.suite}</span>
          </div>
        </div>
        <button className="auth-lang" onClick={switchLang}>
          <Languages size={16} />
          <span>{lang === 'el' ? 'EN' : 'EL'}</span>
        </button>
      </header>
      <main className="auth-main">
        <section className="auth-intro">
          <div className="auth-logo">S</div>
          <span className="auth-eyebrow">{t.suite}</span>
          <h1>{t.product}</h1>
          <p className="auth-product-subtitle">{t.subtitle}</p>
          <div className="auth-security">
            <ShieldCheck size={18} />
            <span>{t.secure}</span>
          </div>
        </section>
        <section className="auth-card-wrap">
          {goodbye && <div className="auth-goodbye">{goodbye}</div>}
          <div className="auth-card">
            {view === 'login' && (
              <>
                <div className="auth-card-title">
                  <div>
                    <span className="auth-eyebrow">{t.login}</span>
                    <h2>{t.welcome}</h2>
                    <p>{t.loginIntro}</p>
                  </div>
                  <LogIn size={22} />
                </div>
                <form className="auth-form" onSubmit={submitLogin}>
                  <label>
                    {t.email}
                    <div className="auth-input">
                      <Mail size={17} />
                      <input name="email" type="email" required autoComplete="email" placeholder="name@hospital.gr" />
                    </div>
                  </label>
                  <label>
                    {t.password}
                    <div className="auth-input">
                      <LockKeyhole size={17} />
                      <input
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                      />
                      <button type="button" onClick={() => setShowPassword(v => !v)} aria-label="toggle password">
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </label>
                  <div className="auth-form-row">
                    <label className="auth-check">
                      <input type="checkbox" />
                      <span>{t.remember}</span>
                    </label>
                    <button type="button" className="auth-text-btn" onClick={() => changeView('forgot')}>
                      {t.forgotLink}
                    </button>
                  </div>
                  {message && <div className="auth-message">{message}</div>}
                  <button className="auth-primary" type="submit">
                    {t.signIn}
                  </button>
                </form>
                <div className="auth-bottom-question">
                  <span>{t.noAccount}</span>
                  <button onClick={() => changeView('register')}>{t.createAccount}</button>
                </div>
              </>
            )}
            {view === 'register' && (
              <>
                <button className="auth-back" onClick={() => changeView('login')}>
                  <ArrowLeft size={15} />
                  {t.backLogin}
                </button>
                <div className="auth-card-title">
                  <div>
                    <span className="auth-eyebrow">{t.register}</span>
                    <h2>{t.registerTitle}</h2>
                    <p>{t.registerIntro}</p>
                  </div>
                  <UserPlus size={22} />
                </div>
                <form className="auth-form" onSubmit={submitRegister}>
                  <div className="auth-two-col">
                    <label>
                      {t.fullName}
                      <input name="fullName" required />
                    </label>
                    <label>
                      {t.email}
                      <input name="email" type="email" required />
                    </label>
                  </div>
                  <div className="auth-two-col">
                    <label>
                      {t.organization}
                      <input name="organization" required />
                    </label>
                    <label>
                      {t.department}
                      <select name="department">
                        {departments.map(d => (
                          <option key={d.id} value={d.el}>
                            {lang === 'el' ? d.el : d.en}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="auth-two-col">
                    <label>
                      {t.password}
                      <input name="password" type="password" required />
                    </label>
                    <label>
                      {t.confirmPassword}
                      <input name="confirmPassword" type="password" required />
                    </label>
                  </div>
                  <label className="auth-check auth-terms">
                    <input name="terms" type="checkbox" required />
                    <span>{t.terms}</span>
                  </label>
                  {message && <div className="auth-message">{message}</div>}
                  <button className="auth-primary" type="submit">
                    {t.submitRequest}
                  </button>
                </form>
                <div className="auth-bottom-question">
                  <span>{t.already}</span>
                  <button onClick={() => changeView('login')}>{t.login}</button>
                </div>
              </>
            )}
            {view === 'forgot' && (
              <>
                <button className="auth-back" onClick={() => changeView('login')}>
                  <ArrowLeft size={15} />
                  {t.backLogin}
                </button>
                <div className="auth-card-title">
                  <div>
                    <span className="auth-eyebrow">{t.forgot}</span>
                    <h2>{t.forgotTitle}</h2>
                    <p>{t.forgotIntro}</p>
                  </div>
                  <LockKeyhole size={22} />
                </div>
                <form className="auth-form" onSubmit={submitForgot}>
                  <label>
                    {t.email}
                    <div className="auth-input">
                      <Mail size={17} />
                      <input type="email" required placeholder="name@hospital.gr" />
                    </div>
                  </label>
                  {message && <div className="auth-message">{message}</div>}
                  <button className="auth-primary" type="submit">
                    {t.sendReset}
                  </button>
                </form>
              </>
            )}
          </div>
        </section>
      </main>
      <footer className="auth-footer">
        <span>© 2026 SurgiTrack · v{APP_VERSION}</span>
        <nav>
          <button onClick={() => setInfoView('privacy')}>{t.privacy}</button>
          <button onClick={() => setInfoView('terms')}>{t.termsLink}</button>
          <button onClick={() => setInfoView('support')}>{t.support}</button>
        </nav>
      </footer>
      {infoView && (
        <div className="auth-info-backdrop" role="presentation" onMouseDown={() => setInfoView(null)}>
          <section className="auth-info-modal" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
            <header>
              <strong>{infoView === 'privacy' ? t.privacy : infoView === 'terms' ? t.termsLink : t.support}</strong>
              <button onClick={() => setInfoView(null)} aria-label={t.close}>
                <ArrowLeft size={16} />
              </button>
            </header>
            <div>
              {infoView === 'privacy' ? (
                <p>
                  {lang === 'el'
                    ? 'Η τελική πολιτική απορρήτου θα συνδεθεί με την εγκατάσταση παραγωγής και τον υπεύθυνο επεξεργασίας δεδομένων του οργανισμού. Η έκδοση Demo χρησιμοποιεί μόνο δοκιμαστικά δεδομένα.'
                    : 'The final privacy policy will be linked to the production installation and the organization’s data controller. The Demo build uses test data only.'}
                </p>
              ) : infoView === 'terms' ? (
                <p>
                  {lang === 'el'
                    ? 'Οι τελικοί όροι χρήσης θα οριστούν για την παραγωγική εγκατάσταση. Η παρούσα έκδοση προορίζεται για δοκιμή και αξιολόγηση της λειτουργικότητας του SurgiTrack.'
                    : 'Final terms of use will be defined for the production installation. This build is intended for testing and evaluation of SurgiTrack functionality.'}
                </p>
              ) : (
                <p>
                  {lang === 'el'
                    ? 'Για υποστήριξη στην έκδοση Demo, απευθυνθείτε στον διαχειριστή της εγκατάστασης. Τα στοιχεία help desk θα οριστούν στην παραγωγική έκδοση.'
                    : 'For support in the Demo build, contact the installation administrator. Help desk contact details will be configured in production.'}
                </p>
              )}
            </div>
            <button className="auth-primary" onClick={() => setInfoView(null)}>
              {t.close}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
