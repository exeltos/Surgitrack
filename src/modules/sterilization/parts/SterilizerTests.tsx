import {useState} from 'react';
import {Check, FlaskConical, TriangleAlert} from 'lucide-react';
import {useLibraries} from '../../../core/LibraryStore';
import {useSurgi} from '../../../store/SurgiStore';
import {TEST_KINDS, testStandings, testsInUse, withTest} from '../../../core/equipmentTests';
import type {EquipmentTest} from '../../../core/libraries';
import {formatDateTime} from '../../../core/displayDate';
import {trData} from '../../../i18n';
import {useAppPreferences} from '../../../core/AppPreferences';
import TestDialog from '../../devices/TestDialog';
import {messageOf} from '../../devices/deviceUi';

/**
 * Before the first load of the day: the tests of each sterilizer (Bowie-Dick, leak, spores), each as a button that is
 * green when it is up to date, orange when it is due and red when it failed (the sterilizer is then not loaded). A
 * press records the test. The same tests are on the sterilizer's page in «Κλίβανοι & Συσκευές».
 */
export default function SterilizerTests() {
  const {sterilizers, updateEquipment} = useLibraries();
  const {can, currentUser} = useSurgi();
  const [message, setMessage] = useState<{text: string; warning: boolean}>();
  const {lang} = useAppPreferences();
  const L = (el: string, en: string) => (lang === 'el' ? el : en);
  const allowed = can('sterilization.workspace');
  const [recording, setRecording] = useState<{id: string; name: string; kind: EquipmentTest['kind']}>();
  if (!sterilizers.length) return null;
  const inUse = testsInUse(sterilizers);

  const record = async (value: {result: EquipmentTest['result']; note?: string}) => {
    const target = recording;
    setRecording(undefined);
    const item = sterilizers.find(entry => entry.id === target?.id);
    if (!target || !item) return;
    const test: EquipmentTest = {
      id: `t${Date.now()}`,
      kind: target.kind,
      ...value,
      at: formatDateTime(),
      by: currentUser.name,
    };
    try {
      await updateEquipment('sterilizers', item.id, {tests: withTest(item.tests, test)});
      setMessage({
        warning: value.result === 'FAIL',
        text:
          value.result === 'FAIL'
            ? L(
                `Αποτυχημένη δοκιμή: ο κλίβανος «${item.el}» δεν φορτώνεται μέχρι επιτυχή δοκιμή.`,
                `Failed test: the sterilizer “${item.el}” is not loaded until a test passes.`,
              )
            : L(`Καταγράφηκε η δοκιμή του κλιβάνου «${item.el}».`, `Test of the sterilizer “${item.el}” recorded.`),
      });
    } catch (e) {
      setMessage({warning: true, text: L('Η δοκιμή δεν αποθηκεύτηκε: ', 'The test was not saved: ') + messageOf(e)});
    }
  };

  return (
    <section className="ster-tests" aria-label={L('Δοκιμές κλιβάνων', 'Sterilizer tests')}>
      <header>
        <FlaskConical size={16} aria-hidden="true" />
        <div>
          <b>{L('Δοκιμές κλιβάνων', 'Sterilizer tests')}</b>
          <small>
            {L(
              'Πριν το πρώτο φορτίο της ημέρας γίνεται η δοκιμή Bowie-Dick. Πατήστε μια δοκιμή για να καταγράψετε το αποτέλεσμα· αν αποτύχει, ο κλίβανος δεν φορτώνεται μέχρι να περάσει.',
              'The Bowie-Dick test is done before the first load of the day. Press a test to record its result; if it fails, the sterilizer is not loaded until one passes.',
            )}
          </small>
        </div>
      </header>
      <ul>
        {sterilizers.map(item => (
          <li key={item.id}>
            <span className="ster-tests-name">{trData(item.el)}</span>
            {item.outOfService && <em>{L('εκτός λειτουργίας', 'out of service')}</em>}
            <span className="ster-tests-buttons">
              {testStandings(item.tests).map(standing => {
                const kind = TEST_KINDS.find(entry => entry.id === standing.kind)!;
                const state = standing.failed ? 'bad' : standing.due ? (inUse ? 'due' : 'none') : 'ok';
                return (
                  <button
                    key={standing.kind}
                    type="button"
                    className={`ster-test ${state}`}
                    disabled={!allowed}
                    title={standing.last ? `${standing.last.at} · ${standing.last.by}` : undefined}
                    onClick={() => setRecording({id: item.id, name: item.el, kind: standing.kind})}
                  >
                    {state === 'ok' ? (
                      <Check size={13} aria-hidden="true" />
                    ) : state === 'bad' ? (
                      <TriangleAlert size={13} aria-hidden="true" />
                    ) : null}
                    {L(kind.el, kind.en)}
                    <small>
                      {standing.failed
                        ? L('απέτυχε', 'failed')
                        : standing.due
                          ? inUse
                            ? L('εκκρεμεί', 'due')
                            : L('δεν έχει καταγραφεί', 'not recorded')
                          : standing.last?.at.slice(-5) || ''}
                    </small>
                  </button>
                );
              })}
            </span>
          </li>
        ))}
      </ul>
      {message && (
        <p className={`ster-tests-message${message.warning ? ' warning' : ''}`} role="status">
          {message.text}
        </p>
      )}
      {recording && (
        <TestDialog
          L={L}
          sterilizer={recording.name}
          test={L(
            TEST_KINDS.find(entry => entry.id === recording.kind)?.el || '',
            TEST_KINDS.find(entry => entry.id === recording.kind)?.en || '',
          )}
          onClose={() => setRecording(undefined)}
          onSave={record}
        />
      )}
    </section>
  );
}
