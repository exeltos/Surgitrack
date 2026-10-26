import {presetPath} from '../../core/listMemory';
import {movementStamp} from '../../core/movementTime';
import {tr} from '../../i18n';

/**
 * A department Home card for one status. It counts Sets and standalone instruments, which are two lists:
 * it opens the Sets' list, or the instruments' when only instruments are there, and says how many of
 * each when it is both.
 */
export function statusCard(
  sets: ReadonlyArray<{state: string}>,
  standalone: ReadonlyArray<{state: string}>,
  statusFilter: string,
  match: (state: string) => boolean,
) {
  const setCount = sets.filter(a => match(a.state)).length;
  const toolCount = standalone.filter(a => match(a.state)).length;
  return {
    value: setCount + toolCount,
    to: presetPath(setCount || !toolCount ? '/department' : '/department/tools', {statusFilter}),
    note: setCount && toolCount ? tr('{0} Σετ · {1} μεμονωμένα', setCount, toolCount) : undefined,
  };
}

type DatedMovement = {at: string; from: string; to: string; by: string; status: string};

/**
 * The department sending a Set or instrument to Sterilization («Ηλεκτρονική αποστολή …», or «Αποστολή προς
 * αποστείρωση» in older and Demo records), not Sterilization recording its receipt from the department.
 */
export const isDispatch = (m: DatedMovement, dept: string) =>
  m.from === dept && /^(ηλεκτρονική αποστολή|αποστολή προς αποστείρωση)/i.test(m.status.trim());

/** Per day over the last `days` days (oldest first): what the department sent, and what it received. */
export function movementsPerDay(movements: readonly DatedMovement[], dept: string, now: Date, days = 14) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const slots = Array.from({length: days}, (_, i) => {
    const day = new Date(today);
    day.setDate(day.getDate() - (days - 1 - i));
    return {day, sent: 0, received: 0};
  });
  for (const m of movements) {
    const sent = isDispatch(m, dept);
    if (!sent && m.to !== dept) continue;
    const stamp = movementStamp(m.at);
    if (!stamp) continue;
    const d = new Date(stamp);
    d.setHours(0, 0, 0, 0);
    const slot = slots.find(x => x.day.getTime() === d.getTime());
    if (!slot) continue;
    if (sent) slot.sent++;
    else slot.received++;
  }
  return slots;
}
