import {useState} from 'react';
import {FlaskConical} from 'lucide-react';
import {useLibraries} from '../../../core/LibraryStore';
import {useAppPreferences} from '../../../core/AppPreferences';
import {testsInUse} from '../../../core/equipmentTests';
import {trData} from '../../../i18n';
import {useTestDeviceSync} from '../../devices/useTestDeviceSync';
import SterilizerTestRow from './SterilizerTestRow';

/**
 * Before the first load of the day: the tests of each sterilizer (Bowie-Dick, leak, spores), each as a button that is
 * green when it is up to date, orange when it is due and red when it failed (the sterilizer is then not loaded). A
 * press records the test; a connected test device records its own. The same tests are on the sterilizer's page in
 * «Κλίβανοι & Συσκευές» and are checked again at Release.
 */
export default function SterilizerTests() {
  const {sterilizers} = useLibraries();
  const {lang} = useAppPreferences();
  const L = (el: string, en: string) => (lang === 'el' ? el : en);
  const [message, setMessage] = useState<{text: string; warning: boolean}>();
  useTestDeviceSync();
  if (!sterilizers.length) return null;
  const inUse = testsInUse(sterilizers);

  return (
    <section className="ster-tests" aria-label={L('Δοκιμές κλιβάνων', 'Sterilizer tests')}>
      <header>
        <FlaskConical size={16} aria-hidden="true" />
        <div>
          <b>{L('Δοκιμές κλιβάνων', 'Sterilizer tests')}</b>
          <small>
            {L(
              'Πριν το πρώτο φορτίο της ημέρας γίνεται η δοκιμή Bowie-Dick. Πατήστε μια δοκιμή για να καταγράψετε το αποτέλεσμα· αν αποτύχει, ο κλίβανος δεν φορτώνεται μέχρι να περάσει. Ελέγχονται ξανά στην Αποδέσμευση.',
              'The Bowie-Dick test is done before the first load of the day. Press a test to record its result; if it fails, the sterilizer is not loaded until one passes. They are checked again at Release.',
            )}
          </small>
        </div>
      </header>
      <ul>
        {sterilizers.map(item => (
          <li key={item.id}>
            <span className="ster-tests-name">{trData(item.el)}</span>
            {item.outOfService && <em>{L('εκτός λειτουργίας', 'out of service')}</em>}
            <SterilizerTestRow sterilizer={item} inUse={inUse} onMessage={setMessage} />
          </li>
        ))}
      </ul>
      {message && (
        <p className={`ster-tests-message${message.warning ? ' warning' : ''}`} role="status">
          {message.text}
        </p>
      )}
    </section>
  );
}
