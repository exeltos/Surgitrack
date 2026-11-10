import {parseDisplayDate} from './displayDate';
import {testsInUse, testsState} from './equipmentTests';
import type {LibraryItem} from './libraries';
import type {ProcessLoadRecord} from '../types/domain';

const DAY_MS = 24 * 60 * 60 * 1000;
/** The window the failures are counted in, and how many in it call for attention (maintenance). */
export const TROUBLE_DAYS = 30;
export const TROUBLE_LIMIT = 3;

/** Whether the hospital's list marks a sterilizer or washer, by its name, as out of service. */
export const outOfServiceOf = (list: readonly LibraryItem[], name: string) =>
  list.find(item => item.el === name)?.outOfService;

/** One load of the equipment that did not end well: its cycle failed, or its load was not released. */
export type EquipmentTrouble = {
  loadId: string;
  kind: 'CYCLE_FAILED' | 'NOT_RELEASED';
  cycleNumber: string;
  program: string;
  at: string;
  note?: string;
};

/**
 * The loads of a sterilizer (or, with `kind`, a washer) that failed or were not released, newest first, with how many fall in the last
 * `TROUBLE_DAYS` days (a sterilizer that keeps failing needs a technician, not another try).
 */
export function equipmentTrouble(
  equipment: string,
  loads: readonly ProcessLoadRecord[],
  now = Date.now(),
  kind: ProcessLoadRecord['kind'] = 'STERILIZATION',
) {
  const items: EquipmentTrouble[] = loads
    .filter(load => load.kind === kind && load.equipment === equipment)
    .filter(load => load.status === 'FAILED' || load.status === 'REPROCESS')
    .map(load => ({
      loadId: load.id,
      kind: load.status === 'FAILED' ? ('CYCLE_FAILED' as const) : ('NOT_RELEASED' as const),
      cycleNumber: load.cycleNumber,
      program: load.program,
      at: load.completedAt || load.releasedAt || load.createdAt,
      note: load.note,
    }));
  const recent = items.filter(item => {
    const date = parseDisplayDate(item.at);
    return !!date && now - date.getTime() <= TROUBLE_DAYS * DAY_MS;
  });
  return {items, recent: recent.length, attention: recent.length >= TROUBLE_LIMIT};
}

/** What the day's briefing says about the sterilizers and washers: how many of them need someone's attention. */
export type EquipmentBriefing = {
  /** Latest test failed: not loaded until a passing one is recorded. */
  failedTests: number;
  outOfService: number;
  /** Failed three times or more in the last 30 days: have it checked. */
  troubled: number;
  /** A test missing or overdue, in a hospital that records tests. */
  testsDue: number;
};

export function equipmentBriefing(
  sterilizers: readonly LibraryItem[],
  washers: readonly LibraryItem[],
  loads: readonly ProcessLoadRecord[],
  now = Date.now(),
): EquipmentBriefing {
  const groups = [
    {list: sterilizers, tested: 'STERILIZER' as const, loadKind: 'STERILIZATION' as const},
    {list: washers, tested: 'WASHER' as const, loadKind: 'WASHING' as const},
  ];
  const out: EquipmentBriefing = {failedTests: 0, outOfService: 0, troubled: 0, testsDue: 0};
  for (const {list, tested, loadKind} of groups) {
    const inUse = testsInUse(list);
    for (const item of list) {
      if (item.outOfService) {
        // Out of service is its own line: not also "overdue tests" of a machine nobody loads.
        out.outOfService += 1;
        continue;
      }
      const state = testsState(item.tests, now, tested);
      if (state === 'FAILED') out.failedTests += 1;
      else if (state === 'DUE' && inUse) out.testsDue += 1;
      if (equipmentTrouble(item.el, loads, now, loadKind).attention) out.troubled += 1;
    }
  }
  return out;
}
