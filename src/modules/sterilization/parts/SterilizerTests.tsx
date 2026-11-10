import {useState} from 'react';
import {FlaskConical} from 'lucide-react';
import {useLibraries} from '../../../core/LibraryStore';
import {useAppPreferences} from '../../../core/AppPreferences';
import {testsInUse, testsState} from '../../../core/equipmentTests';
import {trData} from '../../../i18n';
import {useTestDeviceSync} from '../../devices/useTestDeviceSync';
import SterilizerTestRow from './SterilizerTestRow';

/**
 * Before the first load of the day: the tests of each sterilizer (Bowie-Dick, leak, spores), each as a button that is
 * green when it is up to date, orange when it is due and red when it failed (the sterilizer is then not loaded). A
 * press records the test; a connected test device records its own. The same tests are on the sterilizer's page in
 * «Κλίβανοι & Συσκευές» and are checked again at Release.
 */
export default function SterilizerTests({equipment = 'sterilizers'}: {equipment?: 'sterilizers' | 'washers'}) {
  const library = useLibraries();
  const sterilizers = library[equipment];
  const washer = equipment === 'washers';
  const type = washer ? 'WASHER' : 'STERILIZER';
  const {lang} = useAppPreferences();
  const L = (el: string, en: string) => (lang === 'el' ? el : en);
  const [message, setMessage] = useState<{text: string; warning: boolean}>();
  useTestDeviceSync();
  if (!sterilizers.length) return null;
  const inUse = testsInUse(sterilizers);

  // One line when closed: where the tests stand. It opens by itself when something needs attention.
  const states = sterilizers.map(item => testsState(item.tests, Date.now(), type));
  const failed = states.filter(state => state === 'FAILED').length;
  const due = inUse ? states.filter(state => state === 'DUE').length : 0;
  const summary = failed
    ? L(`${failed} με αποτυχημένη δοκιμή`, `${failed} with a failed test`)
    : due
      ? L(`${due} με εκκρεμή δοκιμή`, `${due} with a test due`)
      : inUse
        ? L('όλες εντάξει', 'all up to date')
        : L('δεν έχουν καταγραφεί', 'none recorded yet');

  return (
    <details
      className={`ster-tests${failed ? ' bad' : due ? ' due' : ''}`}
      aria-label={washer ? L('Δοκιμές πλυντηρίων', 'Washer tests') : L('Δοκιμές κλιβάνων', 'Sterilizer tests')}
      open={!!failed || !!due || undefined}
    >
      <summary>
        <FlaskConical size={16} aria-hidden="true" />
        <b>{washer ? L('Δοκιμές πλυντηρίων', 'Washer tests') : L('Δοκιμές κλιβάνων', 'Sterilizer tests')}</b>
        <span className="ster-tests-summary">{summary}</span>
      </summary>
      <p className="ster-tests-help">
        {washer
          ? L(
              'Πριν το πρώτο φορτίο της ημέρας γίνεται ο έλεγχος καθαρισμού με δείκτη λερώματος. Πατήστε μια δοκιμή για να καταγράψετε το αποτέλεσμα· αν αποτύχει, το πλυντήριο δεν φορτώνεται μέχρι να περάσει.',
              'The cleaning test with a soil indicator is done before the first load of the day. Press a test to record its result; if it fails, the washer is not loaded until one passes.',
            )
          : L(
              'Πριν το πρώτο φορτίο της ημέρας γίνεται η δοκιμή Bowie-Dick. Πατήστε μια δοκιμή για να καταγράψετε το αποτέλεσμα· αν αποτύχει, ο κλίβανος δεν φορτώνεται μέχρι να περάσει. Ελέγχονται ξανά στην Αποδέσμευση.',
              'The Bowie-Dick test is done before the first load of the day. Press a test to record its result; if it fails, the sterilizer is not loaded until one passes. They are checked again at Release.',
            )}
      </p>
      <ul>
        {sterilizers.map(item => (
          <li key={item.id}>
            <span className="ster-tests-name">{trData(item.el)}</span>
            {item.outOfService && <em>{L('εκτός λειτουργίας', 'out of service')}</em>}
            <SterilizerTestRow sterilizer={item} inUse={inUse} onMessage={setMessage} equipment={equipment} />
          </li>
        ))}
      </ul>
      {message && (
        <p className={`ster-tests-message${message.warning ? ' warning' : ''}`} role="status">
          {message.text}
        </p>
      )}
    </details>
  );
}
