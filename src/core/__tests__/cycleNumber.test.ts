import {describe, expect, it} from 'vitest';
import {cycleDigits, cyclePrefixOf, normalizeCycleNumber, todaysCycles} from '../cycleNumber';

const sterilizers = [
  {id: 'a', el: 'Κλίβανος 1', en: 'Sterilizer 1'},
  {id: 'b', el: 'Κλίβανος 2', en: 'Sterilizer 2', cyclePrefix: 'Κ'},
  {id: 'c', el: 'Κλίβανος 3', en: 'Sterilizer 3'},
];

describe('cycle numbers', () => {
  it('reads «a3», «A3» and «Α3» (Greek) as one', () => {
    for (const typed of ['a3', 'A3', 'Α3', ' α 3 ']) expect(normalizeCycleNumber(typed)).toBe('A3');
    expect(normalizeCycleNumber('2026-0932')).toBe('2026-0932');
  });
  it('gives each sterilizer its letter: its own, else by its place in the list', () => {
    expect(sterilizers.map(s => cyclePrefixOf(s, sterilizers))).toEqual(['A', 'K', 'C']);
    expect(cyclePrefixOf(undefined, sterilizers)).toBe('');
    // A name ending with a letter or a number gives it: Greek letters by their place (Γ is the third: C).
    const named = ['ΚΛΙΒΑΝΟΣ Α', 'ΚΛΙΒΑΝΟΣ Β', 'ΚΛΙΒΑΝΟΣ Γ', 'Κλίβανος 1', 'Κλίβανος Ατμού 02'].map((el, i) => ({
      id: String(i),
      el,
      en: el,
    }));
    expect(named.map(s => cyclePrefixOf(s, named))).toEqual(['A', 'B', 'C', 'A', 'B']);
  });
  it('knows the number of a cycle written with the letter only', () => {
    expect(cycleDigits('α12', 'A')).toBe(12);
    expect(cycleDigits('B3', 'A')).toBeUndefined();
    expect(cycleDigits('2026-0932', 'A')).toBeUndefined();
  });
  it("offers the next of today's numbers of that sterilizer", () => {
    const now = new Date(2026, 10, 19, 12, 0);
    const loads = [
      {equipment: 'Κλίβανος 1', cycleNumber: 'A1', createdAt: '19/11/2026 08:10'},
      {equipment: 'Κλίβανος 1', cycleNumber: 'a3', createdAt: '19/11/2026 10:10'},
      {equipment: 'Κλίβανος 1', cycleNumber: 'A7', createdAt: '18/11/2026 17:00'},
      {equipment: 'Κλίβανος 2', cycleNumber: 'A5', createdAt: '19/11/2026 09:00'},
    ];
    const today = todaysCycles(loads, 'Κλίβανος 1', 'A', now);
    expect([...today.used].sort()).toEqual([1, 3]);
    expect(today.next).toBe(4);
    expect(todaysCycles([], 'Κλίβανος 1', 'A', now).next).toBe(1);
    // A device's long identifier with the same letter is not one of the day's numbers.
    const device = [{equipment: 'Κλίβανος 1', cycleNumber: 'A20261119001', createdAt: '19/11/2026 09:00'}];
    expect(todaysCycles(device, 'Κλίβανος 1', 'A', now).next).toBe(1);
  });
});
