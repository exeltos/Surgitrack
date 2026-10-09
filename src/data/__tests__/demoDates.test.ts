import {afterEach, describe, expect, it, vi} from 'vitest';
import {DEMO_ANCHOR, demoShiftDays, shiftDateText, shiftDemoDates} from '../demoDates';

describe('sample hospital dates', () => {
  afterEach(() => vi.useRealTimers());

  it('counts whole days from the sample day', () => {
    expect(demoShiftDays(new Date(DEMO_ANCHOR))).toBe(0);
    expect(demoShiftDays(new Date(2026, 9, 9, 23, 30))).toBe(9);
    expect(demoShiftDays(new Date(2027, 0, 1, 0, 5))).toBe(93);
  });

  it('moves each date format, keeping the time', () => {
    expect(shiftDateText('29/09/2026 08:10', 9)).toBe('08/10/2026 08:10');
    expect(shiftDateText('30/12/2026', 3)).toBe('02/01/2027');
    expect(shiftDateText('2026-10-28', 5)).toBe('2026-11-02');
    expect(shiftDateText('2026-03-28', 2)).toBe('2026-03-30');
  });

  it('leaves everything else alone', () => {
    for (const text of ['PT-2026-0041', '2026-041', 'Χειρουργείο', '12:30', '1/2/2026', ''])
      expect(shiftDateText(text, 30)).toBe(text);
    expect(shiftDemoDates({n: 4, ok: true, none: null, list: ['x']}, 10)).toEqual({
      n: 4,
      ok: true,
      none: null,
      list: ['x'],
    });
  });

  it('copies the data, moving dates deep inside it', () => {
    const data = {sets: [{createdAt: '10/01/2026', history: [{at: '29/09/2026 08:10'}]}]};
    expect(shiftDemoDates(data, 9)).toEqual({sets: [{createdAt: '19/01/2026', history: [{at: '08/10/2026 08:10'}]}]});
    expect(data.sets[0].createdAt).toBe('10/01/2026');
  });

  it('keeps the loaded sample current months later', async () => {
    vi.useFakeTimers({toFake: ['Date']});
    vi.setSystemTime(new Date(2027, 2, 15, 9, 0));
    vi.resetModules();
    const {demoSurgiRepository} = await import('../repositories/demoRepository');
    const data = demoSurgiRepository.getInitialData();
    const toTime = (value: string) => {
      const [d, m, y, hh = '0', mm = '0'] = value.split(/[/ :]/);
      return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm)).getTime();
    };
    const latest = Math.max(...data.movements.map(m => toTime(m.at)));
    const today = new Date(2027, 2, 15, 23, 59).getTime();
    // The newest movement is from the last few days, never in the future.
    expect(latest).toBeLessThanOrEqual(today);
    expect(today - latest).toBeLessThan(5 * 864e5);
    // Sterile dates around today: some still sterile, some already expired.
    const until = data.sets.filter(s => s.sterileUntil).map(s => Date.parse(`${s.sterileUntil}T12:00:00`));
    expect(until.some(t => t > today)).toBe(true);
    expect(until.some(t => t < today)).toBe(true);
  });
});
