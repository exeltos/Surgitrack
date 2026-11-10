import {describe, expect, it} from 'vitest';
import {TESTS_KEPT, testKindOfProgram, testStandings, testsInUse, testsState, withTest} from '../equipmentTests';
import type {EquipmentTest} from '../libraries';

const test = (kind: EquipmentTest['kind'], at: string, result: EquipmentTest['result'] = 'PASS'): EquipmentTest => ({
  id: `${kind}-${at}`,
  kind,
  at,
  result,
  by: 'Χ',
});
const now = new Date(2026, 10, 10, 14, 0).getTime();
const allToday = [
  test('BOWIE_DICK', '10/11/2026 07:30'),
  test('LEAK', '08/11/2026 07:40'),
  test('BIOLOGICAL', '05/11/2026 08:00'),
];

describe('the tests of a sterilizer', () => {
  it('is up to date when the daily test was done today and the weekly ones within seven days', () => {
    expect(testsState(allToday, now)).toBe('OK');
  });

  it('is due when a test was never done, or the daily one was done yesterday, or a weekly one is older than a week', () => {
    expect(testsState([], now)).toBe('DUE');
    expect(testsState([test('BOWIE_DICK', '09/11/2026 18:00'), ...allToday.slice(1)], now)).toBe('DUE');
    expect(testsState([...allToday.slice(0, 2), test('BIOLOGICAL', '01/11/2026 08:00')], now)).toBe('DUE');
  });

  it('fails when the latest of any test failed, until a newer one passes', () => {
    const failed = [test('BOWIE_DICK', '10/11/2026 09:00', 'FAIL'), ...allToday.slice(1)];
    expect(testsState(failed, now)).toBe('FAILED');
    expect(testStandings(failed, now)[0]).toMatchObject({failed: true});
    // The newest comes first: a pass after the failure clears it.
    const repeated = [test('BOWIE_DICK', '10/11/2026 10:00'), ...failed];
    expect(testsState(repeated, now)).toBe('OK');
  });

  it('keeps the newest tests only', () => {
    let list: EquipmentTest[] = [];
    for (let i = 0; i < TESTS_KEPT + 5; i++)
      list = withTest(list, test('LEAK', `01/11/2026 ${String(i % 24).padStart(2, '0')}:00`));
    expect(list).toHaveLength(TESTS_KEPT);
  });

  it('never drops the latest result of a kind when the history is trimmed', () => {
    // A failed leak test, then many other tests: the failure still holds the sterilizer back.
    let list: EquipmentTest[] = withTest([], test('LEAK', '01/11/2026 08:00', 'FAIL'));
    for (let i = 0; i < TESTS_KEPT + 10; i++)
      list = withTest(list, {...test('BOWIE_DICK', '02/11/2026 07:00'), id: `b${i}`});
    expect(list.length).toBeLessThanOrEqual(TESTS_KEPT + 1);
    expect(list.some(item => item.kind === 'LEAK' && item.result === 'FAIL')).toBe(true);
    expect(testsState(list, new Date(2026, 10, 2, 12).getTime())).toBe('FAILED');
  });

  it('points out missing tests only where the hospital records tests at all', () => {
    expect(testsInUse([{}, {tests: []}])).toBe(false);
    expect(testsInUse([{}, {tests: allToday}])).toBe(true);
  });

  it("knows which test a test device's program is", () => {
    expect(testKindOfProgram('Bowie-Dick 134°C')).toBe('BOWIE_DICK');
    expect(testKindOfProgram('Helix PCD')).toBe('BOWIE_DICK');
    expect(testKindOfProgram('Leak test')).toBe('LEAK');
    expect(testKindOfProgram('Δοκιμή διαρροής κενού')).toBe('LEAK');
    expect(testKindOfProgram('Bio 3h')).toBe('BIOLOGICAL');
    expect(testKindOfProgram('Βιολογική δοκιμή')).toBe('BIOLOGICAL');
    expect(testKindOfProgram('134°C · 5 min')).toBeUndefined();
    expect(testKindOfProgram(undefined)).toBeUndefined();
  });

  it('judges a kind by its newest date, not by the order it was recorded in', () => {
    // A device result that comes in later but is older than the person\'s own record does not replace it.
    const mine = test('BOWIE_DICK', '10/11/2026 09:00');
    const older = test('BOWIE_DICK', '09/11/2026 09:00', 'FAIL');
    const list = withTest([mine], older);
    expect(list[0]).toBe(mine);
    expect(testStandings([older, mine], now)[0].last).toBe(mine);
    expect(testsState([older, mine, ...allToday.slice(1)], now)).toBe('OK');
  });
});
