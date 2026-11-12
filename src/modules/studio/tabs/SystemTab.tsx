import {useState} from 'react';
import {RefreshCcw} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import PlatformContactSettings from '../PlatformContactSettings';
import LabelSettingsCard from '../LabelSettingsCard';
import type {StudioPageState} from '../useStudioPage';
import {DEFAULT_SHELF_LIFE, SHELF_LIFE_OPTIONS} from '../../../core/sterileExpiry';
import {DEFAULT_IDLE_LOCK_MINUTES, IDLE_LOCK_OPTIONS, type ReminderEmails} from '../../../core/libraryTypes';

export default function SystemTab({s}: {s: StudioPageState}) {
  const {L, currentUser, libs, platformAdmin, setConfirm, tab} = s;
  // Settings by category: only one category is on screen at a time.
  const [group, setGroup] = useState<'GENERAL' | 'STERILIZATION'>('GENERAL');
  const groups = [
    {id: 'GENERAL' as const, label: L('Γενικά', 'General')},
    {id: 'STERILIZATION' as const, label: L('Αποστείρωση & ετικέτες', 'Sterilization & labels')},
  ];
  return (
    <>
      {tab === 'SYSTEM' && (
        <>
          <div
            className="settings-categories"
            role="group"
            aria-label={L('Κατηγορίες ρυθμίσεων', 'Settings categories')}
          >
            {groups.map(g => (
              <button
                key={g.id}
                type="button"
                className={`settings-category ${group === g.id ? 'active' : ''}`}
                aria-pressed={group === g.id}
                onClick={() => setGroup(g.id)}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="studio-system-grid">
            {group === 'GENERAL' && (
              <section>
                {platformAdmin && libs.dataMode === 'PRODUCTION' && <PlatformContactSettings L={L} />}
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
                  {L('Κλείδωμα οθόνης μετά από αδράνεια', 'Screen lock after inactivity')}
                  <div className="studio-setting-input">
                    <select
                      value={libs.systemSettings.idleLockMinutes ?? DEFAULT_IDLE_LOCK_MINUTES}
                      onChange={e =>
                        libs.updateSystemSettings({idleLockMinutes: Number(e.target.value)}, currentUser.name)
                      }
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
                      onChange={e =>
                        libs.updateSystemSettings({screenGuides: e.target.value === 'ON'}, currentUser.name)
                      }
                    >
                      <option value="ON">{L('Εμφανίζονται', 'Shown')}</option>
                      <option value="OFF">{L('Δεν εμφανίζονται', 'Not shown')}</option>
                    </select>
                  </div>
                  <small>
                    {L(
                      'Το κουμπί «Οδηγός οθόνης» στην πάνω μπάρα: τι κάνει η οθόνη και τα πρώτα βήματα, όποτε τον ζητήσει ο χρήστης. Για τα τμήματα, την Αποστείρωση και τον διαχειριστή του νοσοκομείου.',
                      'The «Screen guide» button in the top bar: what the screen does and the first steps, whenever the user asks. For departments, Sterilization and the hospital admin.',
                    )}
                  </small>
                </label>
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
            )}
            {group === 'STERILIZATION' && (
              <section>
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
                      'Προτείνεται στη Συσκευασία και αλλάζει ανά Σετ ή εργαλείο. Μετρά από την αποδέσμευση.',
                      'Suggested at Packaging & Labelling and changeable per Set or instrument. Counted from the release.',
                    )}
                  </small>
                </label>
                <LabelSettingsCard L={L} />
              </section>
            )}
          </div>
        </>
      )}
    </>
  );
}
