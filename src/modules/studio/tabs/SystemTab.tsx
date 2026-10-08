import {RefreshCcw, Settings2, ShieldCheck, CheckCircle2} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import {tr} from '../../../i18n';
import PlatformContactSettings from '../PlatformContactSettings';
import LabelSettingsCard from '../LabelSettingsCard';
import type {StudioPageState} from '../useStudioPage';
import {DEFAULT_SHELF_LIFE, SHELF_LIFE_OPTIONS} from '../../../core/sterileExpiry';
import {DEFAULT_IDLE_LOCK_MINUTES, IDLE_LOCK_OPTIONS} from '../../../core/libraryTypes';
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
                <h3>{L('Κανόνες κύκλου ζωής', 'Lifecycle rules')}</h3>
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
                <h3>{L('Ασφάλεια & Audit', 'Security & Audit')}</h3>
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
              <span>{L('Καταγραφή chain of custody', 'Chain-of-custody logging')}</span>
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
            <AppButton
              onClick={() =>
                setConfirm({
                  title:
                    libs.dataMode === 'DEMO'
                      ? L('Επαναφορά demo ρυθμίσεων;', 'Reset demo settings?')
                      : L('Καθαρισμός τοπικών ρυθμίσεων;', 'Clear local settings?'),
                  message:
                    libs.dataMode === 'DEMO'
                      ? L(
                          'Θα επανέλθουν οι αρχικές βιβλιοθήκες και οι demo χρήστες.',
                          'Initial libraries and demo users will be restored.',
                        )
                      : L(
                          'Οι τοπικές βιβλιοθήκες και οι χρήστες θα επανέλθουν σε καθαρή production κατάσταση.',
                          'Local libraries and users will return to a clean production state.',
                        ),
                  action: libs.resetData,
                })
              }
            >
              <RefreshCcw size={16} />
              {libs.dataMode === 'DEMO'
                ? L('Επαναφορά demo δεδομένων', 'Reset demo data')
                : L('Καθαρισμός τοπικών δεδομένων', 'Clear local data')}
            </AppButton>
          </section>
        </div>
      )}
    </>
  );
}
