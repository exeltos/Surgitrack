import {parseDisplayDate} from './displayDate';
import type {EquipmentTest, EquipmentTestKind} from './libraries';

/** Each test, how often it is due, and what it is called. A day is the calendar day; a week is seven days. */
export const TEST_KINDS: Array<{
  id: EquipmentTestKind;
  days: number;
  el: string;
  en: string;
  hint: {el: string; en: string};
}> = [
  {
    id: 'BOWIE_DICK',
    days: 1,
    el: 'Bowie-Dick',
    en: 'Bowie-Dick',
    hint: {el: 'Κάθε μέρα, πριν το πρώτο φορτίο', en: 'Every day, before the first load'},
  },
  {
    id: 'LEAK',
    days: 7,
    el: 'Δοκιμή διαρροής κενού',
    en: 'Vacuum leak test',
    hint: {el: 'Κάθε εβδομάδα', en: 'Every week'},
  },
  {
    id: 'BIOLOGICAL',
    days: 7,
    el: 'Βιολογική δοκιμή (σπόροι)',
    en: 'Biological test (spores)',
    hint: {el: 'Κάθε εβδομάδα', en: 'Every week'},
  },
];
/** The newest tests kept per sterilizer. */
export const TESTS_KEPT = 40;

export type TestStanding = {
  kind: EquipmentTestKind;
  last?: EquipmentTest;
  /** The latest one failed: the sterilizer is not used until one passes. */
  failed: boolean;
  /** It was never done, or is older than its period. */
  due: boolean;
};

/**
 * Which test a test device's reading is, from its program name (how Bowie-Dick testers, leak tests and spore
 * readers name them, in Greek or English); nothing when it is none of them.
 */
export function testKindOfProgram(program?: string): EquipmentTestKind | undefined {
  const text = (program || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/bowie|dick|helix|pcd/.test(text)) return 'BOWIE_DICK';
  if (/leak|vacuum|διαρρο|κενο/.test(text)) return 'LEAK';
  if (/bio|spore|σπορ|βιολογ/.test(text)) return 'BIOLOGICAL';
  return undefined;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Where each test stands: its latest result, and whether it is due again. */
export function testStandings(tests: readonly EquipmentTest[] = [], now = Date.now()): TestStanding[] {
  return TEST_KINDS.map(({id, days}) => {
    // The newest by its date (a test from a device may be recorded after a later one done by hand).
    const last = tests
      .filter(test => test.kind === id)
      .reduce<EquipmentTest | undefined>((newest, test) => {
        const at = parseDisplayDate(test.at)?.getTime() ?? 0;
        return !newest || at > (parseDisplayDate(newest.at)?.getTime() ?? 0) ? test : newest;
      }, undefined);
    const at = last ? parseDisplayDate(last.at) : undefined;
    const due = !at || (days === 1 ? !sameDay(at, new Date(now)) : now - at.getTime() > days * 24 * 60 * 60 * 1000);
    return {kind: id, last, failed: last?.result === 'FAIL', due};
  });
}

/**
 * The sterilizer's standing: «FAILED» when the latest of any test failed (it is not loaded until a pass is
 * recorded), «DUE» when a test is missing or overdue (a warning only), otherwise «OK».
 */
export function testsState(tests: readonly EquipmentTest[] | undefined, now = Date.now()): 'OK' | 'DUE' | 'FAILED' {
  const standings = testStandings(tests, now);
  if (standings.some(item => item.failed)) return 'FAILED';
  return standings.some(item => item.due) ? 'DUE' : 'OK';
}

/**
 * The tests with a new one first, the oldest dropped beyond `TESTS_KEPT`. The latest of every kind always stays,
 * however many of the others come after it: dropping a failure would clear the sterilizer's lockout.
 */
export function withTest(tests: readonly EquipmentTest[] = [], test: EquipmentTest): EquipmentTest[] {
  const time = (item: EquipmentTest) => parseDisplayDate(item.at)?.getTime() ?? 0;
  // Newest first by date; one recorded now goes ahead of an equal date.
  const all = [test, ...tests].sort((a, b) => time(b) - time(a));
  const latest = new Set(TEST_KINDS.map(kind => all.find(item => item.kind === kind.id)?.id));
  return all.filter((item, index) => index < TESTS_KEPT || latest.has(item.id));
}

/** Whether the hospital records tests at all (any sterilizer has one): only then are missing tests pointed out. */
export const testsInUse = (list: ReadonlyArray<{tests?: readonly EquipmentTest[]}>) =>
  list.some(item => !!item.tests?.length);
