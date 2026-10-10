import {RefreshCcw, Settings2, ShieldCheck, CheckCircle2} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import {tr} from '../../../i18n';
import PlatformContactSettings from '../PlatformContactSettings';
import LabelSettingsCard from '../LabelSettingsCard';
import type {StudioPageState} from '../useStudioPage';
import {DEFAULT_SHELF_LIFE, SHELF_LIFE_OPTIONS} from '../../../core/sterileExpiry';
import {DEFAULT_IDLE_LOCK_MINUTES, IDLE_LOCK_OPTIONS, type ReminderEmails} from '../../../core/libraryTypes';
import {formatDateTime} from '../../../core/displayDate';

export default function SystemTab({s}: {s: StudioPageState}) {
  const {L, currentUser, libs, platformAdmin, setConfirm, tab} = s;
  return (
    <>
      {tab === 'SYSTEM' && (
        <div className="studio-system-grid">
          {platformAdmin && libs.dataMode === 'PRODUCTION' && <PlatformContactSettings L={L} />}
          <section>
            <header>
              <Settings2 />
              <div>
                <h3>{L('Γενικές ρυθμίσεις', 'General settings')}</h3>
                <p>
                  {L(
                    'Κεντρικές παράμετροι που πρέπει να είναι κοινές σε όλη την εφαρμογή.',
                    'Central parameters shared across the application.',
                  )}
                </p>
              </div>
            </header>
            <label>
              {L('Προειδοποίηση υπολοίπου χρήσεων', 'Remaining-use warning')}
              <div className="studio-setting-input">
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={libs.systemSettings.usageWarningThreshold}
                  onChange={e =>
                    libs.updateSystemSettings(
                      {
                        usageWarningThreshold: Math.max(1, Math.min(20, Number(e.target.value) || 1)),
                      },
                      currentUser.name,
                    )
                  }
                />
                <span>{L('χρήσεις', 'uses')}</span>
              </div>
              <small>
                {L(
                  'Εφαρμόζεται στις ειδοποιήσεις και στις καρτέλες περιορισμένων χρήσεων.',
                  'Applied to alerts and limited-use asset cards.',
                )}
              </small>
            </label>
            <label>
              {L('Διάρκεια αποστείρωσης (προεπιλογή)', 'Sterile shelf life (default)')}
              <div className="studio-setting-input">
                <select
                  value={libs.systemSettings.sterileShelfLifeMonths || DEFAULT_SHELF_LIFE}
                  onChange={e =>
                    libs.updateSystemSettings({sterileShelfLifeMonths: Number(e.target.value)}, currentUser.name)
                  }
                >
                  {SHELF_LIFE_OPTIONS.map(months => (
                    <option key={months} value={months}>
                      {L(`${months} μήνες`, `${months} months`)}
                    </option>
                  ))}
                </select>
              </div>
              <small>
                {L(
                  'Προτείνεται στη Συσκευασία & Σήμανση και αλλάζει ανά Σετ ή εργαλείο. Μετρά από την αποδέσμευση.',
                  'Suggested at Packaging & Labelling and changeable per Set or instrument. Counted from the release.',
                )}
              </small>
            </label>
            <label>
              {L('Κλείδωμα οθόνης μετά από αδράνεια', 'Screen lock after inactivity')}
              <div className="studio-setting-input">
                <select
                  value={libs.systemSettings.idleLockMinutes ?? DEFAULT_IDLE_LOCK_MINUTES}
                  onChange={e => libs.updateSystemSettings({idleLockMinutes: Number(e.target.value)}, currentUser.name)}
                >
                  {IDLE_LOCK_OPTIONS.map(minutes => (
                    <option key={minutes} value={minutes}>
                      {minutes ? L(`${minutes} λεπτά`, `${minutes} minutes`) : L('Ποτέ', 'Never')}
                    </option>
                  ))}
                </select>
              </div>
              <small>
                {L(
                  'Για κοινόχρηστα tablet και υπολογιστές: η οθόνη κλειδώνει και ξεκλειδώνει με το συνθηματικό του χρήστη· ο συγχρονισμός συνεχίζει από πίσω.',
                  'For shared tablets and computers: the screen locks and unlocks with the user’s password; syncing goes on behind it.',
                )}
              </small>
            </label>
            <label>
              {L('Email υπενθυμίσεων κάθε πρωί', 'Reminder email every morning')}
              <div className="studio-setting-input">
                <select
                  value={libs.systemSettings.reminderEmails || 'OFF'}
                  onChange={e =>
                    libs.updateSystemSettings({reminderEmails: e.target.value as ReminderEmails}, currentUser.name)
                  }
                >
                  <option value="OFF">{L('Όχι', 'Off')}</option>
                  <option value="ADMINS">{L('Στους διαχειριστές', 'To administrators')}</option>
                  <option value="ADMINS_SUPERVISORS">
                    {L(
                      'Σε διαχειριστές και Προϊστάμενο Αποστείρωσης',
                      'To administrators and the Sterilization supervisor',
                    )}
                  </option>
                </select>
              </div>
              <small>
                {L(
                  'Περίπου 8 το πρωί, μόνο όταν κάτι περιμένει: λήξεις αποστείρωσης, έτοιμα που δεν παραλήφθηκαν, σταλμένα χωρίς παραλαβή, εκκρεμότητες άνω της εβδομάδας, συσκευές χωρίς δεδομένα. Χωρίς στοιχεία ασθενών.',
                  'Around 8 in the morning, only when something is waiting: sterile dates ending, ready items not collected, sent items not received, issues open over a week, devices not reporting. No patient data.',
                )}
              </small>
            </label>
            <label>
              {L('Οδηγοί οθόνης', 'Screen guides')}
              <div className="studio-setting-input">
                <select
                  value={libs.systemSettings.screenGuides === false ? 'OFF' : 'ON'}
                  onChange={e => libs.updateSystemSettings({screenGuides: e.target.value === 'ON'}, currentUser.name)}
                >
                  <option value="ON">{L('Εμφανίζονται', 'Shown')}</option>
                  <option value="OFF">{L('Δεν εμφανίζονται', 'Not shown')}</option>
                </select>
              </div>
              <small>
                {L(
                  'Η πρώτη φορά σε κάθε οθόνη: τι κάνει και τα πρώτα βήματα, πάνω από την οθόνη. Για όλους τους χρήστες του νοσοκομείου· όταν εμφανίζονται, ο καθένας μπορεί να τους κλείσει για τον εαυτό του.',
                  'The first time on each screen: what it does and the first steps, above the screen. For everyone in the hospital; when shown, each person can still turn them off for themselves.',
                )}
              </small>
            </label>
            <label>
              {L('Barcode Σετ', 'Set barcode')}
              <div className="studio-static-field">
                <b>{tr('S + 6 ψηφία')}</b>
                <span>S000321</span>
              </div>
            </label>
            <label>
              {L('Barcode Εργαλείου', 'Instrument barcode')}
              <div className="studio-static-field">
                <b>{tr('T + 6 ψηφία')}</b>
                <span>T001250</span>
              </div>
            </label>
          </section>
          <LabelSettingsCard L={L} />
          <section>
            <header>
              <ShieldCheck />
              <div>
                <h3>{L('Ασφάλεια & ιχνηλασιμότητα', 'Security & traceability')}</h3>
                <p>
                  {L(
                    'Οι μεταφορές και οι κρίσιμες ενέργειες διατηρούν ταυτότητα χρήστη και χρονική σήμανση.',
                    'Transfers and critical actions retain user identity and timestamps.',
                  )}
                </p>
              </div>
            </header>
            <div className="studio-check-row">
              <CheckCircle2 />
              <span>{L('Ηλεκτρονική υπογραφή χρήστη σε μεταφορά', 'User electronic signature on transfer')}</span>
            </div>
            <div className="studio-check-row">
              <CheckCircle2 />
              <span>{L('Καταγραφή αλυσίδας παράδοσης', 'Chain-of-custody logging')}</span>
            </div>
            <details className="released-loads">
              <summary>
                {L('Ιστορικό παραμετροποίησης', 'Configuration audit')} · {libs.configurationAudit.length}
              </summary>
              <div>
                {libs.configurationAudit.slice(0, 10).map(event => (
                  <div key={event.id}>
                    <span>
                      <b>{event.entityType}</b> · {event.entityId}
                    </span>
                    <span>
                      {event.by} · {formatDateTime(event.at)}
                    </span>
                  </div>
                ))}
                {!libs.configurationAudit.length && (
                  <small>{L('Δεν υπάρχουν ακόμη αλλαγές.', 'No changes recorded yet.')}</small>
                )}
              </div>
            </details>
            <div className="studio-check-row">
              <CheckCircle2 />
              <span>{L('Δεν αποθηκεύονται κωδικοί πρόσβασης στο Studio', 'Passwords are not stored in Studio')}</span>
            </div>
            {/* Only in Demo: in a real hospital the libraries are the hospital's, saved for everyone, and a
                reset here would empty them for every user. */}
            {libs.dataMode === 'DEMO' && (
              <AppButton
                onClick={() =>
                  setConfirm({
                    title: L('Επαναφορά demo ρυθμίσεων;', 'Reset demo settings?'),
                    message: L(
                      'Θα επανέλθουν οι αρχικές βιβλιοθήκες και οι demo χρήστες.',
                      'Initial libraries and demo users will be restored.',
                    ),
                    action: libs.resetData,
                  })
                }
              >
                <RefreshCcw size={16} />
                {L('Επαναφορά demo δεδομένων', 'Reset demo data')}
              </AppButton>
            )}
          </section>
        </div>
      )}
    </>
  );
}
