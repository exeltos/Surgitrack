import {useState} from 'react';
import {Check, TriangleAlert} from 'lucide-react';
import {useLibraries} from '../../../core/LibraryStore';
import {useSurgi} from '../../../store/SurgiStore';
import {useAppPreferences} from '../../../core/AppPreferences';
import {TEST_KINDS, testStandings, withTest} from '../../../core/equipmentTests';
import type {EquipmentTest, LibraryItem} from '../../../core/libraries';
import {formatDateTime} from '../../../core/displayDate';
import TestDialog from '../../devices/TestDialog';
import {messageOf} from '../../devices/deviceUi';

/**
 * The three tests of one sterilizer as buttons: green when up to date (with the time), orange when due, red when it
 * failed. A press records the test (result and note). `inUse` says whether the hospital records tests at all: only
 * then a missing one is called due.
 */
export default function SterilizerTestRow({
  sterilizer,
  inUse,
  onMessage,
}: {
  sterilizer: LibraryItem;
  inUse: boolean;
  onMessage?: (message: {text: string; warning: boolean}) => void;
}) {
  const {updateEquipment} = useLibraries();
  const {can, currentUser} = useSurgi();
  const {lang} = useAppPreferences();
  const L = (el: string, en: string) => (lang === 'el' ? el : en);
  const allowed = can('sterilization.workspace');
  const [recording, setRecording] = useState<EquipmentTest['kind']>();

  const record = async (value: {result: EquipmentTest['result']; note?: string}) => {
    const kind = recording;
    setRecording(undefined);
    if (!kind) return;
    const test: EquipmentTest = {id: `t${Date.now()}`, kind, ...value, at: formatDateTime(), by: currentUser.name};
    try {
      await updateEquipment('sterilizers', sterilizer.id, {tests: withTest(sterilizer.tests, test)});
      onMessage?.({
        warning: value.result === 'FAIL',
        text:
          value.result === 'FAIL'
            ? L(
                `Αποτυχημένη δοκιμή: ο κλίβανος «${sterilizer.el}» δεν φορτώνεται ούτε αποδεσμεύει μέχρι επιτυχή δοκιμή.`,
                `Failed test: the sterilizer “${sterilizer.el}” is not loaded or released until a test passes.`,
              )
            : L(
                `Καταγράφηκε η δοκιμή του κλιβάνου «${sterilizer.el}».`,
                `Test of the sterilizer “${sterilizer.el}” recorded.`,
              ),
      });
    } catch (e) {
      onMessage?.({
        warning: true,
        text: L('Η δοκιμή δεν αποθηκεύτηκε: ', 'The test was not saved: ') + messageOf(e),
      });
    }
  };

  return (
    <>
      <span className="ster-tests-buttons">
        {testStandings(sterilizer.tests).map(standing => {
          const kind = TEST_KINDS.find(entry => entry.id === standing.kind)!;
          const state = standing.failed ? 'bad' : standing.due ? (inUse ? 'due' : 'none') : 'ok';
          return (
            <button
              key={standing.kind}
              type="button"
              className={`ster-test ${state}`}
              disabled={!allowed}
              title={standing.last ? `${standing.last.at} · ${standing.last.by}` : undefined}
              onClick={() => setRecording(standing.kind)}
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
      {recording && (
        <TestDialog
          L={L}
          sterilizer={sterilizer.el}
          test={L(
            TEST_KINDS.find(entry => entry.id === recording)?.el || '',
            TEST_KINDS.find(entry => entry.id === recording)?.en || '',
          )}
          onClose={() => setRecording(undefined)}
          onSave={record}
        />
      )}
    </>
  );
}
