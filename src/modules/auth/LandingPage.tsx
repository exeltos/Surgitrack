import {useState} from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  FlaskConical,
  Globe,
  Languages,
  LogIn,
  Mail,
  PenLine,
  Phone,
  QrCode,
  RefreshCcw,
  ScanBarcode,
  ShieldCheck,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';
import BrandMark from '../../components/layout/BrandMark';
import {COMPANY_CONTACT} from '../../config/appMeta';

type Lang = 'el' | 'en';

const copy = {
  el: {
    nav: {features: 'Λειτουργίες', how: 'Πώς δουλεύει', contact: 'Επικοινωνία'},
    signIn: 'Σύνδεση',
    eyebrow: 'Ιχνηλασιμότητα χειρουργικών εργαλείων',
    headline: 'Κάθε εργαλείο,',
    headlineAccent: 'σε κάθε βήμα.',
    lead: 'Από το χειρουργείο στην Αποστείρωση και πίσω: παραλαβή, κλίβανος, αποδέσμευση και παράδοση, με υπογραφές, λήξεις και πλήρες ιστορικό για κάθε Σετ και εργαλείο.',
    ctaContact: 'Ζητήστε παρουσίαση',
    points: ['Χωρίς εγκατάσταση', 'Σάρωση από το κινητό', 'Πλήρες ιστορικό'],
    previewLabel: 'Παράδειγμα από την εφαρμογή',
    previewTitle: 'Αποστείρωση · σήμερα',
    stages: ['Παραλαβή', 'Καθαρισμός', 'Σύνθεση', 'Κλίβανος', 'Αποδέσμευση', 'Παράδοση'],
    rows: [
      {code: 'S000324', name: 'Νευροχειρουργικό βασικό', state: 'Στον κλίβανο', tone: 'info'},
      {code: 'S000332', name: 'Ορθοπεδικό γόνατος', state: 'Έτοιμο', tone: 'ok'},
      {code: 'S000326', name: 'Σετ καισαρικής τομής', state: 'Λήγει σε 3 ημέρες', tone: 'warn'},
    ],
    featuresTitle: 'Όλη η πορεία του εργαλείου, σε ένα σημείο',
    featuresLead: 'Φτιαγμένο μαζί με Κεντρική Αποστείρωση και χειρουργεία, για τη δουλειά της ημέρας.',
    features: [
      [
        'Πλήρης κύκλος αποστείρωσης',
        'Παραλαβή, καθαρισμός, σύνθεση, συσκευασία, κλίβανος, αποδέσμευση και παράδοση, βήμα βήμα.',
      ],
      [
        'Σάρωση από το κινητό',
        'Barcode και QR με την κάμερα του κινητού ή με σαρωτή. Το τμήμα βλέπει αμέσως τι έχει στην αποθήκη του.',
      ],
      [
        'Υπογραφές παράδοσης',
        'Ο παραλήπτης υπογράφει με τον κωδικό του ή δείχνοντας το προσωπικό του QR, που αλλάζει κάθε 30 δευτερόλεπτα.',
      ],
      ['Λήξεις και ανακλήσεις', 'Υπενθύμιση πριν λήξει η αποστείρωση, και ανάκληση φορτίου με όλα όσα περιείχε.'],
      ['Δοκιμές κλιβάνων και πλυντηρίων', 'Bowie-Dick, δοκιμή κενού, βιολογικοί δείκτες: ό,τι απέτυχε δεν φορτώνεται.'],
      [
        'Ιχνηλάτηση και αναφορές',
        'Σε ποιον ασθενή χρησιμοποιήθηκε κάθε Σετ, ποιος το χειρίστηκε και πότε, σε εκτυπώσιμες αναφορές.',
      ],
    ],
    howTitle: 'Πώς δουλεύει',
    steps: [
      ['Καταγραφή', 'Τα Σετ και τα εργαλεία σας, με barcode το καθένα.'],
      ['Σάρωση', 'Σε κάθε βήμα σκανάρετε· η εφαρμογή ξέρει το επόμενο.'],
      ['Υπογραφή', 'Παράδοση και παραλαβή με επιβεβαίωση του προσώπου.'],
      ['Ιστορικό', 'Όλα καταγράφονται και βρίσκονται σε δευτερόλεπτα.'],
    ],
    contactTitle: 'Ας μιλήσουμε',
    contactLead:
      'Θέλετε να δείτε το SurgiTrack στο νοσοκομείο σας; Επικοινωνήστε μαζί μας για παρουσίαση ή για οποιαδήποτε ερώτηση.',
    company: 'Εταιρεία',
    email: 'Email',
    phone: 'Τηλέφωνο',
    website: 'Ιστοσελίδα',
    sendEmail: 'Στείλτε email',
    call: 'Καλέστε μας',
    mailSubject: 'SurgiTrack: αίτημα παρουσίασης',
    footer: 'Ιχνηλασιμότητα χειρουργικών εργαλείων',
    by: 'από την',
  },
  en: {
    nav: {features: 'Features', how: 'How it works', contact: 'Contact'},
    signIn: 'Sign in',
    eyebrow: 'Surgical instrument traceability',
    headline: 'Every instrument,',
    headlineAccent: 'at every step.',
    lead: 'From the operating theatre to Sterilization and back: receipt, sterilizer, release and delivery, with signatures, expiry dates and the full history of every Set and instrument.',
    ctaContact: 'Request a demo',
    points: ['Nothing to install', 'Scanning from the phone', 'Full history'],
    previewLabel: 'An example from the app',
    previewTitle: 'Sterilization · today',
    stages: ['Receipt', 'Cleaning', 'Assembly', 'Sterilizer', 'Release', 'Delivery'],
    rows: [
      {code: 'S000324', name: 'Neurosurgery basic', state: 'In the sterilizer', tone: 'info'},
      {code: 'S000332', name: 'Knee orthopaedic', state: 'Ready', tone: 'ok'},
      {code: 'S000326', name: 'Caesarean section set', state: 'Expires in 3 days', tone: 'warn'},
    ],
    featuresTitle: 'The whole path of an instrument, in one place',
    featuresLead: 'Built with Central Sterilization and operating theatres, for the work of the day.',
    features: [
      [
        'The whole sterilization cycle',
        'Receipt, cleaning, assembly, packaging, sterilizer, release and delivery, step by step.',
      ],
      [
        'Scanning from the phone',
        "Barcodes and QR codes with the phone's camera or a scanner. A department sees at once what is in its storage.",
      ],
      [
        'Handover signatures',
        'The recipient signs with their code, or by showing their personal QR, which changes every 30 seconds.',
      ],
      ['Expiry and recalls', 'A reminder before sterility expires, and a load recall with everything it held.'],
      ['Sterilizer and washer tests', 'Bowie-Dick, vacuum test, biological indicators: what failed is not loaded.'],
      [
        'Traceability and reports',
        'Which patient each Set was used on, who handled it and when, in printable reports.',
      ],
    ],
    howTitle: 'How it works',
    steps: [
      ['Register', 'Your Sets and instruments, each with a barcode.'],
      ['Scan', 'Scan at every step; the app knows the next one.'],
      ['Sign', 'Delivery and receipt, confirmed by the person.'],
      ['History', 'Everything is recorded and found in seconds.'],
    ],
    contactTitle: "Let's talk",
    contactLead: 'Would you like to see SurgiTrack in your hospital? Contact us for a demo or any question.',
    company: 'Company',
    email: 'Email',
    phone: 'Phone',
    website: 'Website',
    sendEmail: 'Send an email',
    call: 'Call us',
    mailSubject: 'SurgiTrack: demo request',
    footer: 'Surgical instrument traceability',
    by: 'by',
  },
} as const;

const FEATURE_ICONS: LucideIcon[] = [RefreshCcw, Smartphone, PenLine, CalendarClock, FlaskConical, ShieldCheck];
const STEP_ICONS: LucideIcon[] = [BadgeCheck, ScanBarcode, QrCode, ShieldCheck];

/**
 * The first page of www.surgitrack.eu for someone not signed in: what SurgiTrack does and how to reach Exeltos.
 * «Σύνδεση» opens the sign-in screen; someone already signed in never sees this page.
 */
export default function LandingPage({onSignIn}: {onSignIn: () => void}) {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return (localStorage.getItem('surgitrack-lang') as Lang) || 'el';
    } catch {
      return 'el';
    }
  });
  const t = copy[lang];
  const switchLang = () => {
    const next = lang === 'el' ? 'en' : 'el';
    setLang(next);
    try {
      localStorage.setItem('surgitrack-lang', next);
    } catch {
      // The choice simply is not remembered.
    }
    document.documentElement.lang = next;
  };
  const phoneHref = `tel:+30${COMPANY_CONTACT.phone.replace(/\s+/g, '')}`;
  const mailHref = `mailto:${COMPANY_CONTACT.email}?subject=${encodeURIComponent(t.mailSubject)}`;
  const toSection = (id: string) => (e: React.MouseEvent) => {
    // The app routes by the hash: scroll to the section instead of changing it.
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({behavior: 'smooth', block: 'start'});
  };

  return (
    <div className="landing" lang={lang}>
      <header className="landing-bar">
        <div className="landing-wrap landing-bar-inner">
          <a className="landing-brand" href="#/" aria-label="SurgiTrack">
            <BrandMark className="landing-brand-mark" />
            <span>
              <strong>SurgiTrack</strong>
              <small>Trace Every Instrument</small>
            </span>
          </a>
          <nav className="landing-nav" aria-label={lang === 'el' ? 'Ενότητες' : 'Sections'}>
            <a href="#features" onClick={toSection('features')}>
              {t.nav.features}
            </a>
            <a href="#how" onClick={toSection('how')}>
              {t.nav.how}
            </a>
            <a href="#contact" onClick={toSection('contact')}>
              {t.nav.contact}
            </a>
          </nav>
          <div className="landing-bar-actions">
            <button type="button" className="landing-lang" onClick={switchLang}>
              <Languages size={16} aria-hidden="true" />
              {lang === 'el' ? 'EN' : 'EL'}
            </button>
            <button type="button" className="landing-signin" onClick={onSignIn}>
              <LogIn size={16} aria-hidden="true" />
              {t.signIn}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-wrap landing-hero-inner">
            <div className="landing-hero-text">
              <span className="landing-eyebrow">
                <ShieldCheck size={14} aria-hidden="true" />
                {t.eyebrow}
              </span>
              <h1>
                {t.headline} <em>{t.headlineAccent}</em>
              </h1>
              <p className="landing-lead">{t.lead}</p>
              <div className="landing-cta">
                <a className="landing-btn landing-btn-solid" href="#contact" onClick={toSection('contact')}>
                  {t.ctaContact}
                  <ArrowRight size={18} aria-hidden="true" />
                </a>
              </div>
              <ul className="landing-points">
                {t.points.map(point => (
                  <li key={point}>
                    <BadgeCheck size={16} aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <figure className="landing-preview" aria-label={t.previewLabel}>
              <figcaption>
                <ScanBarcode size={16} aria-hidden="true" />
                {t.previewTitle}
              </figcaption>
              <ol className="landing-stages">
                {t.stages.map((stage, index) => (
                  <li key={stage} className={index < 3 ? 'done' : index === 3 ? 'now' : ''}>
                    {stage}
                  </li>
                ))}
              </ol>
              <ul className="landing-rows">
                {t.rows.map(row => (
                  <li key={row.code}>
                    <span className="landing-row-icon" aria-hidden="true">
                      <ScanBarcode size={16} />
                    </span>
                    <span className="landing-row-main">
                      <code>{row.code}</code>
                      <b>{row.name}</b>
                    </span>
                    <span className={`landing-badge ${row.tone}`}>{row.state}</span>
                  </li>
                ))}
              </ul>
            </figure>
          </div>
        </section>

        <section className="landing-section" id="features">
          <div className="landing-wrap">
            <h2>{t.featuresTitle}</h2>
            <p className="landing-section-lead">{t.featuresLead}</p>
            <div className="landing-features">
              {t.features.map(([title, text], index) => {
                const Icon = FEATURE_ICONS[index];
                return (
                  <article key={title} className="landing-feature">
                    <span className="landing-feature-icon" aria-hidden="true">
                      <Icon size={20} />
                    </span>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="landing-section alt" id="how">
          <div className="landing-wrap">
            <h2>{t.howTitle}</h2>
            <ol className="landing-steps">
              {t.steps.map(([title, text], index) => {
                const Icon = STEP_ICONS[index];
                return (
                  <li key={title}>
                    <span className="landing-step-icon" aria-hidden="true">
                      <Icon size={20} />
                    </span>
                    <b>
                      {index + 1}. {title}
                    </b>
                    <p>{text}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section className="landing-section" id="contact">
          <div className="landing-wrap landing-contact">
            <div>
              <h2>{t.contactTitle}</h2>
              <p className="landing-section-lead">{t.contactLead}</p>
              <div className="landing-cta">
                <a className="landing-btn landing-btn-solid" href={mailHref}>
                  <Mail size={18} aria-hidden="true" />
                  {t.sendEmail}
                </a>
                <a className="landing-btn landing-btn-outline" href={phoneHref}>
                  <Phone size={18} aria-hidden="true" />
                  {t.call}
                </a>
              </div>
            </div>
            <dl className="landing-contact-card">
              <div>
                <dt>
                  <Building2 size={16} aria-hidden="true" />
                  {t.company}
                </dt>
                <dd>{COMPANY_CONTACT.name}</dd>
              </div>
              <div>
                <dt>
                  <Mail size={16} aria-hidden="true" />
                  {t.email}
                </dt>
                <dd>
                  <a href={mailHref}>{COMPANY_CONTACT.email}</a>
                </dd>
              </div>
              <div>
                <dt>
                  <Phone size={16} aria-hidden="true" />
                  {t.phone}
                </dt>
                <dd>
                  <a href={phoneHref}>{COMPANY_CONTACT.phone}</a>
                </dd>
              </div>
              <div>
                <dt>
                  <Globe size={16} aria-hidden="true" />
                  {t.website}
                </dt>
                <dd>
                  <a href={COMPANY_CONTACT.website} target="_blank" rel="noopener noreferrer">
                    {COMPANY_CONTACT.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </main>

      <footer className="landing-foot">
        <div className="landing-wrap">
          © {new Date().getFullYear()} SurgiTrack · {t.footer} · {t.by}{' '}
          <a href={COMPANY_CONTACT.website} target="_blank" rel="noopener noreferrer">
            {COMPANY_CONTACT.name}
          </a>
        </div>
      </footer>
    </div>
  );
}
