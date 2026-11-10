import {useState} from 'react';
import {FlaskConical, TriangleAlert} from 'lucide-react';
import {useLibraries} from '../../../core/LibraryStore';
import {useAppPreferences} from '../../../core/AppPreferences';
import {testsInUse, testsState} from '../../../core/equipmentTests';
import {useTestDeviceSync} from '../../devices/useTestDeviceSync';
import SterilizerTestRow from './SterilizerTestRow';

/**
 * In the release of a load: the tests of the sterilizer that ran it. Their results come from the people who
 * recorded them or from the connected test device (a 3M Bowie-Dick tester, a spore reader). A failed one stops the
 * release (the load goes back to reprocessing); a missing one is only pointed out.
 */
export default function ReleaseTests({equipment}: {equipment: string}) {
  const {sterilizers} = useLibraries();
  const {lang} = useAppPreferences();
  const L = (el: string, en: string) => (lang === 'el' ? el : en);
  const [message, setMessage] = useState<{text: string; warning: boolean}>();
  useTestDeviceSync();
  const sterilizer = sterilizers.find(item => item.el === equipment);
  if (!sterilizer) return null;
  const inUse = testsInUse(sterilizers);
  const state = testsState(sterilizer.tests);

  return (
    <section className="release-tests" aria-label={L('Δοκιμές κλιβάνου', 'Sterilizer tests')}>
      <div className="receipt-section-title">
        <div>
          <strong>{L('Δοκιμές κλιβάνου', 'Sterilizer tests')}</strong>
          <span>{sterilizer.el}</span>
        </div>
        <FlaskConical size={18} />
      </div>
      <SterilizerTestRow sterilizer={sterilizer} inUse={inUse} onMessage={setMessage} />
      <p
        className={`release-indicator-hint${state === 'OK' ? ' ok' : ''}${state === 'FAILED' ? ' bad' : ''}`}
        role={state === 'FAILED' ? 'alert' : undefined}
      >
        {state === 'FAILED' ? (
          <>
            <TriangleAlert size={14} aria-hidden="true" />{' '}
            {L(
              'Αποτυχημένη δοκιμή: το φορτίο δεν αποδεσμεύεται. Καταγράψτε επιτυχή δοκιμή ή επιλέξτε «Μη αποδέσμευση».',
              'Failed test: the load is not released. Record a passing test or choose “Not released”.',
            )}
          </>
        ) : state === 'OK' ? (
          L('Οι δοκιμές του κλιβάνου είναι εντάξει.', 'The sterilizer tests are up to date.')
        ) : inUse ? (
          L(
            'Εκκρεμεί δοκιμή του κλιβάνου (π.χ. το Bowie-Dick της ημέρας): καταγράψτε την ή ελέγξτε ότι έγινε.',
            'A test of the sterilizer is due (e.g. today’s Bowie-Dick): record it or check that it was done.',
          )
        ) : (
          L(
            'Δεν έχουν καταγραφεί δοκιμές για τον κλίβανο. Συνδέστε μια συσκευή δοκιμών (π.χ. 3M) ή καταγράψτε τες από εδώ.',
            'No tests are recorded for this sterilizer. Connect a test device (e.g. 3M) or record them here.',
          )
        )}
      </p>
      {message && (
        <p className={`ster-tests-message${message.warning ? ' warning' : ''}`} role="status">
          {message.text}
        </p>
      )}
    </section>
  );
}
