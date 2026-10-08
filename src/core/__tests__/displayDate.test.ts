import {describe, expect, it} from 'vitest';
import {
  daysSince,
  formatDate,
  formatDateTime,
  formatTime,
  normalizeDateText,
  normalizeDates,
  parseDisplayDate,
} from '../displayDate';

describe('dates as records store them', () => {
  it('reads the full form', () => {
    expect(parseDisplayDate('29/09/2026 07:10')).toEqual(new Date(2026, 8, 29, 7, 10));
  });
  it('reads the browser short Greek form, morning and afternoon', () => {
    expect(parseDisplayDate('8/10/26, 1:05 μ.μ.')).toEqual(new Date(2026, 9, 8, 13, 5));
    expect(parseDisplayDate('8/10/26, 12:30 π.μ.')).toEqual(new Date(2026, 9, 8, 0, 30));
    expect(parseDisplayDate('8/10/26, 12:30 μ.μ.')).toEqual(new Date(2026, 9, 8, 12, 30));
  });
  it('reads a date without a time, and refuses anything else', () => {
    expect(parseDisplayDate('05/10/2026')).toEqual(new Date(2026, 9, 5));
    expect(parseDisplayDate('31/02/2026')).toBeUndefined();
    expect(parseDisplayDate('χθες')).toBeUndefined();
    expect(parseDisplayDate(undefined)).toBeUndefined();
  });
  it('counts whole days since', () => {
    const now = new Date(2026, 9, 8, 14, 0).getTime();
    expect(daysSince('01/10/2026 13:00', now)).toBe(7);
    expect(daysSince('8/10/26, 9:00 π.μ.', now)).toBe(0);
    expect(daysSince('—', now)).toBeUndefined();
  });
});

describe('one date format', () => {
  const at = new Date(2026, 9, 8, 13, 5, 9);
  it('writes date, time and both, in 24 hours', () => {
    expect(formatDate(at)).toBe('08/10/2026');
    expect(formatTime(at)).toBe('13:05');
    expect(formatTime(at, true)).toBe('13:05:09');
    expect(formatDateTime(at)).toBe('08/10/2026 13:05');
    expect(formatDateTime(new Date(2026, 0, 2, 0, 7))).toBe('02/01/2026 00:07');
    expect(formatDateTime('not a date')).toBe('');
  });
  it('rewrites dates stored in older forms and leaves anything else', () => {
    expect(normalizeDateText('8/10/26, 1:05 μ.μ.')).toBe('08/10/2026 13:05');
    expect(normalizeDateText('7/10/26, 10:58 π.μ.')).toBe('07/10/2026 10:58');
    expect(normalizeDateText('8/10/2026')).toBe('08/10/2026');
    expect(normalizeDateText('29/09/2026 07:10')).toBe('29/09/2026 07:10');
    expect(normalizeDateText('2026-0932')).toBe('2026-0932');
    expect(normalizeDateText('1/2 Σετ')).toBe('1/2 Σετ');
  });
  it('rewrites nested dates and keeps unchanged records as they are', () => {
    const record = {id: 'm1', at: '8/10/26, 1:05 μ.μ.', photos: [{createdAt: '8/10/26, 9:00 π.μ.', name: 'a'}], n: 3};
    expect(normalizeDates(record)).toEqual({
      id: 'm1',
      at: '08/10/2026 13:05',
      photos: [{createdAt: '08/10/2026 09:00', name: 'a'}],
      n: 3,
    });
    expect(record.at).toBe('8/10/26, 1:05 μ.μ.');
    const same = {id: 'm2', at: '29/09/2026 07:10', tags: ['x']};
    expect(normalizeDates(same)).toBe(same);
  });
});
