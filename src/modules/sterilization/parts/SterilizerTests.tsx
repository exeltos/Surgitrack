import {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronRight, FlaskConical} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import {useLibraries} from '../../../core/LibraryStore';
import {useAppPreferences} from '../../../core/AppPreferences';
import {testsInUse, testsState} from '../../../core/equipmentTests';
import {trData} from '../../../i18n';
import {useTestDeviceSync} from '../../devices/useTestDeviceSync';
import SterilizerTestRow from './SterilizerTestRow';

/** Where a closed reminder is remembered (this browser only): the day and what it said. */
const SEEN_KEY = 'surgitrack.testsReminder.';
const readSeen = (type: string) => {
  try {
    return window.localStorage.getItem(SEEN_KEY + type) || '';
  } catch {
    return '';
  }
};
const writeSeen = (type: string, value: string) => {
  try {
    window.localStorage.setItem(SEEN_KEY + type, value);
  } catch {
    // Private window or blocked storage: the reminder simply comes back next time.
  }
};

/**
 * Before the first load of the day: the tests of each sterilizer (Bowie-Dick, leak, spores) or washer, each as a
 * button that is green when it is up to date, orange when it is due and red when it failed (it is then not loaded).
 * A press records the test; a connected test device records its own. The same tests are on the sterilizer's page in
 * «Κλίβανοι & Συσκευές» and are checked again at Release.
 *
 * Over the list it is one slim line saying where the tests stand. When a test is due or failed, a reminder card comes
 * up in front; «Αργότερα» closes it for the day (it comes back on its own if something new goes wrong), and the slim
 * line opens it again whenever wanted.
 */
export default function SterilizerTests({equipment = 'sterilizers'}: {equipment?: 'sterilizers' | 'washers'}) {
  const library = useLibraries();
  const sterilizers = library[equipment];
  const washer = equipment === 'washers';
  const type = washer ? 'WASHER' : 'STERILIZER';
  const {lang} = useAppPreferences();
  const L = (el: string, en: string) => (lang === 'el' ? el : en);
  const [message, setMessage] = useState<{text: string; warning: boolean}>();
  const [open, setOpen] = useState(false);
  useTestDeviceSync();

  const inUse = testsInUse(sterilizers);
  const states = sterilizers.map(item => testsState(item.tests, Date.now(), type));
  const failed = states.filter(state => state === 'FAILED').length;
  const due = inUse ? states.filter(state => state === 'DUE').length : 0;
  // What the reminder is about today: a new failure, or the next day, brings it back after «Αργότερα».
  const seenAs = `${new Date().toDateString()}|${failed}|${due}`;
  const attention = failed > 0 || due > 0;

  useEffect(() => {
    if (attention && readSeen(type) !== seenAs) setOpen(true);
  }, [attention, seenAs, type]);

  const close = () => {
    setOpen(false);
    setMessage(undefined);
    if (attention) writeSeen(type, seenAs);
  };

  // Escape closes the card, but not while a test is being recorded in its own dialog on top.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('.modal-backdrop:not(.ster-tests-backdrop)')) return;
      close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!sterilizers.length) return null;

  const title = washer ? L('Δοκιμές πλυντηρίων', 'Washer tests') : L('Δοκιμές κλιβάνων', 'Sterilizer tests');
  const summary = failed
    ? L(`${failed} με αποτυχημένη δοκιμή`, `${failed} with a failed test`)
    : due
      ? L(`${due} με εκκρεμή δοκιμή`, `${due} with a test due`)
      : inUse
        ? L('όλες εντάξει', 'all up to date')
        : L('δεν έχουν καταγραφεί', 'none recorded yet');
  const tone = failed ? ' bad' : due ? ' due' : '';

  return (
    <>
      <button type="button" className={`ster-tests-bar${tone}`} onClick={() => setOpen(true)}>
        <FlaskConical size={16} aria-hidden="true" />
        <b>{title}</b>
        <span className="ster-tests-summary">{summary}</span>
        <ChevronRight size={15} aria-hidden="true" className="ster-tests-bar-go" />
      </button>
      {open &&
        createPortal(
          <div
            className="modal-backdrop confirm-dialog-backdrop ster-tests-backdrop"
            onMouseDown={e => e.currentTarget === e.target && close()}
          >
            <section
              className={`confirm-dialog ster-tests-card${tone}`}
              role="dialog"
              aria-modal="true"
              aria-label={title}
            >
              <header>
                <div className="confirm-icon">
                  <FlaskConical size={20} />
                </div>
                <div>
                  <h3>{title}</h3>
                  <p className="ster-tests-summary">{summary}</p>
                </div>
              </header>
              <p className="ster-tests-help">
                {washer
                  ? L(
                      'Πριν το πρώτο φορτίο της ημέρας. Πατήστε μια δοκιμή για να γράψετε το αποτέλεσμα· πλυντήριο με αποτυχημένη δοκιμή δεν φορτώνεται.',
                      'Before the first load of the day. Press a test to record its result; a washer with a failed test is not loaded.',
                    )
                  : L(
                      'Πριν το πρώτο φορτίο της ημέρας (Bowie-Dick). Πατήστε μια δοκιμή για να γράψετε το αποτέλεσμα· κλίβανος με αποτυχημένη δοκιμή δεν φορτώνεται.',
                      'Before the first load of the day (Bowie-Dick). Press a test to record its result; a sterilizer with a failed test is not loaded.',
                    )}
              </p>
              <ul className="ster-tests-list">
                {sterilizers.map((item, index) => {
                  // Each machine's own standing, beside its name: ready, a test due, or not to be loaded.
                  const state = states[index];
                  const standing =
                    state === 'FAILED'
                      ? ['bad', L('Δεν φορτώνεται', 'Not to be loaded')]
                      : state === 'DUE' && inUse
                        ? ['due', L('Εκκρεμεί δοκιμή', 'Test due')]
                        : state === 'DUE'
                          ? ['none', L('Χωρίς καταγραφές', 'Nothing recorded')]
                          : ['ok', L('Έτοιμο', 'Ready')];
                  return (
                    <li key={item.id}>
                      <div className="ster-tests-machine">
                        <span className="ster-tests-name">{trData(item.el)}</span>
                        {item.outOfService ? (
                          <em>{L('εκτός λειτουργίας', 'out of service')}</em>
                        ) : (
                          <span className={`ster-tests-standing ${standing[0]}`}>{standing[1]}</span>
                        )}
                      </div>
                      <SterilizerTestRow sterilizer={item} inUse={inUse} onMessage={setMessage} equipment={equipment} />
                    </li>
                  );
                })}
              </ul>
              {message && (
                <p className={`ster-tests-message${message.warning ? ' warning' : ''}`} role="status">
                  {message.text}
                </p>
              )}
              <footer>
                <span className="ster-tests-later">
                  {attention
                    ? L(
                        'Ξανανοίγει από τη γραμμή «{0}» πάνω από τη λίστα.',
                        'Open it again from «{0}» above the list.',
                      ).replace('{0}', title)
                    : ''}
                </span>
                <AppButton variant={attention ? undefined : 'primary'} type="button" onClick={close} autoFocus>
                  {attention ? L('Αργότερα', 'Later') : L('Κλείσιμο', 'Close')}
                </AppButton>
              </footer>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
