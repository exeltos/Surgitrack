import {itemTestStandings} from '../../core/equipmentTests';
import type {EquipmentTest, EquipmentTestKind, TestedEquipment} from '../../core/libraries';
import {parseDisplayDate} from '../../core/displayDate';
import {tr} from '../../i18n';
import {useAppPreferences} from '../../core/AppPreferences';

const SHORT: Record<EquipmentTestKind, {el: string; en: string}> = {
  BOWIE_DICK: {el: 'Bowie-Dick', en: 'Bowie-Dick'},
  LEAK: {el: 'Διαρροή', en: 'Leak'},
  BIOLOGICAL: {el: 'Βιολογικός', en: 'Biological'},
  CLEANING: {el: 'Καθαρισμός', en: 'Cleaning'},
  PROTEIN: {el: 'Πρωτεΐνη', en: 'Protein'},
  SPRAY: {el: 'Ψεκαστήρες', en: 'Spray arms'},
};

/** When a test was done, short: its time when today («06:40»), else its day («16/11»). */
function shortWhen(at: string) {
  const date = parseDisplayDate(at);
  if (!date) return at;
  const today = new Date();
  // Today: the time alone (any other day shows its date).
  if (date.toDateString() === today.toDateString())
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Each test a sterilizer or washer is held to, on its own line: passed (✓), failed (✗, the equipment is not loaded)
 * or due (never done or older than its period), with when it was last done.
 */
export default function TestStandingsCell({
  item,
  equipment,
}: {
  item: {el: string; tests?: EquipmentTest[]; testKinds?: EquipmentTestKind[]};
  equipment: TestedEquipment;
}) {
  const {lang} = useAppPreferences();
  const standings = itemTestStandings(item, Date.now(), equipment);
  return (
    <ul className="test-standings">
      {standings.map(s => {
        const tone = s.failed ? 'bad' : s.due ? 'due' : 'ok';
        const mark = s.failed ? '✗' : s.due ? '!' : '✓';
        const state = s.failed ? tr('απέτυχε') : s.due ? tr('εκκρεμεί') : tr('εντάξει');
        return (
          <li key={s.kind} className={tone}>
            <span className="test-mark" aria-hidden="true">
              {mark}
            </span>
            <span>{SHORT[s.kind][lang === 'el' ? 'el' : 'en']}</span>
            <small>{s.last ? shortWhen(s.last.at) : tr('ποτέ')}</small>
            <span className="visually-hidden">{state}</span>
          </li>
        );
      })}
    </ul>
  );
}
