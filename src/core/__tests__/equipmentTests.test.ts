import {describe, expect, it} from 'vitest';
import {TESTS_KEPT, testStandings, testsInUse, testsState, withTest} from '../equipmentTests';
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

  it('points out missing tests only where the hospital records tests at all', () => {
    expect(testsInUse([{}, {tests: []}])).toBe(false);
    expect(testsInUse([{}, {tests: allToday}])).toBe(true);
  });
});
