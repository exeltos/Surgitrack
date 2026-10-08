import {describe, expect, it} from 'vitest';
import {daysSince, parseDisplayDate} from '../displayDate';

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
