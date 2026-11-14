import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {CheckCircle2, Send, X} from 'lucide-react';
import {sendContactRequest, type ContactForm, type ContactResult} from '../../data/cloud/contactRequests';

type Lang = 'el' | 'en';

const copy = {
  el: {
    title: 'Ζητήστε παρουσίαση',
    intro: 'Αφήστε μας τα στοιχεία σας και θα επικοινωνήσουμε μαζί σας για να δείτε το SurgiTrack στην πράξη.',
    name: 'Ονοματεπώνυμο',
    organization: 'Νοσοκομείο / οργανισμός',
    role: 'Ρόλος / θέση',
    rolePlaceholder: 'π.χ. Προϊστάμενος Αποστείρωσης',
    email: 'Email',
    phone: 'Τηλέφωνο',
    message: 'Μήνυμα',
    messagePlaceholder: 'Τι θα θέλατε να δείτε ή να μάθετε;',
    required: 'υποχρεωτικό',
    send: 'Αποστολή',
    sending: 'Αποστολή…',
    cancel: 'Ακύρωση',
    close: 'Κλείσιμο',
    doneTitle: 'Ευχαριστούμε!',
    done: 'Λάβαμε το αίτημά σας και θα επικοινωνήσουμε μαζί σας σύντομα.',
    invalid: 'Συμπληρώστε ονοματεπώνυμο, ένα σωστό email και ένα μήνυμα.',
    tooMany: 'Στείλατε ήδη αρκετά αιτήματα. Δοκιμάστε ξανά σε λίγο ή στείλτε μας email.',
    unavailable: 'Το αίτημα δεν στάλθηκε. Δοκιμάστε ξανά ή στείλτε μας email στο',
  },
  en: {
    title: 'Request a demo',
    intro: 'Leave us your details and we will contact you to show you SurgiTrack in practice.',
    name: 'Full name',
    organization: 'Hospital / organisation',
    role: 'Role / position',
    rolePlaceholder: 'e.g. Sterilization supervisor',
    email: 'Email',
    phone: 'Phone',
    message: 'Message',
    messagePlaceholder: 'What would you like to see or know?',
    required: 'required',
    send: 'Send',
    sending: 'Sending…',
    cancel: 'Cancel',
    close: 'Close',
    doneTitle: 'Thank you!',
    done: 'We received your request and will contact you soon.',
    invalid: 'Fill in your name, a valid email and a message.',
    tooMany: 'You have already sent several requests. Try again later or email us.',
    unavailable: 'The request was not sent. Try again or email us at',
  },
} as const;

const EMPTY: ContactForm = {name: '', organization: '', role: '', email: '', phone: '', message: '', website: ''};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * «Ζητήστε παρουσίαση»: the visitor's name, hospital, role, email, phone and message, sent to contact-request
 * (stored for Studio → Αιτήματα παρουσίασης and emailed to the company). Over the whole page, closed with Escape.
 */
export default function ContactFormDialog({lang, email, onClose}: {lang: Lang; email: string; onClose: () => void}) {
  const t = copy[lang];
  const [form, setForm] = useState<ContactForm>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ContactResult | null>(null);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const set = (key: keyof ContactForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({...f, [key]: e.target.value}));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2 || !EMAIL.test(form.email.trim()) || form.message.trim().length < 5) {
      setResult({ok: false, reason: 'invalid'});
      return;
    }
    setBusy(true);
    setResult(await sendContactRequest(form));
    setBusy(false);
  };

  const field = (
    key: keyof ContactForm,
    label: string,
    options: {type?: string; required?: boolean; placeholder?: string; auto?: string} = {},
  ) => (
    <label className="contact-field">
      <span>
        {label}
        {options.required && <small> · {t.required}</small>}
      </span>
      <input
        ref={key === 'name' ? first : undefined}
        type={options.type || 'text'}
        value={form[key] || ''}
        onChange={set(key)}
        required={options.required}
        placeholder={options.placeholder}
        autoComplete={options.auto}
        disabled={busy}
      />
    </label>
  );

  return createPortal(
    <div className="contact-backdrop" onMouseDown={e => e.currentTarget === e.target && !busy && onClose()}>
      <section className="contact-dialog" role="dialog" aria-modal="true" aria-labelledby="contact-title" lang={lang}>
        <button type="button" className="contact-close" onClick={onClose} aria-label={t.close}>
          <X size={18} />
        </button>
        {result?.ok ? (
          <div className="contact-done" role="status">
            <CheckCircle2 size={44} aria-hidden="true" />
            <h2 id="contact-title">{t.doneTitle}</h2>
            <p>{t.done}</p>
            <button type="button" className="landing-btn landing-btn-solid" onClick={onClose}>
              {t.close}
            </button>
          </div>
        ) : (
          <form onSubmit={e => void submit(e)} noValidate>
            <h2 id="contact-title">{t.title}</h2>
            <p className="contact-intro">{t.intro}</p>
            <div className="contact-grid">
              {field('name', t.name, {required: true, auto: 'name'})}
              {field('organization', t.organization, {auto: 'organization'})}
              {field('role', t.role, {placeholder: t.rolePlaceholder, auto: 'organization-title'})}
              {field('phone', t.phone, {type: 'tel', auto: 'tel'})}
              <div className="contact-wide">
                {field('email', t.email, {type: 'email', required: true, auto: 'email'})}
              </div>
              <label className="contact-field contact-wide">
                <span>
                  {t.message}
                  <small> · {t.required}</small>
                </span>
                <textarea
                  rows={4}
                  value={form.message}
                  onChange={set('message')}
                  placeholder={t.messagePlaceholder}
                  required
                  disabled={busy}
                />
              </label>
              {/* For bots only: hidden from people and from screen readers, never filled in by hand. */}
              <input
                className="contact-trap"
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={form.website}
                onChange={set('website')}
              />
            </div>
            {result && !result.ok && (
              <p className="contact-error" role="alert">
                {result.reason === 'invalid' ? (
                  t.invalid
                ) : result.reason === 'too_many' ? (
                  t.tooMany
                ) : (
                  <>
                    {t.unavailable} <a href={`mailto:${email}`}>{email}</a>.
                  </>
                )}
              </p>
            )}
            <div className="contact-actions">
              <button type="button" className="landing-btn landing-btn-outline" onClick={onClose} disabled={busy}>
                {t.cancel}
              </button>
              <button type="submit" className="landing-btn landing-btn-solid" disabled={busy}>
                <Send size={17} aria-hidden="true" />
                {busy ? t.sending : t.send}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>,
    document.body,
  );
}
