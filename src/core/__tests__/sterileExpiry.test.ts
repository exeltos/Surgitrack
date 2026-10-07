import {describe, expect, it} from 'vitest';
import {
  expiryAlerts,
  expiryStatus,
  formatExpiry,
  sterileExpiryList,
  sterileUntil,
  sterilizedOnOf,
  warningDays,
} from '../sterileExpiry';

describe('sterile shelf life', () => {
  it('counts months from the release date', () => {
    expect(sterileUntil(new Date(2026, 9, 7), 6)).toBe('2027-04-07');
    expect(sterileUntil(new Date(2026, 7, 31), 3)).toBe('2026-11-30');
    expect(sterileUntil(new Date(2026, 11, 15), 2)).toBe('2027-02-15');
  });
  it('warns in the last month, or the last 10 days for 2 months', () => {
    expect(warningDays(6)).toBe(30);
    expect(warningDays(3)).toBe(30);
    expect(warningDays(2)).toBe(10);
    const today = new Date(2026, 9, 7);
    expect(expiryStatus('2026-11-10', 6, today)).toEqual({state: 'OK', daysLeft: 34});
    expect(expiryStatus('2026-11-06', 6, today)).toEqual({state: 'EXPIRING', daysLeft: 30});
    expect(expiryStatus('2026-10-20', 2, today)).toEqual({state: 'OK', daysLeft: 13});
    expect(expiryStatus('2026-10-17', 2, today)).toEqual({state: 'EXPIRING', daysLeft: 10});
    expect(expiryStatus('2026-10-07', 2, today)).toEqual({state: 'EXPIRING', daysLeft: 0});
    expect(expiryStatus('2026-10-06', 6, today)).toEqual({state: 'EXPIRED', daysLeft: -1});
  });
  it('shows dates as dd/mm/yyyy', () => {
    expect(formatExpiry('2027-04-07')).toBe('07/04/2027');
  });
});

describe('sterile expiry list', () => {
  const today = new Date(2026, 9, 7);
  const base = {department: 'Χειρουργείο', shelfLifeMonths: 6};
  it('lists sterile items soonest first and leaves instruments of a Set to the Set', () => {
    const list = sterileExpiryList(
      [
        {...base, id: 's1', barcode: 'S1', name: 'A', state: 'READY_FOR_PICKUP', sterileUntil: '2026-12-01'},
        {...base, id: 's2', barcode: 'S2', name: 'B', state: 'IN_DEPARTMENT', sterileUntil: '2026-10-01'},
        {...base, id: 's3', barcode: 'S3', name: 'C', state: 'IN_WASHING', sterileUntil: '2026-10-02'},
      ],
      [
        {...base, id: 't1', barcode: 'T1', name: 'D', state: 'IN_STORAGE', sterileUntil: '2026-10-20'},
        {...base, id: 't2', barcode: 'T2', name: 'E', state: 'IN_DEPARTMENT', sterileUntil: '2026-10-03', setId: 's2'},
      ],
      today,
    );
    expect(list.map(item => [item.barcode, item.state === 'EXPIRED' ? 'X' : item.state])).toEqual([
      ['S2', 'X'],
      ['T1', 'EXPIRING'],
      ['S1', 'OK'],
    ]);
    expect(expiryAlerts(list).map(item => item.barcode)).toEqual(['S2', 'T1']);
  });
});

describe('sterilization date', () => {
  it('keeps the stored date and derives it from the expiry and shelf life for older records', () => {
    expect(sterilizedOnOf({sterilizedOn: '2026-08-01', sterileUntil: '2027-02-04', shelfLifeMonths: 6})).toBe(
      '2026-08-01',
    );
    expect(sterilizedOnOf({sterileUntil: '2027-02-04', shelfLifeMonths: 6})).toBe('2026-08-04');
    expect(sterilizedOnOf({sterileUntil: '2027-02-04'})).toBeUndefined();
    expect(sterilizedOnOf({})).toBeUndefined();
  });
});
