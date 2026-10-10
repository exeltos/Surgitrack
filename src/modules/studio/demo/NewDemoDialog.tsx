import {useState} from 'react';
import {X} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import {tr} from '../../../i18n';
import {DEFAULT_DEMO_DAYS, DEMO_LENGTHS, isValidEmail} from '../../../core/demoAccounts';
import {trialEndAfter, trialEndDate, trialEndOn} from '../../../core/trial';
import type {NewDemo} from '../../../data/cloud/demoAccounts';

/** The owner's form for a prospect's Demo: who it is for and how long it lasts. */
export default function NewDemoDialog({onClose, onCreate}: {onClose: () => void; onCreate: (demo: NewDemo) => void}) {
  const [hospitalName, setHospitalName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [screenGuides, setScreenGuides] = useState(true);
  const [endDate, setEndDate] = useState(trialEndDate(trialEndAfter(DEFAULT_DEMO_DAYS)));
  const emailOk = !contactEmail.trim() || isValidEmail(contactEmail);
  const future = !!endDate && Date.parse(trialEndOn(endDate)) > Date.now();
  const ready =
    hospitalName.trim().length >= 2 && contactName.trim().length >= 2 && !!contactEmail.trim() && emailOk && future;
  return (
    <div className="studio-drawer-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <aside className="studio-drawer" aria-label={tr('Νέο Demo αξιολόγησης')}>
        <header>
          <div>
            <span className="eyebrow">{tr('DEMO ΑΞΙΟΛΟΓΗΣΗΣ')}</span>
            <h2>{tr('Νέο Demo αξιολόγησης')}</h2>
          </div>
          <button onClick={onClose} aria-label={tr('Κλείσιμο')}>
            <X />
          </button>
        </header>
        <div className="studio-drawer-form">
          <label>
            {tr('Νοσοκομείο')}
            <input
              autoFocus
              value={hospitalName}
              onChange={e => setHospitalName(e.target.value)}
              placeholder={tr('π.χ. Γ.Ν. Λάρισας')}
            />
          </label>
          <div className="studio-admin-invite">
            <b>{tr('Υπεύθυνος αξιολόγησης')}</b>
            <small>
              {tr(
                'Γίνεται διαχειριστής του Demo και λαμβάνει email με το όνομα χρήστη του, τη λήξη και κουμπί για να ορίσει κωδικό.',
              )}
            </small>
            <label>
              {tr('Ονοματεπώνυμο')}
              <input value={contactName} onChange={e => setContactName(e.target.value)} />
            </label>
            <label>
              Email
              <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
              {!emailOk && <small className="studio-field-error">{tr('Μη έγκυρο email.')}</small>}
            </label>
            <label>
              {tr('Τηλέφωνο')}
              <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} />
            </label>
          </div>
          <div className="studio-trial-length">
            <span>{tr('Διάρκεια')}</span>
            <div>
              {DEMO_LENGTHS.map(days => (
                <button
                  key={days}
                  type="button"
                  className={endDate === trialEndDate(trialEndAfter(days)) ? 'active' : ''}
                  onClick={() => setEndDate(trialEndDate(trialEndAfter(days)))}
                >
                  {tr('{0} ημέρες', days)}
                </button>
              ))}
            </div>
            <label>
              {tr('Λήγει στις')}
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              {!!endDate && !future && (
                <small className="studio-field-error">{tr('Η λήξη πρέπει να είναι μελλοντική.')}</small>
              )}
            </label>
          </div>
          <label>
            {tr('Οδηγοί οθόνης')}
            <select value={screenGuides ? 'ON' : 'OFF'} onChange={e => setScreenGuides(e.target.value === 'ON')}>
              <option value="ON">{tr('Εμφανίζονται')}</option>
              <option value="OFF">{tr('Δεν εμφανίζονται')}</option>
            </select>
            <small>
              {tr(
                'Οι σύντομες οδηγίες την πρώτη φορά σε κάθε οθόνη. Αλλάζουν αργότερα από τις Ρυθμίσεις του νοσοκομείου.',
              )}
            </small>
          </label>
          <label>
            {tr('Σημειώσεις')}
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
          </label>
        </div>
        <footer>
          <AppButton onClick={onClose}>{tr('Ακύρωση')}</AppButton>
          <AppButton
            variant="primary"
            disabled={!ready}
            onClick={() =>
              onCreate({
                hospitalName: hospitalName.trim(),
                contactName: contactName.trim(),
                contactEmail: contactEmail.trim().toLowerCase(),
                contactPhone: contactPhone.trim() || undefined,
                notes: notes.trim() || undefined,
                endsAt: trialEndOn(endDate),
                screenGuides,
              })
            }
          >
            {tr('Δημιουργία και αποστολή')}
          </AppButton>
        </footer>
      </aside>
    </div>
  );
}
