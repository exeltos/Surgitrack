import {describe, expect, it} from 'vitest';
import {trialDaysLeft, trialEndAfter, trialEndDate, trialEndOn, trialState} from '../trial';

describe('trial hospitals', () => {
  const now = new Date(2026, 9, 4, 10, 0).getTime();

  it('ends a 30-day trial at the end of its last day', () => {
    const end = new Date(trialEndAfter(30, new Date(now)));
    expect([end.getFullYear(), end.getMonth(), end.getDate(), end.getHours()]).toEqual([2026, 10, 3, 23]);
    expect(trialEndDate(trialEndOn('2026-11-03'))).toBe('2026-11-03');
  });

  it('warns in the last 7 days and locks after the end', () => {
    expect(trialState('STANDARD', undefined, now)).toMatchObject({ended: false, warn: false});
    expect(trialState('TRIAL', trialEndOn('2026-10-30'), now)).toMatchObject({ended: false, warn: false, daysLeft: 27});
    expect(trialState('TRIAL', trialEndOn('2026-10-08'), now)).toMatchObject({ended: false, warn: true, daysLeft: 5});
    expect(trialState('TRIAL', trialEndOn('2026-10-03'), now)).toMatchObject({ended: true, warn: false, daysLeft: 0});
    expect(trialDaysLeft(undefined)).toBeUndefined();
  });
});
